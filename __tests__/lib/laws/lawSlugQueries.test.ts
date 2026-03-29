// __tests__/lib/laws/lawSlugQueries.test.ts
// Tests exhaustivos para lib/api/laws/queries.ts

// ============================================
// MOCK DE DRIZZLE - approach simplificado
// ============================================

// Resultado que devuelve el mock para consultas tipo "where sin limit" (loadSlugMappingCache)
let mockCacheResult: unknown[] = []
// Resultado que devuelve el mock para consultas tipo "where + limit" (resolveLawBySlug)
let mockSingleResult: unknown[] = []

const mockLimit = jest.fn(() => mockSingleResult)
const mockWhere = jest.fn(() => {
  // Si el siguiente call es .limit(), devolvemos un chainable
  // Si no, devolvemos el resultado directo (para loadSlugMappingCache)
  return Object.assign(mockCacheResult, { limit: mockLimit })
})
const mockFrom = jest.fn(() => ({ where: mockWhere }))
const mockSelectFn = jest.fn(() => ({ from: mockFrom }))
const mockDbInstance = { select: mockSelectFn }

jest.mock('@/db/client', () => ({
  getDb: jest.fn(() => mockDbInstance),
}))

jest.mock('@/db/schema', () => ({
  laws: {
    id: 'id', shortName: 'short_name', slug: 'slug', name: 'name',
    description: 'description', year: 'year', type: 'type', isActive: 'is_active',
  },
  articles: { id: 'id', lawId: 'law_id' },
  questions: { id: 'id', primaryArticleId: 'primary_article_id', isActive: 'is_active', isOfficialExam: 'is_official_exam' },
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: jest.fn((...args: unknown[]) => ({ type: 'and', args })),
  sql: Object.assign(jest.fn((...args: unknown[]) => ({ type: 'sql', args })), { as: jest.fn() }),
  count: jest.fn(() => ({ type: 'count' })),
  isNotNull: jest.fn((...args: unknown[]) => ({ type: 'isNotNull', args })),
}))

jest.mock('next/cache', () => ({
  unstable_cache: jest.fn((fn: Function) => fn),
}))

// ============================================
// IMPORTS
// ============================================

import {
  loadSlugMappingCache,
  invalidateSlugCache,
  resolveLawBySlug,
  getShortNameBySlug,
  getSlugByShortName,
  getCanonicalSlugAsync,
  getLawInfoBySlug,
  getAllActiveSlugs,
  getSlugMappingForApi,
  generateSlugFromShortName,
  normalizeLawShortName,
} from '@/lib/api/laws/queries'

// ============================================
// TEST DATA
// ============================================

