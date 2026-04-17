/**
 * Tests para la migración de fetchPersonalizedQuestions: de Supabase directo
 * a /api/questions/filtered (via fetchQuestionsViaAPI pattern).
 *
 * fetchPersonalizedQuestions se alcanza SOLO cuando:
 *   testType='personalizado' + sin tema + sin filtros de ley
 * Es un caso legacy (hardcoded a Ley 19/2013) que ahora debe pasar por API.
 *
 * Verifica: auth flow, parámetros de exclusión, session cache, errores,
 * y compatibilidad con TestLayout.
 */

// Mock supabase — jest.mock se hoistea, así que usamos un objeto compartido
// que podemos reasignar en beforeEach
const mockAuthFns = (() => {
  const getUser = jest.fn()
  const getSession = jest.fn()
  return { getUser, getSession }
})()

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: jest.fn(),
    rpc: jest.fn(),
    auth: {
      getUser: (...args: unknown[]) => mockAuthFns.getUser(...args),
      getSession: (...args: unknown[]) => mockAuthFns.getSession(...args),
    },
  }),
}))

jest.mock('@/lib/lawSlugSync', () => ({
  mapSlugToShortName: jest.fn((s: string) => s),
}))

jest.mock('@/lib/config/exam-positions', () => ({
  getValidExamPositions: jest.fn(() => []),
  applyExamPositionFilter: jest.fn((q: unknown[]) => q),
}))

jest.mock('@/lib/boe-extractor', () => ({
  isDisposicionArticle: jest.fn(() => false),
}))

import { fetchPersonalizedQuestions, clearAllSessionQuestionCache } from '@/lib/testFetchers'

// ============================================
// HELPERS
// ============================================

function makeApiQuestion(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    question: `Pregunta ${id}`,
    options: ['A', 'B', 'C', 'D'],
    explanation: 'Explicación',
    correct_option: 1,
    primary_article_id: 'art-1',
    tema: 0,
    image_url: null,
    content_data: null,
    article: {
      id: 'art-1',
      number: '14',
      title: 'Título',
      full_text: 'Contenido',
      law_name: 'Constitución Española',
      law_short_name: 'CE',
      display_number: 'Art. 14 CE',
    },
    metadata: {
      id,
      difficulty: 'medium',
      question_type: 'single',
      tags: null,
      is_active: true,
      created_at: '2025-01-01',
      updated_at: null,
      is_official_exam: false,
      exam_source: null,
      exam_date: null,
      exam_entity: null,
      exam_position: null,
      official_difficulty_level: null,
    },
    ...overrides,
  }
}

function makeSuccessResponse(numQuestions: number) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      questions: Array.from({ length: numQuestions }, (_, i) => makeApiQuestion(`q-${i}`)),
      totalAvailable: numQuestions + 50,
      filtersApplied: { laws: 3, articles: 0, sections: 0 },
    }),
  }
}

function makeErrorResponse(status: number, error: string) {
  return {
    ok: false,
    status,
    json: async () => ({ success: false, error }),
  }
}

const originalFetch = global.fetch
const mockUser = { id: 'user-123', email: 'test@test.com' }
const mockToken = 'mock-access-token'

beforeEach(() => {
  jest.clearAllMocks()
  mockAuthFns.getUser.mockResolvedValue({ data: { user: mockUser }, error: null })
  mockAuthFns.getSession.mockResolvedValue({
    data: { session: { access_token: mockToken } },
    error: null,
  })
  clearAllSessionQuestionCache()
})

afterAll(() => {
  global.fetch = originalFetch
})

// ============================================
// 1. REQUIERE AUTENTICACIÓN
// ============================================

describe('fetchPersonalizedQuestions — auth', () => {
  test('lanza error si no hay usuario autenticado', async () => {
    mockAuthFns.getUser.mockResolvedValue({ data: { user: null }, error: null })
    global.fetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))

    await expect(
      fetchPersonalizedQuestions(0, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('Usuario no autenticado')
  })

  test('envía Bearer token en la petición a la API', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchPersonalizedQuestions(0, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers['Authorization']).toBe(`Bearer ${mockToken}`)
  })

  test('funciona sin session token (API manejará como anónimo)', async () => {
    mockAuthFns.getSession.mockResolvedValue({ data: { session: null }, error: null })
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchPersonalizedQuestions(0, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })

    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers['Authorization']).toBeUndefined()
  })
})

