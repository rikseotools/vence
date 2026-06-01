/**
 * Tests para fetchLawSections tras migración a Drizzle.
 *
 * El fetcher resuelve un slug/short_name a sus secciones vía:
 *   1. resolveLawIdentifier (slug/short_name → { id, slug, shortName })
 *   2. Drizzle query a `laws` (si no se pasa options.lawId) — optimización N+1
 *   3. Drizzle query a `law_sections` (where lawId + isActive, orderBy orderPosition)
 *
 * Testeamos la lógica de postprocesado (formato, optimización N+1, errores)
 * mockeando el resultado de Drizzle. NO testeamos la query SQL en sí —
 * eso es un test de integración con BD real. Mismo enfoque que
 * fetchLawArticles.test.ts.
 */

// Mock server-only (lanza error en cliente, necesita mock en tests)
jest.mock('server-only', () => ({}))

// =============================================================================
// 1. Mock del cliente Drizzle (@/db/client)
// =============================================================================
// Cadena fluida compartida select().from().where() que diverge:
//   - laws:     .where(...).limit(1)     → mockLawQuery
//   - sections: .where(...).orderBy(...) → mockSectionsQuery

const mockLawQuery = jest.fn().mockResolvedValue([])
const mockSectionsQuery = jest.fn().mockResolvedValue([])

const mockLimit = jest.fn(() => mockLawQuery())
const mockOrderBy = jest.fn(() => mockSectionsQuery())
const mockWhere = jest.fn(() => ({ limit: mockLimit, orderBy: mockOrderBy }))
const mockFrom = jest.fn(() => ({ where: mockWhere }))
const mockSelect = jest.fn(() => ({ from: mockFrom }))
const mockDb = { select: mockSelect }

jest.mock('@/db/client', () => ({
  getDb: () => mockDb,
  getPoolerDb: () => mockDb,
}))

// =============================================================================
// 2. Mocks auxiliares
// =============================================================================

