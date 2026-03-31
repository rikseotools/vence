/**
 * Tests para fetchLawArticles - verifica optimizacion N+1
 *
 * Cuando mapLawSlugToShortName resuelve el slug correctamente,
 * NO debe hacer una query extra a laws para case-insensitive lookup.
 */

// Mock server-only (lanza error en cliente, necesita mock en tests)
jest.mock('server-only', () => ({}))

// Track which tables are queried
const queriedTables: string[] = []

// Per-table mocks (prefixed with mock so jest allows them in factory)
const mockLawsSingle = jest.fn()
const mockLawsLimit = jest.fn().mockReturnValue({ single: mockLawsSingle })
const mockLawsEq = jest.fn().mockReturnValue({ limit: mockLawsLimit })
const mockLawsOr = jest.fn().mockReturnValue({ eq: mockLawsEq })
const mockLawsSelect = jest.fn().mockReturnValue({ or: mockLawsOr, eq: mockLawsEq })

const mockArticlesOrder = jest.fn()
const mockArticlesNeq = jest.fn().mockReturnValue({ order: mockArticlesOrder })
const mockArticlesNot2 = jest.fn().mockReturnValue({ neq: mockArticlesNeq })
const mockArticlesNot1 = jest.fn().mockReturnValue({ not: mockArticlesNot2 })
const mockArticlesEq3 = jest.fn().mockReturnValue({ not: mockArticlesNot1 })
const mockArticlesEq2 = jest.fn().mockReturnValue({ eq: mockArticlesEq3 })
const mockArticlesEq1 = jest.fn().mockReturnValue({ eq: mockArticlesEq2 })
const mockArticlesSelect = jest.fn().mockReturnValue({ eq: mockArticlesEq1 })

// Mock supabase chain for loadSlugCache: .from('laws').select().eq().not()
const mockSlugCacheNot = jest.fn().mockResolvedValue({ data: [
  { slug: 'constitucion-espanola', short_name: 'CE' },
  { slug: 'ley-39-2015', short_name: 'Ley 39/2015' },
] })
const mockSlugCacheEq = jest.fn().mockReturnValue({ not: mockSlugCacheNot })
const mockSlugCacheSelect = jest.fn().mockReturnValue({ eq: mockSlugCacheEq })

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn((table: string) => {
      queriedTables.push(table)
      if (table === 'laws') {
        // Return different chain depending on what's being queried
        return {
          select: jest.fn((fields: string) => {
            // loadSlugCache query: .select('slug, short_name')
            if (fields === 'slug, short_name') {
              return { eq: mockSlugCacheEq }
            }
            // Other laws queries
            return mockLawsSelect(fields)
          })
        }
      }
      if (table === 'articles') return { select: mockArticlesSelect }
      return { select: jest.fn().mockReturnValue({}) }
    }),
  })),
}))

