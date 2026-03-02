// __tests__/lib/laws/warmSlugCache.test.ts
// Tests para el módulo puente warmCache.ts (usa Supabase)

// Mock de Supabase client con chaining
const mockNot = jest.fn()
const mockEq = jest.fn(() => ({ not: mockNot }))
const mockSelect = jest.fn(() => ({ eq: mockEq }))

const mockSupabase = {
  from: jest.fn(() => ({ select: mockSelect })),
}

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => mockSupabase),
}))

// Importar las funciones reales de lawMappingUtils (NO mockeadas)
import {
  invalidateDbCache,
  isDbCacheLoaded,
  mapLawSlugToShortName,
} from '@/lib/lawMappingUtils'

// Importar el módulo bajo test
import { warmSlugCache, invalidateAllSlugCaches } from '@/lib/api/laws/warmCache'

// Helper: simula respuesta exitosa de Supabase
function setupMockSuccess(data = [
  { short_name: 'CE', slug: 'constitucion-espanola' },
  { short_name: 'Ley 39/2015', slug: 'ley-39-2015' },
  { short_name: 'Nueva Ley Test', slug: 'nueva-ley-test' },
]) {
  mockNot.mockResolvedValue({ data, error: null })
}

// Helper: simula error de Supabase
function setupMockError(message = 'Connection refused') {
  mockNot.mockResolvedValue({ data: null, error: { message } })
}

// Helper: simula excepcion
function setupMockThrow(error = new Error('Network error')) {
  mockNot.mockRejectedValue(error)
}