// UUIDs válidos para que Zod no rechace los datos
const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`

const MOCK_LAWS = [
  { id: uuid(1), shortName: 'CE', slug: 'constitucion-espanola', name: 'Constitución Española', description: 'La ley fundamental del Estado', year: 1978, type: 'constitution' },
  { id: uuid(2), shortName: 'Ley 39/2015', slug: 'ley-39-2015', name: 'Ley 39/2015 LPAC', description: 'Procedimiento administrativo común', year: 2015, type: 'law' },
  { id: uuid(3), shortName: 'Ley 40/2015', slug: 'ley-40-2015', name: 'Ley 40/2015 LRJSP', description: 'Organización del sector público', year: 2015, type: 'law' },
  { id: uuid(4), shortName: 'RDL 5/2015', slug: 'rdl-5-2015', name: 'RDL 5/2015 - TREBEP', description: 'TREBEP', year: 2015, type: 'regulation' },
  { id: uuid(5), shortName: 'Código Civil', slug: 'codigo-civil', name: 'Código Civil', description: 'Derecho privado español', year: 1889, type: 'code' },
  { id: uuid(6), shortName: 'Código Penal', slug: 'codigo-penal', name: 'Código Penal', description: 'Delitos y penas', year: 1995, type: 'code' },
  { id: uuid(7), shortName: 'LO 6/1985', slug: 'lo-6-1985', name: 'LO 6/1985 LOPJ', description: 'LOPJ', year: 1985, type: 'law' },
  { id: uuid(8), shortName: 'Ley 19/2013', slug: 'ley-19-2013', name: 'Ley 19/2013 Transparencia', description: 'Transparencia', year: 2013, type: 'law' },
  { id: uuid(9), shortName: 'TUE', slug: 'tue', name: 'Tratado de la UE', description: 'Tratado UE', year: 1992, type: 'law' },
  { id: uuid(10), shortName: 'TFUE', slug: 'tfue', name: 'Tratado Funcionamiento UE', description: 'Funcionamiento UE', year: 2007, type: 'law' },
  { id: uuid(11), shortName: 'Correo electrónico', slug: 'correo-electronico', name: 'Correo electrónico', description: null, year: null, type: 'regulation' },
  { id: uuid(12), shortName: 'Informática Básica', slug: 'informatica-basica', name: 'Informática Básica', description: null, year: null, type: 'regulation' },
  { id: uuid(13), shortName: 'RI Comisión', slug: 'ri-comision', name: 'RI Comisión', description: 'Comisión Europea', year: null, type: 'regulation' },
  { id: uuid(14), shortName: 'RD 364/1995', slug: 'rd-364-1995', name: 'RD 364/1995', description: null, year: 1995, type: 'regulation' },
]

// ============================================
// SETUP
// ============================================

describe('lib/api/laws/queries.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    invalidateSlugCache()
    mockCacheResult = [...MOCK_LAWS]
    mockSingleResult = []
    // Rebuild chain after clearAllMocks
    mockFrom.mockReturnValue({ where: mockWhere })
    mockSelectFn.mockReturnValue({ from: mockFrom })
    mockWhere.mockImplementation(() => Object.assign([...mockCacheResult], { limit: mockLimit }))
    mockLimit.mockImplementation(() => mockSingleResult)
  })

  // ─── loadSlugMappingCache ──────────────────────────────────

  describe('loadSlugMappingCache', () => {
    it('carga todos los slugs de BD en cache', async () => {
      const cache = await loadSlugMappingCache()
      expect(cache.slugToShortName.size).toBe(MOCK_LAWS.length)
      expect(cache.shortNameToSlug.size).toBe(MOCK_LAWS.length)
      expect(cache.lawsBySlug.size).toBe(MOCK_LAWS.length)
    })

    it('segunda llamada usa cache sin query adicional', async () => {
      await loadSlugMappingCache()
      mockSelectFn.mockClear()
      await loadSlugMappingCache()
      expect(mockSelectFn).not.toHaveBeenCalled()
    })

    it('cache se invalida correctamente', async () => {
      await loadSlugMappingCache()
      invalidateSlugCache()
      mockSelectFn.mockClear()
      await loadSlugMappingCache()
      expect(mockSelectFn).toHaveBeenCalled()
    })

    it('lawsBySlug contiene datos completos validados con Zod', async () => {
      const cache = await loadSlugMappingCache()
      const ce = cache.lawsBySlug.get('constitucion-espanola')
      expect(ce).toEqual({
        id: uuid(1),
        shortName: 'CE',
        slug: 'constitucion-espanola',
        name: 'Constitución Española',
        description: 'La ley fundamental del Estado',
        year: 1978,
        type: 'constitution',
      })
    })
  })

  // ─── getShortNameBySlug ────────────────────────────────────

  describe('getShortNameBySlug', () => {
    it('resuelve slugs directos de BD', async () => {
      expect(await getShortNameBySlug('constitucion-espanola')).toBe('CE')
      expect(await getShortNameBySlug('ley-39-2015')).toBe('Ley 39/2015')
      expect(await getShortNameBySlug('rdl-5-2015')).toBe('RDL 5/2015')
      expect(await getShortNameBySlug('codigo-civil')).toBe('Código Civil')
      expect(await getShortNameBySlug('tue')).toBe('TUE')
    })

    it('devuelve null para slugs desconocidos sin patron', async () => {
      expect(await getShortNameBySlug('zzz-no-existe-nada')).toBeNull()
    })

    it('usa pattern-based fallback para slugs no en BD', async () => {
      expect(await getShortNameBySlug('ley-99-2099')).toBe('Ley 99/2099')
      expect(await getShortNameBySlug('rd-999-2099')).toBe('RD 999/2099')
      expect(await getShortNameBySlug('lo-9-2099')).toBe('LO 9/2099')
      expect(await getShortNameBySlug('rdl-9-2099')).toBe('RDL 9/2099')
      expect(await getShortNameBySlug('decreto-5-2099')).toBe('Decreto 5/2099')
      expect(await getShortNameBySlug('orden-abc-123-2024')).toBe('Orden ABC/123/2024')
      expect(await getShortNameBySlug('reglamento-ue-2016-679')).toBe('Reglamento UE 2016/679')
    })
  })

  // ─── getSlugByShortName ────────────────────────────────────

  describe('getSlugByShortName', () => {
    it('resuelve short_names a slugs', async () => {
      expect(await getSlugByShortName('CE')).toBe('constitucion-espanola')
      expect(await getSlugByShortName('Ley 39/2015')).toBe('ley-39-2015')
      expect(await getSlugByShortName('Código Civil')).toBe('codigo-civil')
    })

    it('devuelve null para short_names desconocidos', async () => {
      expect(await getSlugByShortName('Ley Imaginaria')).toBeNull()
    })
  })

  // ─── resolveLawBySlug ──────────────────────────────────────

  describe('resolveLawBySlug', () => {
    it('resuelve ley completa desde slug via cache', async () => {
      const result = await resolveLawBySlug('constitucion-espanola')
      expect(result).toEqual({
        id: uuid(1),
        shortName: 'CE',
        slug: 'constitucion-espanola',
        name: 'Constitución Española',
        description: 'La ley fundamental del Estado',
        year: 1978,
        type: 'constitution',
      })
    })

    it('devuelve null para slugs totalmente desconocidos', async () => {
      const result = await resolveLawBySlug('zzz-no-existe')
      expect(result).toBeNull()
    })

    it('actualiza cache en caliente al encontrar ley en BD directa', async () => {
      const newLaw = {
        id: uuid(999), shortName: 'Ley Nueva 2026', slug: 'ley-nueva-2026',
        name: 'Ley Nueva 2026', description: null, year: 2026, type: 'law',
      }
      mockSingleResult = [newLaw]
      mockLimit.mockReturnValue([newLaw])

      const result = await resolveLawBySlug('ley-nueva-2026')
      expect(result).not.toBeNull()
      expect(result!.shortName).toBe('Ley Nueva 2026')

      const cache = await loadSlugMappingCache()
      expect(cache.slugToShortName.get('ley-nueva-2026')).toBe('Ley Nueva 2026')
    })
  })

  // ─── getLawInfoBySlug ──────────────────────────────────────

  describe('getLawInfoBySlug', () => {
    it('devuelve name y description desde cache', async () => {
      const info = await getLawInfoBySlug('constitucion-espanola')
      expect(info).toEqual({
        name: 'Constitución Española',
        description: 'La ley fundamental del Estado',
      })
    })

    it('genera description fallback cuando es null', async () => {
      const info = await getLawInfoBySlug('informatica-basica')
      expect(info).toEqual({
        name: 'Informática Básica',
        description: 'Test de Informática Básica',
      })
    })

    it('devuelve null para slugs desconocidos sin patron', async () => {
      expect(await getLawInfoBySlug('zzz-no-existe-nada')).toBeNull()
    })

    it('genera info con pattern fallback', async () => {
      const info = await getLawInfoBySlug('ley-99-2099')
      expect(info).toEqual({
        name: 'Ley 99/2099',
        description: 'Test de Ley 99/2099',
      })
    })
  })

  // ─── getCanonicalSlugAsync ─────────────────────────────────

  describe('getCanonicalSlugAsync', () => {
    it('resuelve desde BD', async () => {
      expect(await getCanonicalSlugAsync('CE')).toBe('constitucion-espanola')
      expect(await getCanonicalSlugAsync('Ley 39/2015')).toBe('ley-39-2015')
    })

    it('genera slug para short_names no en BD', async () => {
      expect(await getCanonicalSlugAsync('Ley Imaginaria 2026')).toBe('ley-imaginaria-2026')
    })

    it('devuelve "unknown" para null/undefined/vacío', async () => {
      expect(await getCanonicalSlugAsync(null)).toBe('unknown')
      expect(await getCanonicalSlugAsync(undefined)).toBe('unknown')
      expect(await getCanonicalSlugAsync('')).toBe('unknown')
    })
  })

  // ─── generateSlugFromShortName ─────────────────────────────

  describe('generateSlugFromShortName', () => {
    it('genera slugs correctos con transliteracion', () => {
      expect(generateSlugFromShortName('Ley 39/2015')).toBe('ley-39-2015')
      expect(generateSlugFromShortName('Constitución Española')).toBe('constitucion-espanola')
      expect(generateSlugFromShortName('Código Civil')).toBe('codigo-civil')
      expect(generateSlugFromShortName('LO 6/1985')).toBe('lo-6-1985')
      expect(generateSlugFromShortName('EBEP-Andalucía')).toBe('ebep-andalucia')
      expect(generateSlugFromShortName('Informática Básica')).toBe('informatica-basica')
    })

    it('devuelve "unknown" para input vacío', () => {
      expect(generateSlugFromShortName('')).toBe('unknown')
    })

    it('elimina acentos y caracteres especiales', () => {
      expect(generateSlugFromShortName('Ley Orgánica 3/2018')).toBe('ley-organica-3-2018')
      expect(generateSlugFromShortName('Hojas de cálculo. Excel')).toBe('hojas-de-calculo-excel')
    })

    it('colapsa guiones y trims', () => {
      expect(generateSlugFromShortName('Ley  39 / 2015')).toBe('ley-39-2015')
      expect(generateSlugFromShortName(' Ley 1 ')).toBe('ley-1')
    })

    it('es determinista', () => {
      const input = 'Ley Orgánica 3/2018'
      expect(generateSlugFromShortName(input)).toBe(generateSlugFromShortName(input))
    })
  })

  // ─── normalizeLawShortName ─────────────────────────────────

  describe('normalizeLawShortName', () => {
    it('normaliza variantes conocidas', () => {
      expect(normalizeLawShortName('RCD')).toBe('Reglamento del Congreso')
      expect(normalizeLawShortName('RS')).toBe('Reglamento del Senado')
      expect(normalizeLawShortName('Reglamento Congreso')).toBe('Reglamento del Congreso')
    })

    it('passthrough para nombres desconocidos', () => {
      expect(normalizeLawShortName('CE')).toBe('CE')
      expect(normalizeLawShortName('Cualquier cosa')).toBe('Cualquier cosa')
    })
  })

  // ─── getAllActiveSlugs ─────────────────────────────────────

  describe('getAllActiveSlugs', () => {
    it('devuelve todos los slugs de BD', async () => {
      const slugs = await getAllActiveSlugs()
      expect(slugs.length).toBe(MOCK_LAWS.length)
      expect(slugs).toContain('constitucion-espanola')
      expect(slugs).toContain('ley-39-2015')
    })

    it('devuelve array vacio si BD falla', async () => {
      mockWhere.mockRejectedValueOnce(new Error('DB down'))
      invalidateSlugCache()
      const slugs = await getAllActiveSlugs()
      expect(slugs).toEqual([])
    })
  })

  // ─── getSlugMappingForApi ──────────────────────────────────

  describe('getSlugMappingForApi', () => {
    it('devuelve array con slug, shortName, name, description', async () => {
      const mappings = await getSlugMappingForApi()
      expect(mappings.length).toBe(MOCK_LAWS.length)

      const ce = mappings.find(m => m.slug === 'constitucion-espanola')
      expect(ce).toEqual({
        slug: 'constitucion-espanola',
        shortName: 'CE',
        name: 'Constitución Española',
        description: 'La ley fundamental del Estado',
      })
    })

    it('incluye leyes con description null', async () => {
      const mappings = await getSlugMappingForApi()
      const info = mappings.find(m => m.slug === 'informatica-basica')
      expect(info).toBeDefined()
      expect(info!.description).toBeNull()
    })
  })

  // ─── PATTERN FALLBACK ──────────────────────────────────────

  describe('pattern-based fallback', () => {
    const patternCases: [string, string][] = [
      ['ley-50-1997', 'Ley 50/1997'],
      ['lo-1-1979', 'LO 1/1979'],
      ['rd-887-2006', 'RD 887/2006'],
      ['rdl-1-2020', 'RDL 1/2020'],
      ['decreto-5-2025', 'Decreto 5/2025'],
      ['orden-hfp-134-2018', 'Orden HFP/134/2018'],
      ['reglamento-ue-2016-679', 'Reglamento UE 2016/679'],
    ]

    const casesNotInDb = patternCases.filter(
      ([slug]) => !MOCK_LAWS.some(l => l.slug === slug)
    )

    it.each(casesNotInDb)(
      '"%s" → "%s" via pattern',
      async (slug, expected) => {
        expect(await getShortNameBySlug(slug)).toBe(expected)
      }
    )
  })

  // ─── ROBUSTEZ ──────────────────────────────────────────────

  describe('robustez con inputs invalidos', () => {
    it('getShortNameBySlug con string vacío', async () => {
      expect(await getShortNameBySlug('')).toBeNull()
    })

    it('getSlugByShortName con string vacío', async () => {
      expect(await getSlugByShortName('')).toBeNull()
    })

    it('resolveLawBySlug con string vacío devuelve null', async () => {
      expect(await resolveLawBySlug('')).toBeNull()
    })

    it('getLawInfoBySlug con string vacío devuelve null', async () => {
      expect(await getLawInfoBySlug('')).toBeNull()
    })
  })
})
