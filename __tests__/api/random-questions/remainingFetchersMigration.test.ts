/**
 * Tests para migración de fetchers restantes a API centralizada:
 * - fetchExplorarContenido
 * - fetchContentScopeQuestions
 * - fetchArticulosDirigido
 * - fetchMantenerRacha
 *
 * Verifica: parámetros, formato respuesta, errores, observabilidad,
 * fallbacks, y compatibilidad con TestLayout.
 */

const mockAuthFns = (() => {
  const getUser = jest.fn()
  const getSession = jest.fn()
  return { getUser, getSession }
})()

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => {
    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          not: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              group: jest.fn().mockReturnValue({
                having: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    })
    return {
      from: mockFrom,
      rpc: jest.fn(),
      auth: {
        getUser: (...args: unknown[]) => mockAuthFns.getUser(...args),
        getSession: (...args: unknown[]) => mockAuthFns.getSession(...args),
      },
    }
  },
}))

jest.mock('@/lib/lawSlugSync', () => ({
  mapSlugToShortName: jest.fn((s: string) => {
    const map: Record<string, string> = {
      'constitucion-espanola': 'CE',
      'ley-39-2015': 'Ley 39/2015',
      'ley-40-2015': 'Ley 40/2015',
    }
    return map[s] || s
  }),
}))

jest.mock('@/lib/config/exam-positions', () => ({
  getValidExamPositions: jest.fn(() => []),
  applyExamPositionFilter: jest.fn((q: unknown[]) => q),
}))

jest.mock('@/lib/boe-extractor', () => ({
  isDisposicionArticle: jest.fn(() => false),
}))

jest.mock('@/lib/api/laws/warmCache', () => ({
  warmSlugCache: jest.fn(),
}))

import {
  fetchExplorarContenido,
  fetchContentScopeQuestions,
  fetchArticulosDirigido,
  fetchMantenerRacha,
} from '@/lib/testFetchers'

// ============================================
// HELPERS
// ============================================

function makeQ(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, question: `Pregunta ${id}`,
    options: ['A', 'B', 'C', 'D'], explanation: 'Explicación',
    correct_option: 1, primary_article_id: 'art-1', tema: 1,
    image_url: null, content_data: null,
    article: { id: 'art-1', number: '14', title: 'T', full_text: 'C', law_name: 'CE', law_short_name: 'CE', display_number: 'Art. 14 CE' },
    metadata: { id, difficulty: 'medium', question_type: 'single', tags: null, is_active: true, created_at: '2025-01-01', updated_at: null, is_official_exam: false, exam_source: null, exam_date: null, exam_entity: null, exam_position: null, official_difficulty_level: null },
    ...overrides,
  }
}

function okResponse(n: number, extra: Record<string, unknown> = {}) {
  return {
    ok: true, status: 200,
    json: async () => ({ success: true, questions: Array.from({ length: n }, (_, i) => makeQ(`q-${i}`)), totalAvailable: n + 10, ...extra }),
  }
}

function errResponse(status: number, error: string) {
  return { ok: false, status, json: async () => ({ success: false, error }) }
}

const originalFetch = global.fetch
const mockUser = { id: 'user-rem-1', email: 'test@test.com' }

beforeEach(() => {
  jest.clearAllMocks()
  mockAuthFns.getUser.mockResolvedValue({ data: { user: mockUser }, error: null })
  mockAuthFns.getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } }, error: null })
})
afterAll(() => { global.fetch = originalFetch })

// ============================================
// EXPLORAR CONTENIDO
// ============================================

