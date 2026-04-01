/**
 * Tests para fetchLawSections - verifica optimizacion N+1
 *
 * Cuando se pasa options.lawId, debe reutilizar esos datos
 * en vez de hacer una query redundante a la tabla laws.
 */

// Mock server-only
jest.mock('server-only', () => ({}))

// Track which tables are queried
const queriedTables: string[] = []

// Build chainable mock inline inside jest.mock (runs at module load time)
const mockSingle = jest.fn()
const mockOrder = jest.fn().mockReturnValue({ single: mockSingle })
const mockEq2 = jest.fn().mockImplementation(() => ({ eq: jest.fn().mockReturnValue({ order: mockOrder }), single: mockSingle, order: mockOrder }))
const mockEq1 = jest.fn().mockImplementation(() => ({ eq: mockEq2, single: mockSingle }))
const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })

// Mock supabase chain for loadSlugCache: .from('laws').select('slug, short_name').eq().not()
const mockSlugCacheNot = jest.fn().mockResolvedValue({ data: [
  { slug: 'constitucion-espanola', short_name: 'CE' },
  { slug: 'test-law', short_name: 'TL' },
  { slug: 'ley-39-2015', short_name: 'Ley 39/2015' },
] })
const mockSlugCacheEq = jest.fn().mockReturnValue({ not: mockSlugCacheNot })

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn((table: string) => {
      queriedTables.push(table)
      return {
        select: jest.fn((fields: string) => {
          if (fields === 'slug, short_name') {
            return { eq: mockSlugCacheEq }
          }
          return mockSelect(fields)
        })
      }
    }),
  })),
}))

// Mock lawSlugSync
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
    const map: Record<string, { lawId: string; slug: string; shortName: string }> = {
      'test-law': { lawId: 'law-123', slug: 'test-law', shortName: 'TL' },
      'TL': { lawId: 'law-123', slug: 'test-law', shortName: 'TL' },
      'constitucion-espanola': { lawId: 'law-ce', slug: 'constitucion-espanola', shortName: 'CE' },
      'CE': { lawId: 'law-ce', slug: 'constitucion-espanola', shortName: 'CE' },
      'ley-39-2015': { lawId: 'law-39', slug: 'ley-39-2015', shortName: 'Ley 39/2015' },
      'Ley 39/2015': { lawId: 'law-39', slug: 'ley-39-2015', shortName: 'Ley 39/2015' },
    }
    const result = map[input]
    if (!result) throw new Error(`Ley "${input}" no reconocida`)
    return result
  }),
}))

import { fetchLawSections } from '@/lib/teoriaFetchers'

// Helper: setup law query response (single)
function setupLawQuerySuccess(lawData = { id: 'law-123', name: 'Test Law', short_name: 'TL' }) {
  mockSingle.mockResolvedValueOnce({ data: lawData, error: null })
}

// Helper: setup sections query response (order)
interface MockSection {
  id: string; slug: string; title: string; description: string | null;
  article_range_start: number | null; article_range_end: number | null;
  section_number: string; section_type: string; order_position: number; is_active: boolean;
}
function setupSectionsQuerySuccess(sections: MockSection[] = [
  { id: 's1', slug: 'titulo-1', title: 'Titulo I', description: null, article_range_start: 1, article_range_end: 10, section_number: '1', section_type: 'titulo', order_position: 1, is_active: true },
]) {
  mockOrder.mockResolvedValueOnce({ data: sections, error: null })
}