describe('warmSlugCache', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    invalidateDbCache()
    // Re-setup chaining (clearAllMocks resets return values)
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ not: mockNot })
    mockSupabase.from.mockReturnValue({ select: mockSelect })
  })

  afterEach(() => {
    invalidateDbCache()
  })

  // ─── Calentamiento basico ────────────────────────────────────────

  describe('calentamiento basico', () => {
    it('puebla los Maps sincronos con datos de BD', async () => {
      setupMockSuccess()

      const result = await warmSlugCache()

      expect(result).toBe(true)
      expect(isDbCacheLoaded()).toBe(true)
      expect(mockSupabase.from).toHaveBeenCalledWith('laws')
    })

    it('mapLawSlugToShortName resuelve slugs de BD despues de calentar', async () => {
      setupMockSuccess()

      await warmSlugCache()

      expect(mapLawSlugToShortName('nueva-ley-test')).toBe('Nueva Ley Test')
    })

    it('devuelve true al calentar correctamente', async () => {
      setupMockSuccess()

      expect(await warmSlugCache()).toBe(true)
    })

    it('filtra leyes con slug null', async () => {
      setupMockSuccess([
        { short_name: 'CE', slug: 'constitucion-espanola' },
        { short_name: 'Ley sin slug', slug: null },
      ])

      await warmSlugCache()

      expect(mapLawSlugToShortName('constitucion-espanola')).toBe('CE')
      expect(isDbCacheLoaded()).toBe(true)
    })

    it('filtra leyes con short_name null', async () => {
      setupMockSuccess([
        { short_name: 'CE', slug: 'constitucion-espanola' },
        { short_name: null, slug: 'ley-sin-nombre' },
      ])

      await warmSlugCache()

      expect(isDbCacheLoaded()).toBe(true)
    })
  })

  // ─── No-op con cache fresco ──────────────────────────────────────

  describe('no-op con cache fresco', () => {
    it('segunda llamada no hace query a BD', async () => {
      setupMockSuccess()

      await warmSlugCache()
      await warmSlugCache()

      expect(mockSupabase.from).toHaveBeenCalledTimes(1)
    })

    it('isDbCacheLoaded es true tras calentar', async () => {
      setupMockSuccess()

      await warmSlugCache()

      expect(isDbCacheLoaded()).toBe(true)
    })
  })

  // ─── Degradacion elegante ────────────────────────────────────────

  describe('degradacion elegante', () => {
    it('devuelve false cuando Supabase devuelve error', async () => {
      setupMockError('Connection refused')

      const result = await warmSlugCache()

      expect(result).toBe(false)
    })

    it('NO lanza excepciones cuando Supabase falla', async () => {
      setupMockThrow(new Error('Network error'))

      await expect(warmSlugCache()).resolves.not.toThrow()
    })

    it('devuelve false cuando la query lanza excepcion', async () => {
      setupMockThrow()

      const result = await warmSlugCache()

      expect(result).toBe(false)
    })

    it('diccionario estatico sigue funcionando tras fallo de BD', async () => {
      setupMockError('DB down')

      await warmSlugCache()

      // 'constitucion-espanola' existe en el diccionario estatico de lawMappingUtils
      expect(mapLawSlugToShortName('constitucion-espanola')).toBe('CE')
    })
  })

  // ─── Invalidacion ────────────────────────────────────────────────

  describe('invalidacion', () => {
    it('invalidateAllSlugCaches limpia el cache sincrono', async () => {
      setupMockSuccess()

      await warmSlugCache()
      expect(isDbCacheLoaded()).toBe(true)

      invalidateAllSlugCaches()

      expect(isDbCacheLoaded()).toBe(false)
    })

    it('re-calienta correctamente despues de invalidar', async () => {
      setupMockSuccess()

      await warmSlugCache()
      invalidateAllSlugCaches()

      setupMockSuccess()
      await warmSlugCache()

      expect(isDbCacheLoaded()).toBe(true)
      expect(mockSupabase.from).toHaveBeenCalledTimes(2)
    })
  })

  // ─── BD tiene prioridad ──────────────────────────────────────────

  describe('BD tiene prioridad sobre diccionario estatico', () => {
    it('BD gana sobre diccionario estatico para el mismo slug', async () => {
      setupMockSuccess([
        { short_name: 'Constitucion Espanola 1978', slug: 'constitucion-espanola' },
      ])

      await warmSlugCache()

      // BD tiene prioridad: devuelve el valor de BD, no el estatico ('CE')
      expect(mapLawSlugToShortName('constitucion-espanola')).toBe('Constitucion Espanola 1978')
    })

    it('slugs solo en BD funcionan', async () => {
      setupMockSuccess([
        { short_name: 'Ley Imaginaria 2026', slug: 'ley-imaginaria-2026' },
      ])

      await warmSlugCache()

      expect(mapLawSlugToShortName('ley-imaginaria-2026')).toBe('Ley Imaginaria 2026')
    })

    it('slugs solo en diccionario estatico funcionan como fallback', async () => {
      // BD vacia
      setupMockSuccess([])

      await warmSlugCache()

      // 'ley-39-2015' existe en diccionario estatico
      expect(mapLawSlugToShortName('ley-39-2015')).toBe('Ley 39/2015')
    })
  })

  // ─── Edge cases ──────────────────────────────────────────────────

  describe('edge cases', () => {
    it('resultado vacio de BD no rompe nada', async () => {
      setupMockSuccess([])

      const result = await warmSlugCache()

      expect(result).toBe(true)
      expect(isDbCacheLoaded()).toBe(true)
    })

    it('cache se marca como cargado incluso con datos vacios', async () => {
      setupMockSuccess([])

      await warmSlugCache()

      expect(isDbCacheLoaded()).toBe(true)
    })

    it('pasa parametros correctos a Supabase', async () => {
      setupMockSuccess()

      await warmSlugCache()

      expect(mockSupabase.from).toHaveBeenCalledWith('laws')
      expect(mockSelect).toHaveBeenCalledWith('short_name, slug')
      expect(mockEq).toHaveBeenCalledWith('is_active', true)
      expect(mockNot).toHaveBeenCalledWith('slug', 'is', null)
    })
  })
})
