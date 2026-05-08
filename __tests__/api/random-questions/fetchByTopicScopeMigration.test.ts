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

import { fetchQuestionsByTopicScope, invalidateHistoryCache } from '@/lib/testFetchers'

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
  // El historyCache de testFetchers es module-scoped (TTL 10 min) — sin invalidar
  // entre tests, el segundo test del modo adaptativo lee el answeredIds vacío
  // del primero y nunca consume el mock de fetch para /api/user/question-history,
  // resultando en catalog.answered vacío.
  invalidateHistoryCache(mockUser.id)
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
    const questions = [
      ...Array.from({ length: 20 }, (_, i) => makeApiQuestion(`med-${i}`, { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'medium' } })),
      ...Array.from({ length: 10 }, (_, i) => makeApiQuestion(`easy-${i}`, { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'easy' } })),
    ]
    const mockFetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, questions, totalAvailable: 30 }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, history: [] }) })
    global.fetch = mockFetch

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
    const mockFetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, questions, totalAvailable: 20 }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, history: [] }) })
    global.fetch = mockFetch

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
    const mockFetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, questions, totalAvailable: 30 }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, history: [] }) })
    global.fetch = mockFetch

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
// 6. MODO ADAPTATIVO AVANZADO
// ============================================

describe('fetchQuestionsByTopicScope — modo adaptativo avanzado', () => {
  test('focusWeakAreas=true activa modo adaptativo (pide 500)', async () => {
    const mockFetch = jest.fn()
      .mockResolvedValueOnce(makeSuccessResponse(100))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, history: [] }) })
    global.fetch = mockFetch

    await fetchQuestionsByTopicScope(5, { n: '25' }, {
      positionType: 'auxiliar_administrativo_estado',
      focusWeakAreas: true,
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.numQuestions).toBe(100) // min(25*4, 200) = 100
  })

  test('adaptive=true pide pool 4× numQuestions (max 200)', async () => {
    // Antes el pool era 500 fijo, ahora es Math.min(numQuestions * 4, 200).
    // Cambio en testFetchers.ts: "500 saturaba Supabase con queries pesadas".
    // Para n=25 → pool=100. Para n=60+ → pool=200 (capped).
    const mockFetch = jest.fn()
      .mockResolvedValueOnce(makeSuccessResponse(100))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, history: [] }) })
    global.fetch = mockFetch

    await fetchQuestionsByTopicScope(5, { n: '25', adaptive: 'true' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.numQuestions).toBe(100) // 25 * 4 = 100
  })

  test('adaptive=true cap del pool en 200 cuando numQuestions es grande', async () => {
    const mockFetch = jest.fn()
      .mockResolvedValueOnce(makeSuccessResponse(200))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, history: [] }) })
    global.fetch = mockFetch

    await fetchQuestionsByTopicScope(5, { n: '60', adaptive: 'true' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.numQuestions).toBe(200) // min(60*4, 200) = 200
  })

  test('modo adaptativo fuerza difficultyMode=random (ignora filtro de dificultad)', async () => {
    const mockFetch = jest.fn()
      .mockResolvedValueOnce(makeSuccessResponse(100))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, history: [] }) })
    global.fetch = mockFetch

    await fetchQuestionsByTopicScope(5, { n: '25', adaptive: 'true', difficulty_mode: 'hard' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.difficultyMode).toBe('random')
  })

  test('modo NO adaptativo respeta difficultyMode del searchParams', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchQuestionsByTopicScope(5, { n: '25', difficulty_mode: 'hard' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.difficultyMode).toBe('hard')
  })

  test('catálogo distribuye preguntas correctamente por dificultad', async () => {
    const questions = [
      ...Array.from({ length: 3 }, (_, i) => makeApiQuestion(`e-${i}`, { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'easy' } })),
      ...Array.from({ length: 7 }, (_, i) => makeApiQuestion(`m-${i}`, { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'medium' } })),
      ...Array.from({ length: 4 }, (_, i) => makeApiQuestion(`h-${i}`, { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'hard' } })),
      ...Array.from({ length: 2 }, (_, i) => makeApiQuestion(`x-${i}`, { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'extreme' } })),
    ]

    // Mock: dos llamadas fetch — primero la API de preguntas, luego la de historial
    const mockFetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ success: true, questions, totalAvailable: 16 }),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ success: true, history: [] }),
      })
    global.fetch = mockFetch

    const result = await fetchQuestionsByTopicScope(5, { n: '10', adaptive: 'true' }, { positionType: 'auxiliar_administrativo_estado' }) as any

    const catalog = result.adaptiveCatalog
    expect(catalog.neverSeen.easy).toHaveLength(3)
    expect(catalog.neverSeen.medium).toHaveLength(7)
    expect(catalog.neverSeen.hard).toHaveLength(4)
    expect(catalog.neverSeen.extreme).toHaveLength(2)
    // Sin historial → answered vacío
    expect(catalog.answered.easy).toHaveLength(0)
    expect(catalog.answered.medium).toHaveLength(0)
  })

  test('catálogo clasifica answered correctamente cuando hay historial', async () => {
    // Pool (4) must be > numQuestions (3) for adaptive to activate (not bypass)
    const questions = [
      makeApiQuestion('seen-1', { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'easy' } }),
      makeApiQuestion('seen-2', { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'medium' } }),
      makeApiQuestion('new-1', { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'medium' } }),
      makeApiQuestion('new-2', { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'hard' } }),
    ]

    const mockFetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ success: true, questions, totalAvailable: 4 }),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({
          success: true,
          history: [
            { questionId: 'seen-1', lastAnsweredAt: '2025-01-01' },
            { questionId: 'seen-2', lastAnsweredAt: '2025-01-02' },
          ],
        }),
      })
    global.fetch = mockFetch

    // n=3 so pool(4) > numQuestions(3) → adaptive activates normally
    const result = await fetchQuestionsByTopicScope(5, { n: '3', adaptive: 'true' }, { positionType: 'auxiliar_administrativo_estado' }) as any

    const catalog = result.adaptiveCatalog
    expect(catalog.answered.easy).toHaveLength(1)
    expect(catalog.answered.medium).toHaveLength(1)
    expect(catalog.neverSeen.medium).toHaveLength(1)
    expect(catalog.neverSeen.hard).toHaveLength(1)
  })

  test('selección inicial prioriza medium > easy > hard', async () => {
    const questions = [
      ...Array.from({ length: 20 }, (_, i) => makeApiQuestion(`m-${i}`, { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'medium' } })),
      ...Array.from({ length: 10 }, (_, i) => makeApiQuestion(`e-${i}`, { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'easy' } })),
      ...Array.from({ length: 5 }, (_, i) => makeApiQuestion(`h-${i}`, { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'hard' } })),
    ]
    const mockFetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, questions, totalAvailable: 35 }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, history: [] }) })
    global.fetch = mockFetch

    const result = await fetchQuestionsByTopicScope(5, { n: '15', adaptive: 'true' }, { positionType: 'auxiliar_administrativo_estado' }) as any

    expect(result.activeQuestions).toHaveLength(15)
    const difficulties = result.activeQuestions.map((q: any) => q.metadata.difficulty)
    expect(difficulties.every((d: string) => d === 'medium')).toBe(true)
  })

  test('selección inicial con pocas medium: mezcla medium + easy', async () => {
    const questions = [
      ...Array.from({ length: 5 }, (_, i) => makeApiQuestion(`m-${i}`, { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'medium' } })),
      ...Array.from({ length: 15 }, (_, i) => makeApiQuestion(`e-${i}`, { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'easy' } })),
    ]
    const mockFetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, questions, totalAvailable: 20 }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, history: [] }) })
    global.fetch = mockFetch

    const result = await fetchQuestionsByTopicScope(5, { n: '10', adaptive: 'true' }, { positionType: 'auxiliar_administrativo_estado' }) as any

    expect(result.activeQuestions).toHaveLength(10)
    const difficulties = new Set(result.activeQuestions.map((q: any) => q.metadata.difficulty))
    expect(difficulties.has('medium')).toBe(true)
    expect(difficulties.has('easy')).toBe(true)
  })

  test('adaptativo con pocas preguntas: bypass devuelve array directo (no adaptivo)', async () => {
    // Pool (5) <= numQuestions (10) → bypass adaptativo, devuelve array directo
    // Bug fix: gaditadelgado@gmail.com — Outlook con 9 oficiales, adaptativo
    // filtraba a 3. Ahora devuelve todas sin catálogo.
    const questions = Array.from({ length: 5 }, (_, i) =>
      makeApiQuestion(`few-${i}`, { metadata: { ...makeApiQuestion('x').metadata, difficulty: 'hard' } })
    )
    const mockFetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, questions, totalAvailable: 5 }) })
    global.fetch = mockFetch

    const result = await fetchQuestionsByTopicScope(5, { n: '10', adaptive: 'true' }, { positionType: 'auxiliar_administrativo_estado' }) as any

    // Small pool bypass: returns plain array, not { isAdaptive, activeQuestions }
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(5)
  })
})

