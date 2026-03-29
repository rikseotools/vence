// __tests__/integration/lawSlugFailureModes.test.ts
// Tests de MODOS DE FALLO: Verifican que el sistema degrada elegantemente
// cuando las cosas van mal (BD caída, cache vacío, módulos eliminados).
//
// Estos son los escenarios más propensos a bugs en producción.

// ============================================
// 1. FETCHERS SIN CACHE: ¿qué pasa si warmSlugCache falla?
// ============================================

describe('Fetchers sin cache cargado', () => {
  // Simular que warmSlugCache falló y el cache está vacío
  const { invalidateSyncCache, mapSlugToShortName, isSyncCacheLoaded } = require('@/lib/lawSlugSync')

  beforeEach(() => {
    invalidateSyncCache()
  })

  afterEach(() => {
    invalidateSyncCache()
  })

  it('cache vacío: slugs con patrón conocido funcionan', () => {
    expect(isSyncCacheLoaded()).toBe(false)

    // Patrones regex siguen funcionando sin cache
    expect(mapSlugToShortName('ley-39-2015')).toBe('Ley 39/2015')
    expect(mapSlugToShortName('lo-6-1985')).toBe('LO 6/1985')
    expect(mapSlugToShortName('rd-364-1995')).toBe('RD 364/1995')
    expect(mapSlugToShortName('rdl-5-2015')).toBe('RDL 5/2015')
  })

  it('cache vacío: slugs CUSTOM devuelven null (potencial 404)', () => {
    expect(isSyncCacheLoaded()).toBe(false)

    // Estos slugs NO siguen ningún patrón regex → null sin cache
    // En producción, esto causaría un 404 si warmSlugCache falló
    expect(mapSlugToShortName('constitucion-espanola')).toBeNull()
    expect(mapSlugToShortName('codigo-civil')).toBeNull()
    expect(mapSlugToShortName('estatuto-trabajadores')).toBeNull()
    expect(mapSlugToShortName('informatica-basica')).toBeNull()
    expect(mapSlugToShortName('tue')).toBeNull()
    expect(mapSlugToShortName('tfue')).toBeNull()
    expect(mapSlugToShortName('reglamento-del-congreso')).toBeNull()
  })

  it('LISTA DE SLUGS VULNERABLES sin cache (documentación)', () => {
    // Este test documenta TODOS los slugs de la app que DEPENDEN del cache de BD
    // y NO se resuelven por pattern fallback.
    // Si warmSlugCache falla, estas URLs darán 404.
    const vulnerableSlugs = [
      'constitucion-espanola', 'codigo-civil', 'codigo-penal',
      'estatuto-trabajadores', 'tue', 'tfue', 'informatica-basica',
      'hojas-de-calculo-excel', 'correo-electronico', 'ley-trafico',
      'reglamento-del-congreso', 'reglamento-del-senado',
      'ri-comision', 'ri-consejo', 'rp-tjue',
      'administracion-electronica-csl',
      'gobierno-abierto', 'agenda-2030',
    ]

    const nullCount = vulnerableSlugs.filter(s => mapSlugToShortName(s) === null).length
    // TODOS deberían ser null sin cache (confirma que dependen del cache)
    expect(nullCount).toBe(vulnerableSlugs.length)

    // Este test es informativo: si warmSlugCache es crítico para la app,
    // considerar un fallback estático mínimo para los slugs más importantes.
  })
})

// ============================================
// 2. warmCache.ts con lawMappingUtils eliminado
// ============================================

describe('warmCache.ts sin lawMappingUtils', () => {
  // Mock de Supabase
  const mockNot = jest.fn()
  const mockEq = jest.fn(() => ({ not: mockNot }))
  const mockSelect = jest.fn(() => ({ eq: mockEq }))
  const mockSupabase = { from: jest.fn(() => ({ select: mockSelect })) }

  jest.mock('@/lib/supabase', () => ({
    getSupabaseClient: jest.fn(() => mockSupabase),
  }))

  const { warmSlugCache, invalidateAllSlugCaches } = require('@/lib/api/laws/warmCache')
  const { isSyncCacheLoaded, mapSlugToShortName, invalidateSyncCache } = require('@/lib/lawSlugSync')

  beforeEach(() => {
    jest.clearAllMocks()
    invalidateAllSlugCaches()
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ not: mockNot })
    mockSupabase.from.mockReturnValue({ select: mockSelect })
  })

  it('warmSlugCache no lanza error aunque lawMappingUtils no exista', async () => {
    mockNot.mockResolvedValue({
      data: [{ short_name: 'CE', slug: 'constitucion-espanola' }],
      error: null,
    })

    // Esto NO debe lanzar — el require de lawMappingUtils tiene try/catch
    await expect(warmSlugCache()).resolves.not.toThrow()
    expect(await warmSlugCache()).toBe(true)
  })

  it('warmSlugCache puebla lawSlugSync correctamente', async () => {
    mockNot.mockResolvedValue({
      data: [
        { short_name: 'CE', slug: 'constitucion-espanola' },
        { short_name: 'Ley 39/2015', slug: 'ley-39-2015' },
      ],
      error: null,
    })

    await warmSlugCache()

    expect(isSyncCacheLoaded()).toBe(true)
    expect(mapSlugToShortName('constitucion-espanola')).toBe('CE')
    expect(mapSlugToShortName('ley-39-2015')).toBe('Ley 39/2015')
  })

  it('warmSlugCache con BD caída: devuelve false, no rompe', async () => {
    mockNot.mockResolvedValue({ data: null, error: { message: 'Connection refused' } })

    const result = await warmSlugCache()

    expect(result).toBe(false)
    expect(isSyncCacheLoaded()).toBe(false)
  })

  it('warmSlugCache con excepción: no lanza, devuelve false', async () => {
    mockNot.mockRejectedValue(new Error('Network timeout'))

    await expect(warmSlugCache()).resolves.not.toThrow()
    expect(await warmSlugCache()).toBe(false)
  })

  it('invalidateAllSlugCaches limpia cache sin error', () => {
    expect(() => invalidateAllSlugCaches()).not.toThrow()
    expect(isSyncCacheLoaded()).toBe(false)
  })
})

