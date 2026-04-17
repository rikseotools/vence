/**
 * Test de integración para fetchRandomQuestions migrado a /api/questions/filtered.
 * Mockea global.fetch para verificar:
 * - Que llama al endpoint correcto con el body correcto
 * - Que devuelve preguntas en formato TransformedQuestion
 * - Que modo adaptativo parte el array correctamente
 * - Que errores HTTP se manejan con mensajes claros
 */

// Mock supabase ANTES de importar testFetchers
jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn(),
    rpc: jest.fn(),
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
  })),
}))

// Mock lawSlugSync
jest.mock('@/lib/lawSlugSync', () => ({
  mapSlugToShortName: jest.fn((s: string) => s),
}))

// Mock exam-positions
jest.mock('@/lib/config/exam-positions', () => ({
  getValidExamPositions: jest.fn(() => []),
  applyExamPositionFilter: jest.fn((q: unknown[]) => q),
}))

// Mock boe-extractor
jest.mock('@/lib/boe-extractor', () => ({
  isDisposicionArticle: jest.fn(() => false),
}))

import { fetchRandomQuestions } from '@/lib/testFetchers'

// ============================================
// HELPERS
// ============================================

function makeApiQuestion(id: string) {
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
  }
}

function makeSuccessResponse(numQuestions: number) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      questions: Array.from({ length: numQuestions }, (_, i) => makeApiQuestion(`q-${i}`)),
      totalAvailable: numQuestions + 100,
      filtersApplied: { laws: 5, articles: 0, sections: 0 },
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

beforeEach(() => {
  jest.clearAllMocks()
})

afterAll(() => {
  global.fetch = originalFetch
})

// ============================================
// TEST: FLUJO NORMAL
// ============================================

describe('fetchRandomQuestions — flujo normal', () => {
  test('llama a /api/questions/filtered con POST y body correcto', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchRandomQuestions(5, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/questions/filtered')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')

    const body = JSON.parse(options.body)
    expect(body.topicNumber).toBe(5)
    expect(body.positionType).toBe('auxiliar_administrativo_estado')
    expect(body.numQuestions).toBe(25)
    expect(body.difficultyMode).toBe('random')
    expect(body.selectedLaws).toEqual([])
  })

  test('devuelve array de preguntas con formato correcto', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeSuccessResponse(10))

    const result = await fetchRandomQuestions(3, { n: '10' }, { positionType: 'auxiliar_administrativo_estado' })

    expect(Array.isArray(result)).toBe(true)
    const questions = result as any[]
    expect(questions).toHaveLength(10)

    const q = questions[0]
    expect(q.id).toBeDefined()
    expect(q.question).toBeDefined()
    expect(q.options).toHaveLength(4)
    expect(typeof q.correct_option).toBe('number')
    expect(q.article).toBeDefined()
    expect(q.metadata).toBeDefined()
  })

  test('tema=0 pasa topicNumber=0 (modo global)', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchRandomQuestions(0, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.topicNumber).toBe(0)
  })

  test('positionType se hereda de config', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(10))
    global.fetch = mockFetch

    await fetchRandomQuestions(1, { n: '10' }, { positionType: 'auxiliar_administrativo_madrid' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.positionType).toBe('auxiliar_administrativo_madrid')
  })

  test('sin positionType en config usa default auxiliar_administrativo_estado', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(10))
    global.fetch = mockFetch

    await fetchRandomQuestions(1, { n: '10' }, {})

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.positionType).toBe('auxiliar_administrativo_estado')
  })
})

// ============================================
// TEST: MODO ADAPTATIVO
// ============================================

describe('fetchRandomQuestions — modo adaptativo', () => {
  test('pide el doble de preguntas y devuelve estructura adaptativa', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeSuccessResponse(50))

    const result = await fetchRandomQuestions(3, { n: '25', adaptive: 'true' }, { positionType: 'auxiliar_administrativo_estado' })

    expect(result).toHaveProperty('isAdaptive', true)
    const adaptive = result as any
    expect(adaptive.activeQuestions).toHaveLength(25)
    expect(adaptive.questionPool).toHaveLength(50)
    expect(adaptive.poolSize).toBe(50)
    expect(adaptive.requestedCount).toBe(25)
  })

  test('pide numQuestions*2 en el body de la API', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(50))
    global.fetch = mockFetch

    await fetchRandomQuestions(3, { n: '25', adaptive: 'true' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.numQuestions).toBe(50)
  })

  test('modo NO adaptativo devuelve array plano', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))

    const result = await fetchRandomQuestions(3, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })

    expect(Array.isArray(result)).toBe(true)
    expect(result).not.toHaveProperty('isAdaptive')
  })
})

// ============================================
// TEST: MANEJO DE ERRORES
// ============================================

describe('fetchRandomQuestions — errores', () => {
  test('HTTP 429 (rate limit) lanza error con mensaje del servidor', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeErrorResponse(429, 'Demasiadas solicitudes. Espera un momento.'))

    await expect(
      fetchRandomQuestions(1, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('Demasiadas solicitudes')
  })

  test('HTTP 400 (validación) lanza error con mensaje', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeErrorResponse(400, 'Parámetros inválidos'))

    await expect(
      fetchRandomQuestions(1, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('Parámetros inválidos')
  })

  test('HTTP 500 lanza error', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeErrorResponse(500, 'Error interno del servidor'))

    await expect(
      fetchRandomQuestions(1, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('Error interno del servidor')
  })

  test('API devuelve success=false con emptyReason lanza error descriptivo', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: false,
        error: null,
        emptyReason: 'No hay contenido configurado para la oposición "test_oposicion"',
      }),
    })

    await expect(
      fetchRandomQuestions(1, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('No hay contenido configurado')
  })

  test('API devuelve success=true pero 0 preguntas lanza error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        questions: [],
        totalAvailable: 0,
      }),
    })

    await expect(
      fetchRandomQuestions(1, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('No hay preguntas disponibles')
  })

  test('network error (fetch throws) se propaga', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(
      fetchRandomQuestions(1, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('Failed to fetch')
  })

  test('respuesta JSON corrupta se maneja sin crash', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => { throw new SyntaxError('Unexpected token') },
    })

    await expect(
      fetchRandomQuestions(1, { n: '25' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('HTTP 502')
  })
})

// ============================================
// TEST: SEARCHPARAMS PARSING
// ============================================

describe('fetchRandomQuestions — searchParams parsing', () => {
  test('lee n de URLSearchParams', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(15))
    global.fetch = mockFetch

    const params = new URLSearchParams('n=15')
    await fetchRandomQuestions(1, params, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.numQuestions).toBe(15)
  })

  test('lee n de objeto plano', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(30))
    global.fetch = mockFetch

    await fetchRandomQuestions(1, { n: '30' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.numQuestions).toBe(30)
  })

  test('sin n usa default 25', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchRandomQuestions(1, {}, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.numQuestions).toBe(25)
  })

  test('searchParams null usa default 25', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeSuccessResponse(25))
    global.fetch = mockFetch

    await fetchRandomQuestions(1, null, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.numQuestions).toBe(25)
  })
})
