/**
 * Tests para fetchLawArticles tras migración a Drizzle (commit e8d08529).
 *
 * El fetcher resuelve un slug de ley a sus artículos vía:
 *   1. Slug → short_name (cache Drizzle vía getShortNameBySlug)
 *   2. Drizzle query: select * from articles inner join laws where ...
 *
 * Testeamos la lógica de postprocesado (filtrado, ordenamiento, notFound)
 * mockeando el resultado de Drizzle. NO testeamos la query SQL en sí —
 * eso sería un test de integración con BD real.
 */

// Mock server-only (lanza error en cliente, necesita mock en tests)
jest.mock('server-only', () => ({}))

// =============================================================================
// 1. Mock del cliente Drizzle
// =============================================================================
// Devuelve un fake con la cadena fluida: select().from().innerJoin().where().orderBy()
// + un select().from().where().limit() para el fallback de búsqueda por short_name.
//
// `mockOrderByQuery` controla el resultado de la query principal.
// `mockLimitQuery` controla el resultado del fallback (cuando getShortNameBySlug devuelve null).

const mockOrderByQuery = jest.fn().mockResolvedValue([])
const mockLimitQuery = jest.fn().mockResolvedValue([])

const mockOrderBy = jest.fn().mockImplementation(() => mockOrderByQuery())
const mockLimit = jest.fn().mockImplementation(() => mockLimitQuery())
const mockWhereForArticles = jest.fn().mockReturnValue({ orderBy: mockOrderBy })
const mockWhereForLaws = jest.fn().mockReturnValue({ limit: mockLimit })
const mockInnerJoin = jest.fn().mockReturnValue({ where: mockWhereForArticles })
const mockFrom = jest.fn((table: unknown) => {
  // Drizzle pasa la tabla — el primer call es articles, el segundo (en fallback) es laws
  // Distinguimos por presencia de innerJoin.
  return {
    innerJoin: mockInnerJoin,
    where: mockWhereForLaws,
  }
})
const mockSelect = jest.fn().mockReturnValue({ from: mockFrom })

const mockDb = { select: mockSelect }

jest.mock('@/db/client', () => ({
  getDb: () => mockDb,
}))

// =============================================================================
// 2. Mocks auxiliares
// =============================================================================

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
    const map: Record<string, string> = {
      'constitucion-espanola': 'CE',
      'ce': 'CE',
      'ley-39-2015': 'Ley 39/2015',
    }
    return map[slug] ?? null
  }),
  loadSlugMappingCache: jest.fn(async () => ({
    slugToShortName: new Map([['constitucion-espanola', 'CE']]),
    shortNameToSlug: new Map([['CE', 'constitucion-espanola']]),
    lawsBySlug: new Map(),
    loadedAt: new Date(),
  })),
  generateSlugFromShortName: jest.fn((s: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-')),
}))

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => ({ from: jest.fn() })),
}))

import { fetchLawArticles } from '@/lib/teoriaFetchers'

// =============================================================================
// 3. Helper: forma de fila que devuelve Drizzle (post-select con alias)
// =============================================================================
type DrizzleRow = {
  id: string
  articleNumber: string
  title: string | null
  contentPreviewRaw: string
  contentLength: number
  fullContent: string
  lawId: string
  lawName: string
  lawShortName: string
  lawSlug: string
  lawDescription: string | null
}

function makeRow(num: string, overrides: Partial<DrizzleRow> = {}): DrizzleRow {
  return {
    id: `art-${num}`,
    articleNumber: num,
    title: overrides.title !== undefined ? overrides.title : `Art ${num}`,
    contentPreviewRaw: `Contenido del articulo ${num}`,
    contentLength: 100,
    fullContent: `Contenido completo del articulo ${num}`,
    lawId: 'law-1',
    lawName: 'Constitucion Espanola',
    lawShortName: 'CE',
    lawSlug: 'constitucion-espanola',
    lawDescription: null,
    ...overrides,
  }
}

// =============================================================================
// 4. Tests
// =============================================================================