// ============================================
// 2. CONSTRUCCIÓN DEL REQUEST
// ============================================

describe('fetchPersonalizedQuestions — request body', () => {
  test('pasa positionType del config', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchPersonalizedQuestions(0, { n: '25' }, { positionType: 'auxiliar_administrativo_madrid' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.positionType).toBe('auxiliar_administrativo_madrid')
  })

  test('topicNumber=0 para modo global (sin tema)', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchPersonalizedQuestions(0, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.topicNumber).toBe(0)
  })

  test('pasa exclude_recent como excludeRecentDays', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchPersonalizedQuestions(0, {
      n: '25',
      exclude_recent: 'true',
      recent_days: '30',
    }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.excludeRecentDays).toBe(30)
  })

  test('pasa difficultyMode del searchParams', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchPersonalizedQuestions(0, {
      n: '25',
      difficulty_mode: 'hard',
    }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.difficultyMode).toBe('hard')
  })

  test('pasa onlyOfficialQuestions', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchPersonalizedQuestions(0, {
      n: '25',
      only_official: 'true',
    }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.onlyOfficialQuestions).toBe(true)
  })

  test('pasa prioritizeNeverSeen=true por defecto', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchPersonalizedQuestions(0, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.prioritizeNeverSeen).toBe(true)
  })

  test('numQuestions se lee de searchParams', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(15))
    global.fetch = mockFetch

    await fetchPersonalizedQuestions(0, { n: '15' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.numQuestions).toBe(15)
  })

  test('sin exclude_recent, excludeRecentDays=0', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchPersonalizedQuestions(0, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.excludeRecentDays).toBe(0)
  })
})

// ============================================
// 3. FORMATO DE RESPUESTA
// ============================================

describe('fetchPersonalizedQuestions — response format', () => {
  test('devuelve array de TransformedQuestion', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeSuccessResponse(10))

    const result = await fetchPersonalizedQuestions(0, { n: '10' }, { positionType: 'auxiliar_administrativo_estado' })

    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(10)
  })

  test('cada pregunta tiene correct_option para validación instantánea', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeSuccessResponse(5))

    const result = await fetchPersonalizedQuestions(0, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })

    result.forEach((q: any) => {
      expect(typeof q.correct_option).toBe('number')
      expect(q.correct_option).toBeGreaterThanOrEqual(0)
      expect(q.correct_option).toBeLessThanOrEqual(3)
    })
  })

  test('cada pregunta tiene article y metadata', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeSuccessResponse(5))

    const result = await fetchPersonalizedQuestions(0, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })

    result.forEach((q: any) => {
      expect(q.article).toBeDefined()
      expect(q.article.law_short_name).toBeDefined()
      expect(q.metadata).toBeDefined()
      expect(q.metadata.difficulty).toBeDefined()
    })
  })
})

// ============================================
// 4. MANEJO DE ERRORES
// ============================================

describe('fetchPersonalizedQuestions — errores', () => {
  test('HTTP 429 lanza error descriptivo', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeErrorResponse(429, 'Demasiadas solicitudes. Espera un momento.'))

    await expect(
      fetchPersonalizedQuestions(0, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('Demasiadas solicitudes')
  })

  test('HTTP 500 lanza error', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeErrorResponse(500, 'Error interno del servidor'))

    await expect(
      fetchPersonalizedQuestions(0, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('Error interno del servidor')
  })

  test('0 preguntas devueltas lanza error con emptyReason', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        questions: [],
        totalAvailable: 0,
        emptyReason: 'No hay contenido configurado para la oposición',
      }),
    })

    await expect(
      fetchPersonalizedQuestions(0, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('No hay')
  })

  test('network error se propaga', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(
      fetchPersonalizedQuestions(0, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('Failed to fetch')
  })

  test('JSON corrupto en respuesta de error se maneja', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => { throw new SyntaxError('Unexpected token') },
    })

    await expect(
      fetchPersonalizedQuestions(0, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('HTTP 502')
  })
})

// ============================================
// 5. SESSION CACHE (post-filter client-side)
// ============================================