// ============================================
// 7. RESTRICTIVE MODE
// ============================================

describe('fetchQuestionsByTopicScope — restrictive mode', () => {
  test('focusEssentialArticles=true desactiva adaptativo (pide numQuestions, no 500)', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchQuestionsByTopicScope(5, { n: '25', adaptive: 'true', focus_essential: 'true' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.numQuestions).toBe(25)

    const result = await fetchQuestionsByTopicScope(5, { n: '25', focus_essential: 'true' }, { positionType: 'auxiliar_administrativo_estado' })
    expect(Array.isArray(result)).toBe(true)
  })

  test('onlyFailedQuestions=true desactiva adaptativo', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(10))
    global.fetch = mockFetch

    await fetchQuestionsByTopicScope(5, { n: '25', adaptive: 'true' }, {
      positionType: 'auxiliar_administrativo_estado',
      onlyFailedQuestions: true,
      failedQuestionIds: ['id-1', 'id-2'],
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.numQuestions).toBe(25)
  })
})

// ============================================
// 8. SEARCHPARAMS Y CONFIG EDGE CASES
// ============================================

describe('fetchQuestionsByTopicScope — params edge cases', () => {
  test('failedQuestionIds desde searchParams (JSON string)', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(5))
    global.fetch = mockFetch

    const ids = ['uuid-1', 'uuid-2']
    await fetchQuestionsByTopicScope(5, { n: '5', failed_question_ids: JSON.stringify(ids), only_failed: 'true' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.failedQuestionIds).toEqual(ids)
    expect(body.onlyFailedQuestions).toBe(true)
  })

  test('exclude_recent=true sin recent_days usa default 15', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchQuestionsByTopicScope(5, { n: '25', exclude_recent: 'true' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.excludeRecentDays).toBe(15)
  })

  test('selectedArticlesByLaw con strings se convierte a números', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchQuestionsByTopicScope(5, { n: '25' }, {
      positionType: 'auxiliar_administrativo_estado',
      selectedArticlesByLaw: { 'CE': ['1', '2', '14'] as any },
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.selectedArticlesByLaw['CE']).toEqual([1, 2, 14])
  })

  test('searchParams como URLSearchParams funciona', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(15))
    global.fetch = mockFetch

    const params = new URLSearchParams('n=15&difficulty_mode=easy')
    await fetchQuestionsByTopicScope(5, params, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.numQuestions).toBe(15)
    expect(body.difficultyMode).toBe('easy')
  })

  test('config vacío usa defaults', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchQuestionsByTopicScope(5, { n: '25' }, {})

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.positionType).toBe('auxiliar_administrativo_estado')
    expect(body.selectedLaws).toEqual([])
    expect(body.onlyFailedQuestions).toBe(false)
    expect(body.focusEssentialArticles).toBe(false)
  })

  test('numQuestions > preguntas disponibles: devuelve todas sin error', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeSuccessResponse(8))

    const result = await fetchQuestionsByTopicScope(5, { n: '50' }, { positionType: 'auxiliar_administrativo_estado' }) as any[]
    expect(result).toHaveLength(8)
  })

  test('preguntas con content_data se pasan correctamente', async () => {
    const cd = { type: 'chart', data: [1, 2, 3] }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        success: true,
        questions: [makeApiQuestion('cd-1', { content_data: cd })],
        totalAvailable: 1,
      }),
    })

    const result = await fetchQuestionsByTopicScope(5, { n: '1' }, { positionType: 'auxiliar_administrativo_estado' }) as any[]
    expect(result[0].content_data).toEqual(cd)
  })

  test('getUser falla → error se propaga (no llama a la API)', async () => {
    mockAuthFns.getUser.mockRejectedValue(new Error('Auth error'))
    const mockFetch = jest.fn()
    global.fetch = mockFetch

    await expect(
      fetchQuestionsByTopicScope(5, { n: '10' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('Auth error')
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

// ============================================
// 9. EDGE CASES
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