describe('fetchLawArticles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockOrderByQuery.mockResolvedValue([])
    mockLimitQuery.mockResolvedValue([])
  })

  describe('resolución de slug', () => {
    it('usa getShortNameBySlug cuando el slug es conocido', async () => {
      mockOrderByQuery.mockResolvedValueOnce([makeRow('1')])

      const result = await fetchLawArticles('constitucion-espanola')

      expect(result.articles).toHaveLength(1)
      expect(result.law?.short_name).toBe('CE')
    })

    it('cae al fallback Drizzle cuando getShortNameBySlug devuelve null', async () => {
      // Slug desconocido → busca en laws con ILIKE → encuentra "Ley Especial"
      mockLimitQuery.mockResolvedValueOnce([{ shortName: 'Ley Especial' }])
      mockOrderByQuery.mockResolvedValueOnce([
        makeRow('5', { lawShortName: 'Ley Especial', lawName: 'Ley Especial Completa' }),
      ])

      const result = await fetchLawArticles('ley-especial-slug')

      expect(result.articles).toHaveLength(1)
      expect(result.law?.short_name).toBe('Ley Especial')
    })

    it('devuelve notFound si el slug no existe ni en cache ni en BD', async () => {
      mockLimitQuery.mockResolvedValueOnce([]) // no match en laws
      mockOrderByQuery.mockResolvedValueOnce([]) // no articles

      const result = await fetchLawArticles('ley-que-no-existe')

      expect(result.notFound).toBe(true)
      expect(result.articles).toEqual([])
    })
  })

  describe('filtrado de artículos', () => {
    it('filtra artículos con numero no estándar (T1, T1C1)', async () => {
      mockOrderByQuery.mockResolvedValueOnce([
        makeRow('1'),
        makeRow('T1', { title: 'Título Preliminar' }),
        makeRow('10'),
        makeRow('T1C1', { title: 'Capítulo I' }),
      ])

      const result = await fetchLawArticles('ce')

      const nums = result.articles.map(a => a.article_number)
      expect(nums).toEqual(['1', '10'])
    })

    it('filtra artículos cuyo title contiene "título"/"capítulo"/"preámbulo"', async () => {
      // Aunque el numero sea válido, si el title indica que es estructura, filtrar
      mockOrderByQuery.mockResolvedValueOnce([
        makeRow('1'),
        makeRow('5', { title: 'Capítulo II - Derechos' }),
        makeRow('10', { title: 'Preámbulo' }),
        makeRow('20'),
      ])

      const result = await fetchLawArticles('ce')

      const nums = result.articles.map(a => a.article_number)
      expect(nums).toEqual(['1', '20'])
    })
  })

  describe('ordenamiento de artículos', () => {
    it('ordena numéricamente (no lexicográfico: 2 antes que 10)', async () => {
      mockOrderByQuery.mockResolvedValueOnce([
        makeRow('10'),
        makeRow('2'),
        makeRow('1'),
      ])

      const result = await fetchLawArticles('ce')

      const nums = result.articles.map(a => a.article_number)
      expect(nums).toEqual(['1', '2', '10'])
    })
  })

  describe('manejo de errores', () => {
    it('devuelve notFound si la query no devuelve filas', async () => {
      mockOrderByQuery.mockResolvedValueOnce([])

      const result = await fetchLawArticles('ce')

      expect(result.notFound).toBe(true)
      expect(result.articles).toEqual([])
    })

    it('lanza error si la query a Drizzle falla', async () => {
      mockOrderByQuery.mockRejectedValueOnce(new Error('connection timeout'))

      await expect(fetchLawArticles('ce')).rejects.toThrow(/connection timeout/)
    })
  })

  describe('estructura de respuesta', () => {
    it('incluye datos de la ley en cada artículo procesado', async () => {
      mockOrderByQuery.mockResolvedValueOnce([
        makeRow('1', {
          lawId: 'law-ce',
          lawName: 'Constitucion Espanola',
          lawShortName: 'CE',
          lawDescription: 'La CE',
          lawSlug: 'constitucion-espanola',
        }),
      ])

      const result = await fetchLawArticles('ce')

      expect(result.articles).toHaveLength(1)
      expect(result.articles[0].law).toMatchObject({
        id: 'law-ce',
        name: 'Constitucion Espanola',
        short_name: 'CE',
        description: 'La CE',
        slug: 'constitucion-espanola',
      })
    })

    it('expone law a nivel raíz tomada del primer artículo', async () => {
      mockOrderByQuery.mockResolvedValueOnce([
        makeRow('1'),
        makeRow('2'),
      ])

      const result = await fetchLawArticles('ce')

      expect(result.law).toMatchObject({ short_name: 'CE' })
    })
  })
})