const mockMapSlug = jest.fn()
jest.mock('@/lib/lawSlugSync', () => ({
  mapSlugToShortName: (...args: unknown[]) => mockMapSlug(...args),
  generateSlug: jest.fn((s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
  getCanonicalSlug: jest.fn(),
}))

jest.mock('@/lib/api/laws/warmCache', () => ({
  warmSlugCache: jest.fn(),
}))

jest.mock('@/lib/api/laws/queries', () => ({
  getShortNameBySlug: jest.fn(async (slug: string) => {
    const map: Record<string, string> = { 'constitucion-espanola': 'CE', 'ley-39-2015': 'Ley 39/2015' }
    return map[slug] || null
  }),
  loadSlugMappingCache: jest.fn(async () => ({
    slugToShortName: new Map([['constitucion-espanola', 'CE'], ['ley-39-2015', 'Ley 39/2015']]),
    shortNameToSlug: new Map([['CE', 'constitucion-espanola'], ['Ley 39/2015', 'ley-39-2015']]),
    lawsBySlug: new Map(),
    loadedAt: new Date(),
  })),
  generateSlugFromShortName: jest.fn((s: string) => s?.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
}))

import { fetchLawArticles } from '@/lib/teoriaFetchers'

// Helper: make article data with law
function makeArticle(num: string, lawData: { id: string; name: string; short_name: string; description: string | null } = { id: 'law-1', name: 'Test', short_name: 'CE', description: null }) {
  return {
    id: `art-${num}`,
    article_number: num,
    title: `Art ${num}`,
    content: `Contenido del articulo ${num}`,
    is_active: true,
    created_at: '2024-01-01',
    laws: lawData,
  }
}

function rechainAll() {
  // Laws chain
  mockLawsSingle.mockReturnValue({ data: null, error: null })
  mockLawsLimit.mockReturnValue({ single: mockLawsSingle })
  mockLawsEq.mockReturnValue({ limit: mockLawsLimit })
  mockLawsOr.mockReturnValue({ eq: mockLawsEq })
  mockLawsSelect.mockReturnValue({ or: mockLawsOr, eq: mockLawsEq })

  // Articles chain
  mockArticlesOrder.mockResolvedValue({ data: [], error: null })
  mockArticlesNeq.mockReturnValue({ order: mockArticlesOrder })
  mockArticlesNot2.mockReturnValue({ neq: mockArticlesNeq })
  mockArticlesNot1.mockReturnValue({ not: mockArticlesNot2 })
  mockArticlesEq3.mockReturnValue({ not: mockArticlesNot1 })
  mockArticlesEq2.mockReturnValue({ eq: mockArticlesEq3 })
  mockArticlesEq1.mockReturnValue({ eq: mockArticlesEq2 })
  mockArticlesSelect.mockReturnValue({ eq: mockArticlesEq1 })
}

describe('fetchLawArticles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    queriedTables.length = 0
    rechainAll()
  })

  describe('con slug reconocido por mapLawSlugToShortName', () => {
    it('resuelve slug via Drizzle cache y consulta articles via supabase', async () => {
      mockMapSlug.mockReturnValue('CE')
      mockArticlesOrder.mockResolvedValueOnce({
        data: [makeArticle('1')],
        error: null,
      })

      await fetchLawArticles('constitucion-espanola')

      // Slug se resuelve via Drizzle (mockeado), articles se consultan via supabase
      expect(queriedTables).toContain('articles')
    })

    it('usa el short_name del mapeo para filtrar articles', async () => {
      mockMapSlug.mockReturnValue('Ley 39/2015')
      mockArticlesOrder.mockResolvedValueOnce({ data: [], error: null })

      await fetchLawArticles('ley-39-2015')

      // Check that eq was called with the mapped short_name
      const allEqCalls = [
        ...mockArticlesEq1.mock.calls,
        ...mockArticlesEq2.mock.calls,
        ...mockArticlesEq3.mock.calls,
      ]
      const shortNameFilter = allEqCalls.find(
        (call: unknown[]) => call[0] === 'laws.short_name' && call[1] === 'Ley 39/2015'
      )
      expect(shortNameFilter).toBeTruthy()
    })

    it('retorna articulos procesados correctamente', async () => {
      mockMapSlug.mockReturnValue('CE')
      mockArticlesOrder.mockResolvedValueOnce({
        data: [makeArticle('1'), makeArticle('2')],
        error: null,
      })

      const result = await fetchLawArticles('ce')

      expect(result.articles).toHaveLength(2)
      expect(result.articles[0].article_number).toBe('1')
      expect(result.law).toMatchObject({ short_name: 'CE' })
    })
  })

  describe('con slug NO reconocido (fallback a BD)', () => {
    it('consulta la tabla laws como fallback', async () => {
      mockMapSlug.mockReturnValue(null)
      mockLawsSingle.mockResolvedValueOnce({
        data: { short_name: 'Ley Especial' },
        error: null,
      })
      mockArticlesOrder.mockResolvedValueOnce({ data: [], error: null })

      await fetchLawArticles('ley-especial-slug')

      expect(queriedTables).toContain('laws')
      expect(queriedTables).toContain('articles')
    })

    it('usa el short_name de BD para filtrar articles', async () => {
      mockMapSlug.mockReturnValue(null)
      mockLawsSingle.mockResolvedValueOnce({
        data: { short_name: 'Ley Especial' },
        error: null,
      })
      mockArticlesOrder.mockResolvedValueOnce({
        data: [makeArticle('5', { id: 'l-esp', name: 'Ley Especial Completa', short_name: 'Ley Especial', description: null })],
        error: null,
      })

      const result = await fetchLawArticles('ley-especial-slug')

      const allEqCalls = [
        ...mockArticlesEq1.mock.calls,
        ...mockArticlesEq2.mock.calls,
        ...mockArticlesEq3.mock.calls,
      ]
      const shortNameFilter = allEqCalls.find(
        (call: unknown[]) => call[0] === 'laws.short_name' && call[1] === 'Ley Especial'
      )
      expect(shortNameFilter).toBeTruthy()
      expect(result.articles).toHaveLength(1)
    })

    it('usa el slug original si la query a laws falla', async () => {
      mockMapSlug.mockReturnValue(null)
      mockLawsSingle.mockResolvedValueOnce({ data: null, error: null })
      mockArticlesOrder.mockResolvedValueOnce({ data: [], error: null })

      const result = await fetchLawArticles('ley-que-no-existe')

      expect(result.notFound).toBe(true)
    })
  })

  describe('filtrado y ordenamiento de articulos', () => {
    beforeEach(() => {
      mockMapSlug.mockReturnValue('CE')
    })

    it('filtra articulos no numericos (titulos, capitulos)', async () => {
      mockArticlesOrder.mockResolvedValueOnce({
        data: [
          makeArticle('1'),
          makeArticle('T1'),   // filtrado: no numerico
          makeArticle('10'),
          makeArticle('T1C1'), // filtrado: no numerico
        ],
        error: null,
      })

      const result = await fetchLawArticles('ce')

      expect(result.articles).toHaveLength(2)
      const nums = result.articles.map((a: { article_number: string }) => a.article_number)
      expect(nums).toEqual(['1', '10'])
    })

    it('ordena articulos numericamente (no lexicografico)', async () => {
      mockArticlesOrder.mockResolvedValueOnce({
        data: [makeArticle('10'), makeArticle('2'), makeArticle('1')],
        error: null,
      })

      const result = await fetchLawArticles('ce')

      const nums = result.articles.map((a: { article_number: string }) => a.article_number)
      expect(nums).toEqual(['1', '2', '10'])
    })

    it('retorna notFound cuando no hay articulos', async () => {
      mockArticlesOrder.mockResolvedValueOnce({ data: [], error: null })

      const result = await fetchLawArticles('ce')

      expect(result.notFound).toBe(true)
      expect(result.articles).toEqual([])
    })

    it('lanza error cuando la query falla', async () => {
      mockArticlesOrder.mockResolvedValueOnce({
        data: null,
        error: { message: 'connection timeout' },
      })

      await expect(fetchLawArticles('ce')).rejects.toThrow()
    })
  })

  describe('datos de ley en la respuesta', () => {
    it('incluye law data procesada', async () => {
      mockMapSlug.mockReturnValue('CE')
      mockArticlesOrder.mockResolvedValueOnce({
        data: [makeArticle('1', { id: 'law-ce', name: 'Constitucion Espanola', short_name: 'CE', description: 'La CE' })],
        error: null,
      })

      const result = await fetchLawArticles('ce')

      expect(result.law).toMatchObject({
        id: 'law-ce',
        name: 'Constitucion Espanola',
        short_name: 'CE',
      })
      expect(result.articles[0].law).toMatchObject({
        id: 'law-ce',
        short_name: 'CE',
      })
    })
  })
})