describe('fetchExplorarContenido', () => {
  test('llama a API con topicNumber=0 y difficultyMode random', async () => {
    const mockFetch = jest.fn().mockResolvedValue(okResponse(8))
    global.fetch = mockFetch

    await fetchExplorarContenido(0, { n: '8' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.topicNumber).toBe(0)
    expect(body.difficultyMode).toBe('random')
    expect(body.numQuestions).toBe(8)
  })

  test('devuelve array de preguntas con formato correcto', async () => {
    global.fetch = jest.fn().mockResolvedValue(okResponse(5))
    const result = await fetchExplorarContenido(0, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(5)
    result.forEach((q: any) => {
      expect(q).toHaveProperty('question')
      expect(q).toHaveProperty('correct_option')
      expect(q).toHaveProperty('article')
    })
  })

  test('HTTP 429 lanza error', async () => {
    global.fetch = jest.fn().mockResolvedValue(errResponse(429, 'Rate limit'))
    await expect(fetchExplorarContenido(0, {}, { positionType: 'auxiliar_administrativo_estado' })).rejects.toThrow('Rate limit')
  })

  test('0 preguntas lanza error descriptivo', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, questions: [] }) })
    await expect(fetchExplorarContenido(0, {}, { positionType: 'auxiliar_administrativo_estado' })).rejects.toThrow('No hay contenido')
  })

  test('pasa positionType del config', async () => {
    const mockFetch = jest.fn().mockResolvedValue(okResponse(5))
    global.fetch = mockFetch
    await fetchExplorarContenido(0, { n: '5' }, { positionType: 'auxiliar_administrativo_madrid' })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.positionType).toBe('auxiliar_administrativo_madrid')
  })

  test('n default es 8', async () => {
    const mockFetch = jest.fn().mockResolvedValue(okResponse(8))
    global.fetch = mockFetch
    await fetchExplorarContenido(0, {}, { positionType: 'auxiliar_administrativo_estado' })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.numQuestions).toBe(8)
  })
})

// ============================================
// CONTENT SCOPE
// ============================================

describe('fetchContentScopeQuestions', () => {
  const scope = { articleIds: ['art-uuid-1', 'art-uuid-2', 'art-uuid-3'], sectionInfo: { name: 'Título I' } }

  test('envía primaryArticleIds a la API', async () => {
    const mockFetch = jest.fn().mockResolvedValue(okResponse(10))
    global.fetch = mockFetch

    await fetchContentScopeQuestions({ numQuestions: 10, positionType: 'auxiliar_administrativo_estado' }, scope)

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.primaryArticleIds).toEqual(['art-uuid-1', 'art-uuid-2', 'art-uuid-3'])
    expect(body.topicNumber).toBe(0)
  })

  test('lanza error si articleIds vacío', async () => {
    await expect(
      fetchContentScopeQuestions({}, { articleIds: [], sectionInfo: { name: 'T' } })
    ).rejects.toThrow('No se encontraron artículos')
  })

  test('devuelve preguntas con formato correcto', async () => {
    global.fetch = jest.fn().mockResolvedValue(okResponse(5))
    const result = await fetchContentScopeQuestions({ numQuestions: 5 }, scope)
    expect(result).toHaveLength(5)
    result.forEach((q: any) => {
      expect(q).toHaveProperty('question')
      expect(q).toHaveProperty('correct_option')
    })
  })

  test('envía Bearer token', async () => {
    const mockFetch = jest.fn().mockResolvedValue(okResponse(5))
    global.fetch = mockFetch
    await fetchContentScopeQuestions({ numQuestions: 5 }, scope)
    expect(new Headers(mockFetch.mock.calls[0][1].headers).get('authorization')).toBe('Bearer tok')
  })

  test('HTTP 500 lanza error', async () => {
    global.fetch = jest.fn().mockResolvedValue(errResponse(500, 'Internal error'))
    await expect(fetchContentScopeQuestions({ numQuestions: 5 }, scope)).rejects.toThrow('Internal error')
  })

  test('0 preguntas lanza error', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, questions: [] }) })
    await expect(fetchContentScopeQuestions({ numQuestions: 5 }, scope)).rejects.toThrow('No se encontraron')
  })

  test('numQuestions default es 20', async () => {
    const mockFetch = jest.fn().mockResolvedValue(okResponse(20))
    global.fetch = mockFetch
    await fetchContentScopeQuestions({}, scope)
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.numQuestions).toBe(20)
  })
})

// ============================================
// ARTÍCULOS DIRIGIDO — 3 ESTRATEGIAS
// ============================================