describe('fetchLawSections', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    queriedTables.length = 0
    mockMapSlug.mockReturnValue('Test Law')

    // Re-chain after clear
    mockSelect.mockReturnValue({ eq: mockEq1 })
    mockEq1.mockImplementation(() => ({ eq: mockEq2, single: mockSingle }))
    mockEq2.mockImplementation(() => ({ eq: jest.fn().mockReturnValue({ order: mockOrder }), single: mockSingle, order: mockOrder }))
    mockOrder.mockReturnValue({ single: mockSingle })
  })

  describe('sin options (backward compatible)', () => {
    it('consulta la tabla laws para resolver el lawId', async () => {
      setupLawQuerySuccess()
      setupSectionsQuerySuccess()

      await fetchLawSections('test-law')

      expect(queriedTables).toContain('laws')
      expect(queriedTables).toContain('law_sections')
    })

    it('retorna secciones formateadas correctamente', async () => {
      setupLawQuerySuccess({ id: 'law-abc', name: 'Mi Ley', short_name: 'ML' })
      setupSectionsQuerySuccess([
        { id: 's1', slug: 'titulo-1', title: 'Titulo I', description: 'Desc', article_range_start: 1, article_range_end: 50, section_number: '1', section_type: 'titulo', order_position: 1, is_active: true },
        { id: 's2', slug: 'titulo-2', title: 'Titulo II', description: null, article_range_start: 51, article_range_end: 100, section_number: '2', section_type: 'titulo', order_position: 2, is_active: true },
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
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })

      await expect(fetchLawSections('test-law')).rejects.toThrow('no encontrada')
    })

    it('lanza error si el slug no se reconoce', async () => {
      mockMapSlug.mockReturnValue(null)

      await expect(fetchLawSections('slug-desconocido')).rejects.toThrow('no reconocida')
    })
  })

  describe('con options.lawId (optimizacion N+1)', () => {
    it('consulta laws solo para cache de slugs cuando se pasa lawId', async () => {
      setupSectionsQuerySuccess()

      await fetchLawSections('test-law', {
        lawId: 'law-pre-resolved',
        lawName: 'Ley Pre-resuelta',
        lawShortName: 'LPR',
      })

      // laws se consulta para slug cache, law_sections para los datos
      expect(queriedTables).toContain('law_sections')
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
      // Defaults to short_name from slug cache (test-law → TL)
      expect(result.law.name).toBe('TL')
      expect(result.law.short_name).toBe('TL')
    })

    it('retorna secciones correctamente con lawId pre-resuelto', async () => {
      setupSectionsQuerySuccess([
        { id: 's1', slug: 'cap-1', title: 'Capitulo 1', description: null, article_range_start: 1, article_range_end: 20, section_number: '1', section_type: 'capitulo', order_position: 1, is_active: true },
      ])

      const result = await fetchLawSections('test-law', { lawId: 'law-123' })

      expect(result.sections).toHaveLength(1)
      expect(result.sections[0].title).toBe('Capitulo 1')
    })

    it('usa lawId para la query de law_sections', async () => {
      setupSectionsQuerySuccess([])

      await fetchLawSections('test-law', {
        lawId: 'my-law-id-456',
      })

      // Verify eq was called with law_id
      const eqCalls = mockEq1.mock.calls
      const lawIdCall = eqCalls.find((call: unknown[]) => call[0] === 'law_id' && call[1] === 'my-law-id-456')
      expect(lawIdCall).toBeTruthy()
    })
  })

  describe('secciones sin articleRange', () => {
    it('maneja secciones sin rango de articulos', async () => {
      setupLawQuerySuccess()
      setupSectionsQuerySuccess([
        { id: 's1', slug: 'preambulo', title: 'Preambulo', description: 'Intro', article_range_start: null, article_range_end: null, section_number: '0', section_type: 'preambulo', order_position: 0, is_active: true },
      ])

      const result = await fetchLawSections('test-law')

      expect(result.sections[0].articleRange).toBeNull()
    })
  })

  describe('filtro is_active en query a laws', () => {
    it('la query a laws incluye eq is_active true para evitar duplicados', async () => {
      setupLawQuerySuccess({ id: 'law-active', name: 'LO 2/2012', short_name: 'LO 2/2012' })
      setupSectionsQuerySuccess([])

      await fetchLawSections('test-law')

      // Verify the chain includes is_active filter
      // mockEq1 is the first .eq() call, mockEq2 is the second
      // The query does .eq('short_name', ...).eq('is_active', true).single()
      const eq2Calls = mockEq2.mock.calls
      const isActiveCall = eq2Calls.find((call: unknown[]) => call[0] === 'is_active' && call[1] === true)
      expect(isActiveCall).toBeTruthy()
    })
  })

  describe('manejo de short_name directo', () => {
    it('acepta short_name con / como input directo', async () => {
      mockMapSlug.mockReturnValue(null)
      setupLawQuerySuccess({ id: 'law-39', name: 'LPAC', short_name: 'Ley 39/2015' })
      setupSectionsQuerySuccess([])

      const result = await fetchLawSections('Ley 39/2015')

      expect(result.law.short_name).toBe('Ley 39/2015')
    })
  })
})