describe('fetchPersonalizedQuestions — session cache', () => {
  test('segunda llamada excluye preguntas de la primera (no repite)', async () => {
    const firstBatch = Array.from({ length: 10 }, (_, i) => makeApiQuestion(`first-${i}`))
    const secondBatch = Array.from({ length: 10 }, (_, i) => makeApiQuestion(`second-${i}`))

    const mockFetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ success: true, questions: [...firstBatch, ...secondBatch], totalAvailable: 20 }),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ success: true, questions: [...secondBatch, ...firstBatch], totalAvailable: 20 }),
      })
    global.fetch = mockFetch

    const result1 = await fetchPersonalizedQuestions(0, { n: '10' }, { positionType: 'auxiliar_administrativo_estado' })
    const result2 = await fetchPersonalizedQuestions(0, { n: '10' }, { positionType: 'auxiliar_administrativo_estado' })

    const ids1 = new Set(result1.map((q: any) => q.id))
    const ids2 = new Set(result2.map((q: any) => q.id))

    const overlap = [...ids1].filter(id => ids2.has(id))
    expect(overlap).toHaveLength(0)
  })
})

// ============================================
// 6. SESSION CACHE AVANZADO
// ============================================

describe('fetchPersonalizedQuestions — session cache avanzado', () => {
  test('3 rondas consecutivas: ninguna pregunta se repite', async () => {
    // Generar 30 preguntas únicas, API devuelve todas en cada llamada
    const allQs = Array.from({ length: 30 }, (_, i) => makeApiQuestion(`all-${i}`))

    const mockFetch = jest.fn().mockImplementation(async () => ({
      ok: true, status: 200,
      json: async () => ({ success: true, questions: [...allQs], totalAvailable: 30 }),
    }))
    global.fetch = mockFetch

    const r1 = await fetchPersonalizedQuestions(0, { n: '10' }, { positionType: 'auxiliar_administrativo_estado' })
    const r2 = await fetchPersonalizedQuestions(0, { n: '10' }, { positionType: 'auxiliar_administrativo_estado' })
    const r3 = await fetchPersonalizedQuestions(0, { n: '10' }, { positionType: 'auxiliar_administrativo_estado' })

    const allIds = [...r1, ...r2, ...r3].map((q: any) => q.id)
    const uniqueIds = new Set(allIds)
    expect(uniqueIds.size).toBe(30)
    expect(allIds).toHaveLength(30)
  })

  test('session cache agotado: lanza error cuando no quedan preguntas nuevas', async () => {
    const fewQs = Array.from({ length: 5 }, (_, i) => makeApiQuestion(`few-${i}`))

    global.fetch = jest.fn().mockImplementation(async () => ({
      ok: true, status: 200,
      json: async () => ({ success: true, questions: [...fewQs], totalAvailable: 5 }),
    }))

    // Primera ronda: consume las 5
    await fetchPersonalizedQuestions(0, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })

    // Segunda ronda: no quedan preguntas fuera del cache
    await expect(
      fetchPersonalizedQuestions(0, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('No hay preguntas disponibles')
  })

  test('requestSize aumenta cuando hay preguntas en cache', async () => {
    const allQs = Array.from({ length: 20 }, (_, i) => makeApiQuestion(`req-${i}`))
    const mockFetch = jest.fn().mockImplementation(async () => ({
      ok: true, status: 200,
      json: async () => ({ success: true, questions: [...allQs], totalAvailable: 20 }),
    }))
    global.fetch = mockFetch

    // Primera ronda: n=5, cache vacío → requestSize = 5+0 = 5
    await fetchPersonalizedQuestions(0, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })
    const body1 = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body1.numQuestions).toBe(5)

    // Segunda ronda: n=5, cache tiene 5 → requestSize = 5+5 = 10
    await fetchPersonalizedQuestions(0, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })
    const body2 = JSON.parse(mockFetch.mock.calls[1][1].body)
    expect(body2.numQuestions).toBe(10)
  })
})

// ============================================
// 7. PARÁMETROS AVANZADOS
// ============================================

