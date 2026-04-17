/**
 * Tests para la migración de fetchQuestionsByTopicScope: de Supabase directo
 * a /api/questions/filtered (Drizzle + Zod).
 *
 * fetchQuestionsByTopicScope se usa para: tema > 0 + testType !== 'personalizado'
 * Es el fetcher principal para usuarios logueados con tema específico.
 *
 * Tiene dos modos:
 * - Normal: devuelve TransformedQuestion[] (migración directa a API)
 * - Adaptativo: necesita catálogo completo agrupado por dificultad × historial
 *   → pide todas las preguntas y construye el catálogo client-side
 */

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

import { fetchQuestionsByTopicScope } from '@/lib/testFetchers'

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
    tema: 3,
    image_url: null,
    content_data: null,
    article: {
      id: 'art-1',
      number: '14',
      title: 'Título',
      full_text: 'Contenido',
      law_name: 'CE',
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

function makeSuccessResponse(numQuestions: number, overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      questions: Array.from({ length: numQuestions }, (_, i) => makeApiQuestion(`q-${i}`)),
      totalAvailable: numQuestions + 50,
      filtersApplied: { laws: 3, articles: 0, sections: 0 },
      ...overrides,
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
const mockUser = { id: 'user-scope-123', email: 'test@test.com' }
const mockToken = 'mock-access-token-scope'

beforeEach(() => {
  jest.clearAllMocks()
  mockAuthFns.getUser.mockResolvedValue({ data: { user: mockUser }, error: null })
  mockAuthFns.getSession.mockResolvedValue({
    data: { session: { access_token: mockToken } },
    error: null,
  })
})

afterAll(() => {
  global.fetch = originalFetch
})

// ============================================
// 1. FLUJO NORMAL (NO ADAPTATIVO)
// ============================================

describe('fetchQuestionsByTopicScope — flujo normal', () => {
  test('llama a /api/questions/filtered con POST', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchQuestionsByTopicScope(5, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/questions/filtered')
    expect(options.method).toBe('POST')
  })

  test('pasa topicNumber del tema', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchQuestionsByTopicScope(12, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.topicNumber).toBe(12)
  })

  test('devuelve array de TransformedQuestion (no AdaptiveResult)', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))

    const result = await fetchQuestionsByTopicScope(5, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })

    expect(Array.isArray(result)).toBe(true)
    expect(result).not.toHaveProperty('isAdaptive')
    expect(result).toHaveLength(25)
  })

  test('envía Bearer token para activar filtros de usuario', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchQuestionsByTopicScope(5, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })

    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers['Authorization']).toBe(`Bearer ${mockToken}`)
  })

  test('funciona sin usuario autenticado (anónimo)', async () => {
    mockAuthFns.getUser.mockResolvedValue({ data: { user: null }, error: null })
    mockAuthFns.getSession.mockResolvedValue({ data: { session: null }, error: null })
    global.fetch = jest.fn().mockResolvedValue(makeSuccessResponse(10))

    const result = await fetchQuestionsByTopicScope(5, { n: '10' }, { positionType: 'auxiliar_administrativo_estado' })
    expect(Array.isArray(result)).toBe(true)
  })
})

// ============================================
// 2. PARÁMETROS COMPLETOS
// ============================================