const mockMapSlug = jest.fn()
jest.mock('@/lib/lawSlugSync', () => ({
  mapSlugToShortName: (...args: unknown[]) => mockMapSlug(...args),
  generateSlug: jest.fn((s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
  getCanonicalSlug: jest.fn((s: string) => s?.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
}))

jest.mock('@/lib/api/laws/warmCache', () => ({
  warmSlugCache: jest.fn(),
}))

jest.mock('@/lib/api/laws/queries', () => ({
  getShortNameBySlug: jest.fn(async (slug: string) => {
    const map: Record<string, string> = { 'constitucion-espanola': 'CE', 'test-law': 'TL', 'ley-39-2015': 'Ley 39/2015' }
    return map[slug] || null
  }),
  loadSlugMappingCache: jest.fn(async () => ({
    slugToShortName: new Map(),
    shortNameToSlug: new Map([['CE', 'constitucion-espanola'], ['TL', 'test-law'], ['Ley 39/2015', 'ley-39-2015']]),
    lawsBySlug: new Map(),
    loadedAt: new Date(),
  })),
  generateSlugFromShortName: jest.fn((s: string) => s?.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
  resolveLawIdentifier: jest.fn(async (input: string) => {
    const map: Record<string, { id: string; slug: string; shortName: string }> = {
      'test-law': { id: 'law-123', slug: 'test-law', shortName: 'TL' },
      'TL': { id: 'law-123', slug: 'test-law', shortName: 'TL' },
      'constitucion-espanola': { id: 'law-ce', slug: 'constitucion-espanola', shortName: 'CE' },
      'CE': { id: 'law-ce', slug: 'constitucion-espanola', shortName: 'CE' },
      'ley-39-2015': { id: 'law-39', slug: 'ley-39-2015', shortName: 'Ley 39/2015' },
      'Ley 39/2015': { id: 'law-39', slug: 'ley-39-2015', shortName: 'Ley 39/2015' },
    }
    const result = map[input]
    if (!result) throw new Error(`Ley "${input}" no reconocida`)
    return result
  }),
}))

import { fetchLawSections } from '@/lib/teoriaFetchers'

// Helper: setup law query response (Drizzle .limit(1) → array de filas con shortName)
function setupLawQuerySuccess(lawData: { id: string; name: string; shortName: string } = { id: 'law-123', name: 'Test Law', shortName: 'TL' }) {
  mockLawQuery.mockResolvedValueOnce([lawData])
}

// Helper: setup sections query response (Drizzle .orderBy() → array, campos camelCase)
interface MockSection {
  id: string; slug: string; title: string; description: string | null;
  articleRangeStart: number | null; articleRangeEnd: number | null;
  sectionNumber: string; sectionType: string; orderPosition: number; isActive: boolean;
}
function setupSectionsQuerySuccess(sections: MockSection[] = [
  { id: 's1', slug: 'titulo-1', title: 'Titulo I', description: null, articleRangeStart: 1, articleRangeEnd: 10, sectionNumber: '1', sectionType: 'titulo', orderPosition: 1, isActive: true },
]) {
  mockSectionsQuery.mockResolvedValueOnce(sections)
}

describe('fetchLawSections', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMapSlug.mockReturnValue('Test Law')

    // Re-establecer la cadena Drizzle tras clearAllMocks
    mockLawQuery.mockResolvedValue([])
    mockSectionsQuery.mockResolvedValue([])
    mockLimit.mockImplementation(() => mockLawQuery())
    mockOrderBy.mockImplementation(() => mockSectionsQuery())
    mockWhere.mockReturnValue({ limit: mockLimit, orderBy: mockOrderBy })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockSelect.mockReturnValue({ from: mockFrom })
  })

  describe('sin options (backward compatible)', () => {
    it('consulta la tabla laws para resolver el lawId y luego law_sections', async () => {
      setupLawQuerySuccess()
      setupSectionsQuerySuccess()

      await fetchLawSections('test-law')

      // Sin options.lawId: se ejecuta la query a laws (.limit) y a law_sections (.orderBy)
      expect(mockLawQuery).toHaveBeenCalled()
      expect(mockSectionsQuery).toHaveBeenCalled()
    })

    it('retorna secciones formateadas correctamente', async () => {
      setupLawQuerySuccess({ id: 'law-abc', name: 'Mi Ley', shortName: 'ML' })
      setupSectionsQuerySuccess([
        { id: 's1', slug: 'titulo-1', title: 'Titulo I', description: 'Desc', articleRangeStart: 1, articleRangeEnd: 50, sectionNumber: '1', sectionType: 'titulo', orderPosition: 1, isActive: true },
        { id: 's2', slug: 'titulo-2', title: 'Titulo II', description: null, articleRangeStart: 51, articleRangeEnd: 100, sectionNumber: '2', sectionType: 'titulo', orderPosition: 2, isActive: true },
      ])

      const result = await fetchLawSections('test-law')

      expect(result.sections).toHaveLength(2)
      expect(result.sections[0]).toMatchObject({
        id: 's1',
        title: 'Titulo I',
        articleRange: { start: 1, end: 50 },
      })
      expect(result.law).toMatchObject({
        id: 'law-abc',
        name: 'Mi Ley',
        short_name: 'ML',
      })
    })

    it('lanza error si la ley no existe en BD', async () => {
      mockLawQuery.mockResolvedValueOnce([]) // sin filas → no encontrada

      await expect(fetchLawSections('test-law')).rejects.toThrow('no encontrada')
    })

    it('lanza error si el slug no se reconoce', async () => {
      mockMapSlug.mockReturnValue(null)

      await expect(fetchLawSections('slug-desconocido')).rejects.toThrow('no reconocida')
    })
  })

  describe('con options.lawId (optimizacion N+1)', () => {
    it('NO consulta laws cuando se pasa lawId (skip query); sí consulta law_sections', async () => {
      setupSectionsQuerySuccess()

      await fetchLawSections('test-law', {
        lawId: 'law-pre-resolved',
        lawName: 'Ley Pre-resuelta',
        lawShortName: 'LPR',
      })

      // Optimización N+1: la query a laws (.limit) NO se ejecuta; sólo law_sections (.orderBy)
      expect(mockLawQuery).not.toHaveBeenCalled()
      expect(mockSectionsQuery).toHaveBeenCalled()
    })

    it('incluye los datos de ley en la respuesta', async () => {
      setupSectionsQuerySuccess([])

      const result = await fetchLawSections('test-law', {
        lawId: 'law-xyz',
        lawName: 'Ley XYZ',
        lawShortName: 'LXYZ',
      })

      expect(result.law).toMatchObject({
        id: 'law-xyz',
        name: 'Ley XYZ',
        short_name: 'LXYZ',
      })
    })

    it('usa defaults para lawName/lawShortName si no se proporcionan', async () => {
      setupSectionsQuerySuccess([])

      const result = await fetchLawSections('test-law', {
        lawId: 'law-only-id',
      })

      expect(result.law.id).toBe('law-only-id')
      // Defaults al short_name resuelto (test-law → TL)
      expect(result.law.name).toBe('TL')
      expect(result.law.short_name).toBe('TL')
    })

    it('retorna secciones correctamente con lawId pre-resuelto', async () => {
      setupSectionsQuerySuccess([
        { id: 's1', slug: 'cap-1', title: 'Capitulo 1', description: null, articleRangeStart: 1, articleRangeEnd: 20, sectionNumber: '1', sectionType: 'capitulo', orderPosition: 1, isActive: true },
      ])

      const result = await fetchLawSections('test-law', { lawId: 'law-123' })

      expect(result.sections).toHaveLength(1)
      expect(result.sections[0].title).toBe('Capitulo 1')
    })

    it('usa el lawId pasado para la query de law_sections (sin reconsultar laws)', async () => {
      setupSectionsQuerySuccess([])

      const result = await fetchLawSections('test-law', {
        lawId: 'my-law-id-456',
      })

      // El lawId pre-resuelto se usa para filtrar secciones y se propaga a la respuesta,
      // sin disparar la query redundante a laws.
      expect(mockLawQuery).not.toHaveBeenCalled()
      expect(mockSectionsQuery).toHaveBeenCalled()
      expect(result.law.id).toBe('my-law-id-456')
    })
  })

  describe('secciones sin articleRange', () => {
    it('maneja secciones sin rango de articulos', async () => {
      setupLawQuerySuccess()
      setupSectionsQuerySuccess([
        { id: 's1', slug: 'preambulo', title: 'Preambulo', description: 'Intro', articleRangeStart: null, articleRangeEnd: null, sectionNumber: '0', sectionType: 'preambulo', orderPosition: 0, isActive: true },
      ])

      const result = await fetchLawSections('test-law')

      expect(result.sections[0].articleRange).toBeNull()
    })
  })

  describe('filtro de ley activa', () => {
    it('resuelve la ley activa desde la query a laws y la devuelve en la respuesta', async () => {
      // La impl filtra eq(laws.isActive, true) a nivel SQL (cubierto por integración).
      // A nivel unidad verificamos el comportamiento: la query a laws se ejecuta
      // y su resultado se propaga a la respuesta.
      setupLawQuerySuccess({ id: 'law-active', name: 'LO 2/2012', shortName: 'LO 2/2012' })
      setupSectionsQuerySuccess([])

      const result = await fetchLawSections('test-law')

      expect(mockLawQuery).toHaveBeenCalled()
      expect(result.law).toMatchObject({ id: 'law-active', short_name: 'LO 2/2012' })
    })
  })

  describe('manejo de short_name directo', () => {
    it('acepta short_name con / como input directo', async () => {
      mockMapSlug.mockReturnValue(null)
      setupLawQuerySuccess({ id: 'law-39', name: 'LPAC', shortName: 'Ley 39/2015' })
      setupSectionsQuerySuccess([])

      const result = await fetchLawSections('Ley 39/2015')

      expect(result.law.short_name).toBe('Ley 39/2015')
    })
  })
})