describe('fetchPersonalizedQuestions — parámetros avanzados', () => {
  test('con tema > 0 pasa topicNumber correcto', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchPersonalizedQuestions(7, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.topicNumber).toBe(7)
  })

  test('dificultad easy se pasa correctamente', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(10))
    global.fetch = mockFetch

    await fetchPersonalizedQuestions(0, { n: '10', difficulty_mode: 'easy' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.difficultyMode).toBe('easy')
  })

  test('dificultad extreme se pasa correctamente', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(10))
    global.fetch = mockFetch

    await fetchPersonalizedQuestions(0, { n: '10', difficulty_mode: 'extreme' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.difficultyMode).toBe('extreme')
  })

  test('excludeRecentDays=0 cuando exclude_recent es false', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(10))
    global.fetch = mockFetch

    await fetchPersonalizedQuestions(0, { n: '10', exclude_recent: 'false' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.excludeRecentDays).toBe(0)
  })

  test('recent_days custom (30) se pasa cuando exclude_recent=true', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(10))
    global.fetch = mockFetch

    await fetchPersonalizedQuestions(0, { n: '10', exclude_recent: 'true', recent_days: '30' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.excludeRecentDays).toBe(30)
  })

  test('API devuelve menos preguntas de las pedidas — funciona sin error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        success: true,
        questions: Array.from({ length: 8 }, (_, i) => makeApiQuestion(`short-${i}`)),
        totalAvailable: 8,
      }),
    })

    const result = await fetchPersonalizedQuestions(0, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })
    expect(result).toHaveLength(8)
  })

  test('positionType para diferentes oposiciones', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(10))
    global.fetch = mockFetch

    const oposiciones = [
      'auxiliar_administrativo_estado',
      'auxiliar_administrativo_madrid',
      'auxiliar_administrativo_cyl',
      'tramitacion_procesal',
    ]

    for (const pos of oposiciones) {
      mockFetch.mockClear()
      clearAllSessionQuestionCache()
      await fetchPersonalizedQuestions(0, { n: '10' }, { positionType: pos })
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.positionType).toBe(pos)
    }
  })
})

// ============================================
// 8. AUTH EDGE CASES
// ============================================

describe('fetchPersonalizedQuestions — auth edge cases', () => {
  test('getSession lanza error pero getUser ok → funciona sin Bearer', async () => {
    mockAuthFns.getSession.mockRejectedValue(new Error('Session expired'))
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(10))
    global.fetch = mockFetch

    await fetchPersonalizedQuestions(0, { n: '10' }, { positionType: 'auxiliar_administrativo_estado' })

    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers['Authorization']).toBeUndefined()
  })

  test('getUser lanza error → lanza error de auth (no llama API)', async () => {
    mockAuthFns.getUser.mockRejectedValue(new Error('Network error'))
    const mockFetch = jest.fn()
    global.fetch = mockFetch

    await expect(
      fetchPersonalizedQuestions(0, { n: '10' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow()

    expect(mockFetch).not.toHaveBeenCalled()
  })
})

// ============================================
// 9. PREGUNTAS CON CONTENIDO ESPECIAL
// ============================================

describe('fetchPersonalizedQuestions — contenido especial', () => {
  test('preguntas con image_url se pasan correctamente', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        success: true,
        questions: [makeApiQuestion('img-1', { image_url: 'https://cdn.example.com/img.png' })],
        totalAvailable: 1,
      }),
    })

    const result = await fetchPersonalizedQuestions(0, { n: '1' }, { positionType: 'auxiliar_administrativo_estado' })
    expect((result[0] as any).image_url).toBe('https://cdn.example.com/img.png')
  })

  test('preguntas con content_data (psicotécnicos) se pasan correctamente', async () => {
    const contentData = { type: 'sequence', items: [1, 2, 3, '?'] }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        success: true,
        questions: [makeApiQuestion('cd-1', { content_data: contentData })],
        totalAvailable: 1,
      }),
    })

    const result = await fetchPersonalizedQuestions(0, { n: '1' }, { positionType: 'auxiliar_administrativo_estado' })
    expect((result[0] as any).content_data).toEqual(contentData)
  })
})

// ============================================
// 10. COMPATIBILIDAD CON TESTLAYOUT
// ============================================

describe('fetchPersonalizedQuestions — TestLayout compatibility', () => {
  test('devuelve campo "question" (no "question_text")', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeSuccessResponse(5))

    const result = await fetchPersonalizedQuestions(0, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })

    result.forEach((q: any) => {
      expect(q).toHaveProperty('question')
      expect(q).not.toHaveProperty('question_text')
    })
  })

  test('options es array de 4 strings', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeSuccessResponse(5))

    const result = await fetchPersonalizedQuestions(0, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })

    result.forEach((q: any) => {
      expect(q.options).toHaveLength(4)
      q.options.forEach((o: string) => expect(typeof o).toBe('string'))
    })
  })

  test('article.display_number tiene formato "Art. X Ley"', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeSuccessResponse(5))

    const result = await fetchPersonalizedQuestions(0, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })

    result.forEach((q: any) => {
      expect(q.article.display_number).toMatch(/Art\.\s/)
    })
  })
})