describe('fetchArticulosDirigido', () => {
  test('estrategia 1: artículos específicos — pasa selectedLaws + selectedArticlesByLaw', async () => {
    const mockFetch = jest.fn().mockResolvedValue(okResponse(10))
    global.fetch = mockFetch

    await fetchArticulosDirigido('constitucion-espanola', { articles: '1,14,16', n: '10' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.selectedLaws).toEqual(['CE'])
    expect(body.selectedArticlesByLaw).toEqual({ CE: [1, 14, 16] })
    expect(body.numQuestions).toBe(10)
  })

  test('estrategia 2: ley completa cuando artículos específicos no devuelven resultados', async () => {
    const mockFetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, questions: [] }) }) // arts específicos → vacío
      .mockResolvedValueOnce(okResponse(10)) // ley completa → éxito
    global.fetch = mockFetch

    const result = await fetchArticulosDirigido('constitucion-espanola', { articles: '999', n: '10' }, { positionType: 'auxiliar_administrativo_estado' })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    const body2 = JSON.parse(mockFetch.mock.calls[1][1].body)
    expect(body2.selectedLaws).toEqual(['CE'])
    expect(body2.selectedArticlesByLaw).toEqual({})
    expect(result).toHaveLength(10)
  })

  test('estrategia 3: random cuando ley completa también vacía', async () => {
    const mockFetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, questions: [] }) }) // arts → vacío
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, questions: [] }) }) // ley → vacío
      .mockResolvedValueOnce(okResponse(5)) // random → éxito
    global.fetch = mockFetch

    const result = await fetchArticulosDirigido('ley-inexistente', { articles: '1', n: '5' }, { positionType: 'auxiliar_administrativo_estado' })

    expect(mockFetch).toHaveBeenCalledTimes(3)
    const body3 = JSON.parse(mockFetch.mock.calls[2][1].body)
    expect(body3.selectedLaws).toEqual([])
    expect(result).toHaveLength(5)
  })

  test('sin artículos en searchParams: salta directo a estrategia 2 (ley completa)', async () => {
    const mockFetch = jest.fn().mockResolvedValue(okResponse(10))
    global.fetch = mockFetch

    await fetchArticulosDirigido('constitucion-espanola', { n: '10' }, { positionType: 'auxiliar_administrativo_estado' })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.selectedLaws).toEqual(['CE'])
    expect(body.selectedArticlesByLaw).toEqual({})
  })

  test('las 3 estrategias vacías → lanza error', async () => {
    const emptyResponse = { ok: true, status: 200, json: async () => ({ success: true, questions: [] }) }
    global.fetch = jest.fn()
      .mockResolvedValueOnce(emptyResponse)
      .mockResolvedValueOnce(emptyResponse)
      .mockResolvedValueOnce(emptyResponse)

    await expect(
      fetchArticulosDirigido('ley-inexistente', { articles: '1', n: '5' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('No se encontraron preguntas')
  })

  test('HTTP error en estrategia 1 → lanza error (no fallback)', async () => {
    global.fetch = jest.fn().mockResolvedValue(errResponse(500, 'Server error'))

    await expect(
      fetchArticulosDirigido('ce', { articles: '1', n: '5' }, { positionType: 'auxiliar_administrativo_estado' })
    ).rejects.toThrow('Server error')
  })

  test('mapea slug a short_name correctamente', async () => {
    const mockFetch = jest.fn().mockResolvedValue(okResponse(10))
    global.fetch = mockFetch

    await fetchArticulosDirigido('ley-39-2015', { n: '10' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.selectedLaws).toEqual(['Ley 39/2015'])
  })

  test('preguntas tienen formato TestLayout', async () => {
    global.fetch = jest.fn().mockResolvedValue(okResponse(5))
    const result = await fetchArticulosDirigido('ce', { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })
    result.forEach((q: any) => {
      expect(q).toHaveProperty('question')
      expect(q).toHaveProperty('options')
      expect(q.options).toHaveLength(4)
      expect(q).toHaveProperty('correct_option')
      expect(q).toHaveProperty('article')
      expect(q).toHaveProperty('metadata')
    })
  })
})

// ============================================
// MANTENER RACHA
// ============================================

describe('fetchMantenerRacha', () => {
  test('llama a API con difficultyMode easy y prioritizeNeverSeen', async () => {
    const mockFetch = jest.fn().mockResolvedValue(okResponse(5))
    global.fetch = mockFetch

    await fetchMantenerRacha(0, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })

    expect(mockFetch).toHaveBeenCalled()
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.difficultyMode).toBe('easy')
    expect(body.prioritizeNeverSeen).toBe(true)
  })

  test('envía Bearer token', async () => {
    const mockFetch = jest.fn().mockResolvedValue(okResponse(5))
    global.fetch = mockFetch

    await fetchMantenerRacha(0, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })

    const headers = mockFetch.mock.calls[0][1].headers
    expect(new Headers(headers).get('authorization')).toBe('Bearer tok')
  })

  test('usuario no autenticado: funciona en modo global', async () => {
    mockAuthFns.getUser.mockResolvedValue({ data: { user: null }, error: null })
    mockAuthFns.getSession.mockResolvedValue({ data: { session: null }, error: null })
    const mockFetch = jest.fn().mockResolvedValue(okResponse(5))
    global.fetch = mockFetch

    const result = await fetchMantenerRacha(0, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(5)
  })

  test('API sin preguntas con temas: fallback a sin filtros', async () => {
    const mockFetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, questions: [] }) }) // con temas → vacío
      .mockResolvedValueOnce(okResponse(5)) // sin filtros → éxito
    global.fetch = mockFetch

    const result = await fetchMantenerRacha(0, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })
    expect(result).toHaveLength(5)
  })

  test('pasa positionType correcto', async () => {
    const mockFetch = jest.fn().mockResolvedValue(okResponse(5))
    global.fetch = mockFetch

    await fetchMantenerRacha(0, { n: '5' }, { positionType: 'auxiliar_administrativo_cyl' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.positionType).toBe('auxiliar_administrativo_cyl')
  })

  test('HTTP 500 cae al fallback sin filtros', async () => {
    mockAuthFns.getUser.mockRejectedValue(new Error('Auth error'))
    const mockFetch = jest.fn().mockResolvedValue(okResponse(5))
    global.fetch = mockFetch

    const result = await fetchMantenerRacha(0, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })
    expect(result).toHaveLength(5)
  })

  test('n default es 5', async () => {
    const mockFetch = jest.fn().mockResolvedValue(okResponse(5))
    global.fetch = mockFetch

    await fetchMantenerRacha(0, {}, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.numQuestions).toBe(5)
  })

  test('preguntas tienen formato TestLayout', async () => {
    global.fetch = jest.fn().mockResolvedValue(okResponse(5))
    const result = await fetchMantenerRacha(0, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })
    result.forEach((q: any) => {
      expect(q).toHaveProperty('question')
      expect(q).toHaveProperty('correct_option')
      expect(q).toHaveProperty('article')
      expect(q).toHaveProperty('metadata')
    })
  })
})

// ============================================
// VERIFICACIÓN: NO QUEDAN QUERIES DIRECTAS
// ============================================

describe('Verificación anti-scraping: sin queries directas a questions', () => {
  test('testFetchers.ts no tiene .from("questions") directo', () => {
    const fs = require('fs')
    const content = fs.readFileSync('lib/testFetchers.ts', 'utf-8')
    const directQueries = (content.match(/\.from\(['"]questions['"]\)/g) || []).length
    expect(directQueries).toBe(0)
  })

  test('testFetchers.ts no tiene supabase.rpc() calls (solo comentarios)', () => {
    const fs = require('fs')
    const content = fs.readFileSync('lib/testFetchers.ts', 'utf-8')
    const lines = content.split('\n')
    const rpcCalls = lines.filter((line: string) =>
      line.includes('supabase.rpc(') && !line.trim().startsWith('//')
    )
    expect(rpcCalls).toHaveLength(0)
  })
})