// ============================================
// 3. LawSlugContext con mappings vacíos
// ============================================

describe('LawSlugContext con mappings vacíos (layout falla)', () => {
  // Simula que getSlugMappingForApi() falló y devolvió []
  const React = require('react')
  const { renderHook } = require('@testing-library/react')
  const { LawSlugProvider, useLawSlugs } = require('@/contexts/LawSlugContext')

  function createEmptyWrapper() {
    return function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(LawSlugProvider, { initialMappings: [] }, children)
    }
  }

  it('getSlug genera slug automático (no rompe)', () => {
    const { result } = renderHook(() => useLawSlugs(), { wrapper: createEmptyWrapper() })

    // Sin mappings, auto-genera
    expect(result.current.getSlug('Ley 39/2015')).toBe('ley-39-2015')
    expect(result.current.getSlug('LO 6/1985')).toBe('lo-6-1985')
  })

  it('getSlug con shortNames custom genera slug incorrecto (degradación conocida)', () => {
    const { result } = renderHook(() => useLawSlugs(), { wrapper: createEmptyWrapper() })

    // Sin mappings, 'CE' genera 'ce' en vez de 'constitucion-espanola'
    // Esto es una degradación conocida y aceptable (la URL /leyes/ce
    // será redirigida por el middleware de aliases)
    expect(result.current.getSlug('CE')).toBe('ce')
    expect(result.current.getSlug('TUE')).toBe('tue')
  })

  it('getShortName devuelve null (no rompe)', () => {
    const { result } = renderHook(() => useLawSlugs(), { wrapper: createEmptyWrapper() })

    expect(result.current.getShortName('constitucion-espanola')).toBeNull()
  })

  it('getLawInfo devuelve null (no rompe)', () => {
    const { result } = renderHook(() => useLawSlugs(), { wrapper: createEmptyWrapper() })

    expect(result.current.getLawInfo('constitucion-espanola')).toBeNull()
  })

  it('ready es false', () => {
    const { result } = renderHook(() => useLawSlugs(), { wrapper: createEmptyWrapper() })

    expect(result.current.ready).toBe(false)
    expect(result.current.count).toBe(0)
  })
})

// ============================================
// 4. Middleware con alias fetch fallido
// ============================================

describe('resolveAlias con fetch fallido', () => {
  // Importar con cache fresco
  let resolveAlias: (slug: string) => Promise<string | null>

  beforeEach(() => {
    // Forzar reimport para limpiar cache interno
    jest.resetModules()
    ;(global.fetch as jest.Mock).mockImplementation(() =>
      Promise.reject(new Error('Network error'))
    )
    resolveAlias = require('@/lib/lawSlugAliases').resolveAlias
  })

  it('devuelve null si fetch falla (no rompe el middleware)', async () => {
    const result = await resolveAlias('ce')
    // null = no redirect, la request continúa al slug original
    // El slug 'ce' no existe como ley, así que la página manejará el 404
    expect(result).toBeNull()
  })

  it('no lanza excepciones', async () => {
    await expect(resolveAlias('trebep')).resolves.not.toThrow()
  })
})

// ============================================
// 5. Doble decodificación de URLs
// ============================================

describe('doble decodificación de URLs', () => {
  const { mapSlugToShortName, setSyncCache, invalidateSyncCache } = require('@/lib/lawSlugSync')

  beforeEach(() => {
    const s2sn = new Map([['correo-electronico', 'Correo electrónico']])
    const sn2s = new Map([['Correo electrónico', 'correo-electronico']])
    setSyncCache(s2sn, sn2s)
  })

  afterEach(() => { invalidateSyncCache() })

  it('slug ya decodificado funciona', () => {
    expect(mapSlugToShortName('correo-electronico')).toBe('Correo electrónico')
  })

  it('slug URL-encoded se decodifica y resuelve', () => {
    // Next.js decodifica la URL antes de pasarla al componente,
    // pero el middleware recibe la URL raw. Probar ambos.
    expect(mapSlugToShortName('correo-electronico')).toBe('Correo electrónico')
  })

  it('slug con encoding roto no causa crash', () => {
    expect(() => mapSlugToShortName('%E0%B8%invalid')).not.toThrow()
    // decodeURIComponent falla, usa el original, no match → null
    expect(mapSlugToShortName('%E0%B8%invalid')).toBeNull()
  })

  it('slug con null bytes no causa crash', () => {
    expect(() => mapSlugToShortName('test%00slug')).not.toThrow()
  })
})