describe('fetchQuestionsByTopicScope — parámetros', () => {
  test('pasa selectedLaws desde config', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchQuestionsByTopicScope(5, { n: '25' }, {
      positionType: 'auxiliar_administrativo_estado',
      selectedLaws: ['CE', 'Ley 39/2015'],
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.selectedLaws).toEqual(['CE', 'Ley 39/2015'])
  })

  test('pasa selectedArticlesByLaw desde config', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchQuestionsByTopicScope(5, { n: '25' }, {
      positionType: 'auxiliar_administrativo_estado',
      selectedArticlesByLaw: { 'CE': [1, 2, 14] },
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.selectedArticlesByLaw).toEqual({ 'CE': [1, 2, 14] })
  })

  test('pasa selectedSectionFilters desde config', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    const sections = [{ title: 'Título Preliminar', articleRange: { start: 1, end: 9 } }]
    await fetchQuestionsByTopicScope(5, { n: '25' }, {
      positionType: 'auxiliar_administrativo_estado',
      selectedSectionFilters: sections,
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.selectedSectionFilters).toEqual(sections)
  })

  test('pasa onlyOfficialQuestions', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchQuestionsByTopicScope(5, { only_official: 'true', n: '25' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.onlyOfficialQuestions).toBe(true)
  })

  test('pasa difficultyMode', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchQuestionsByTopicScope(5, { difficulty_mode: 'hard', n: '25' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.difficultyMode).toBe('hard')
  })

  test('pasa excludeRecentDays cuando exclude_recent=true', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchQuestionsByTopicScope(5, { exclude_recent: 'true', recent_days: '20', n: '25' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.excludeRecentDays).toBe(20)
  })

  test('pasa focusEssentialArticles', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchQuestionsByTopicScope(5, { focus_essential: 'true', n: '25' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.focusEssentialArticles).toBe(true)
  })

  test('pasa onlyFailedQuestions + failedQuestionIds', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(5))
    global.fetch = mockFetch

    const failedIds = ['id-1', 'id-2', 'id-3']
    await fetchQuestionsByTopicScope(5, { n: '25' }, {
      positionType: 'auxiliar_administrativo_estado',
      onlyFailedQuestions: true,
      failedQuestionIds: failedIds,
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.onlyFailedQuestions).toBe(true)
    expect(body.failedQuestionIds).toEqual(failedIds)
  })

  test('pasa prioritizeNeverSeen=true por defecto', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchQuestionsByTopicScope(5, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.prioritizeNeverSeen).toBe(true)
  })

  test('positionType para diferentes oposiciones', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(10))
    global.fetch = mockFetch

    for (const pos of ['auxiliar_administrativo_estado', 'auxiliar_administrativo_cyl', 'tramitacion_procesal']) {
      mockFetch.mockClear()
      await fetchQuestionsByTopicScope(5, { n: '10' }, { positionType: pos })
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.positionType).toBe(pos)
    }
  })
})

// ============================================
// 3. MODO ADAPTATIVO
// ============================================

describe('fetchQuestionsByTopicScope — modo adaptativo', () => {
  test('con adaptive=true devuelve estructura AdaptiveResult', async () => {
    // Para adaptativo, pide muchas preguntas con metadata de dificultad
    const questions = [
      ...Array.from({ length: 20 }, (_, i) => makeApiQuestion(`med-${i}`, { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'medium' } })),
      ...Array.from({ length: 10 }, (_, i) => makeApiQuestion(`easy-${i}`, { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'easy' } })),
    ]
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, questions, totalAvailable: 30 }),
    })

    const result = await fetchQuestionsByTopicScope(5, { n: '25', adaptive: 'true' }, { positionType: 'auxiliar_administrativo_estado' })

    expect(result).toHaveProperty('isAdaptive', true)
    const adaptive = result as any
    expect(adaptive.activeQuestions).toBeDefined()
    expect(adaptive.adaptiveCatalog).toBeDefined()
    expect(adaptive.adaptiveCatalog.neverSeen).toBeDefined()
    expect(adaptive.adaptiveCatalog.answered).toBeDefined()
  })

  test('adaptiveCatalog tiene 4 niveles de dificultad', async () => {
    const questions = [
      ...Array.from({ length: 5 }, (_, i) => makeApiQuestion(`e-${i}`, { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'easy' } })),
      ...Array.from({ length: 5 }, (_, i) => makeApiQuestion(`m-${i}`, { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'medium' } })),
      ...Array.from({ length: 5 }, (_, i) => makeApiQuestion(`h-${i}`, { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'hard' } })),
      ...Array.from({ length: 5 }, (_, i) => makeApiQuestion(`x-${i}`, { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'extreme' } })),
    ]
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, questions, totalAvailable: 20 }),
    })

    const result = await fetchQuestionsByTopicScope(5, { n: '10', adaptive: 'true' }, { positionType: 'auxiliar_administrativo_estado' }) as any

    const catalog = result.adaptiveCatalog
    expect(catalog.neverSeen).toHaveProperty('easy')
    expect(catalog.neverSeen).toHaveProperty('medium')
    expect(catalog.neverSeen).toHaveProperty('hard')
    expect(catalog.neverSeen).toHaveProperty('extreme')
    expect(catalog.answered).toHaveProperty('easy')
    expect(catalog.answered).toHaveProperty('medium')
    expect(catalog.answered).toHaveProperty('hard')
    expect(catalog.answered).toHaveProperty('extreme')
  })

  test('sin adaptive=true devuelve array plano', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))

    const result = await fetchQuestionsByTopicScope(5, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })

    expect(Array.isArray(result)).toBe(true)
    expect(result).not.toHaveProperty('isAdaptive')
  })
})

// ============================================
// 4. MANEJO DE ERRORES
// ============================================

describe('fetchQuestionsByTopicScope — errores', () => {
  test('HTTP 429 lanza error', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeErrorResponse(429, 'Demasiadas solicitudes. Espera un momento.'))

    await expect(
      fetchQuestionsByTopicScope(5, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('Demasiadas solicitudes')
  })

  test('HTTP 500 lanza error', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeErrorResponse(500, 'Error interno del servidor'))

    await expect(
      fetchQuestionsByTopicScope(5, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('Error interno del servidor')
  })

  test('0 preguntas con emptyReason', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, questions: [], totalAvailable: 0, emptyReason: 'No hay preguntas para tema 99' }),
    })

    await expect(
      fetchQuestionsByTopicScope(99, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('No hay preguntas')
  })

  test('network error se propaga', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(
      fetchQuestionsByTopicScope(5, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('Failed to fetch')
  })

  test('JSON corrupto se maneja', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 502,
      json: async () => { throw new SyntaxError('Unexpected token') },
    })

    await expect(
      fetchQuestionsByTopicScope(5, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('HTTP 502')
  })
})

// ============================================
// 5. COMPATIBILIDAD CON TESTLAYOUT
// ============================================

describe('fetchQuestionsByTopicScope — TestLayout compatibility', () => {
  test('modo normal: preguntas tienen todos los campos para TestLayout', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeSuccessResponse(5))

    const result = await fetchQuestionsByTopicScope(5, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' }) as any[]

    result.forEach(q => {
      expect(q).toHaveProperty('id')
      expect(q).toHaveProperty('question')
      expect(q).toHaveProperty('options')
      expect(q).toHaveProperty('correct_option')
      expect(q).toHaveProperty('article')
      expect(q).toHaveProperty('metadata')
      expect(q.options).toHaveLength(4)
    })
  })

  test('modo adaptativo: activeQuestions tienen formato correcto', async () => {
    const questions = Array.from({ length: 30 }, (_, i) =>
      makeApiQuestion(`compat-${i}`, { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'medium' } })
    )
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, questions, totalAvailable: 30 }),
    })

    const result = await fetchQuestionsByTopicScope(5, { n: '10', adaptive: 'true' }, { positionType: 'auxiliar_administrativo_estado' }) as any

    result.activeQuestions.forEach((q: any) => {
      expect(q).toHaveProperty('id')
      expect(q).toHaveProperty('question')
      expect(q).toHaveProperty('correct_option')
      expect(q).toHaveProperty('article')
    })
  })
})

// ============================================
// 6. EDGE CASES
// ============================================

describe('fetchQuestionsByTopicScope — edge cases', () => {
  test('API devuelve menos preguntas de las pedidas', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeSuccessResponse(8))

    const result = await fetchQuestionsByTopicScope(5, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })
    expect((result as any[]).length).toBeLessThanOrEqual(25)
  })

  test('preguntas con image_url se pasan', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        success: true,
        questions: [makeApiQuestion('img-1', { image_url: 'https://example.com/q.png' })],
        totalAvailable: 1,
      }),
    })

    const result = await fetchQuestionsByTopicScope(5, { n: '1' }, { positionType: 'auxiliar_administrativo_estado' }) as any[]
    expect(result[0].image_url).toBe('https://example.com/q.png')
  })

  test('getSession falla pero funciona sin Bearer', async () => {
    mockAuthFns.getSession.mockRejectedValue(new Error('Session expired'))
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(10))
    global.fetch = mockFetch

    await fetchQuestionsByTopicScope(5, { n: '10' }, { positionType: 'auxiliar_administrativo_estado' })

    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers['Authorization']).toBeUndefined()
  })
})
