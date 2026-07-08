// __tests__/lib/laws/warmSlugCache.test.ts
// Tests para el módulo puente warmCache.ts.
// warmSlugCache carga los slugs vía fetch('/api/v2/law-slugs') → lawSlugSync
// (migró de query directa a Supabase → endpoint agnóstico). El endpoint devuelve
// { mappings: [{ slug, shortName }] }.

// Mock de fetch (la fuente de datos actual)
const mockFetch = jest.fn()
;(global as unknown as { fetch: jest.Mock }).fetch = mockFetch

// Importar funciones de lawSlugSync (cache síncrono)
import {
  invalidateSyncCache,
  isSyncCacheLoaded,
  mapSlugToShortName,
} from '@/lib/lawSlugSync'

// Importar el módulo bajo test
import { warmSlugCache, invalidateAllSlugCaches } from '@/lib/api/laws/warmCache'

// Helper: respuesta exitosa del endpoint (shape { mappings: [{ slug, shortName }] })
function setupMockSuccess(mappings = [
  { shortName: 'CE', slug: 'constitucion-espanola' },
  { shortName: 'Ley 39/2015', slug: 'ley-39-2015' },
  { shortName: 'Nueva Ley Test', slug: 'nueva-ley-test' },
]) {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ mappings }) })
}

// Helper: HTTP error (res.ok=false)
function setupMockError(status = 500) {
  mockFetch.mockResolvedValue({ ok: false, status, json: async () => ({}) })
}

// Helper: excepción de red
function setupMockThrow(error = new Error('Network error')) {
  mockFetch.mockRejectedValue(error)
}

describe('warmSlugCache', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    invalidateSyncCache()
  })

  afterEach(() => {
    invalidateSyncCache()
  })

  // ─── Calentamiento basico ────────────────────────────────────────

  describe('calentamiento basico', () => {
    it('puebla los Maps sincronos con datos del endpoint', async () => {
      setupMockSuccess()

      const result = await warmSlugCache()

      expect(result).toBe(true)
      expect(isSyncCacheLoaded()).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v2/law-slugs'),
        expect.objectContaining({ headers: expect.objectContaining({ accept: 'application/json' }) }),
      )
    })

    it('mapSlugToShortName resuelve slugs despues de calentar', async () => {
      setupMockSuccess()

      await warmSlugCache()

      expect(mapSlugToShortName('nueva-ley-test')).toBe('Nueva Ley Test')
    })

    it('devuelve true al calentar correctamente', async () => {
      setupMockSuccess()

      expect(await warmSlugCache()).toBe(true)
    })

    it('filtra leyes con slug null', async () => {
      setupMockSuccess([
        { shortName: 'CE', slug: 'constitucion-espanola' },
        { shortName: 'Ley sin slug', slug: null as unknown as string },
      ])

      await warmSlugCache()

      expect(mapSlugToShortName('constitucion-espanola')).toBe('CE')
      expect(isSyncCacheLoaded()).toBe(true)
    })

    it('filtra leyes con shortName null', async () => {
      setupMockSuccess([
        { shortName: 'CE', slug: 'constitucion-espanola' },
        { shortName: null as unknown as string, slug: 'ley-sin-nombre' },
      ])

      await warmSlugCache()

      expect(isSyncCacheLoaded()).toBe(true)
    })
  })

  // ─── No-op con cache fresco ──────────────────────────────────────

  describe('no-op con cache fresco', () => {
    it('segunda llamada no vuelve a hacer fetch', async () => {
      setupMockSuccess()

      await warmSlugCache()
      await warmSlugCache()

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('isSyncCacheLoaded es true tras calentar', async () => {
      setupMockSuccess()

      await warmSlugCache()

      expect(isSyncCacheLoaded()).toBe(true)
    })
  })

  // ─── Degradacion elegante ────────────────────────────────────────

  describe('degradacion elegante', () => {
    it('devuelve false cuando el endpoint devuelve HTTP error', async () => {
      setupMockError(500)

      const result = await warmSlugCache()

      expect(result).toBe(false)
    })

    it('NO lanza excepciones cuando el fetch falla', async () => {
      setupMockThrow(new Error('Network error'))

      await expect(warmSlugCache()).resolves.not.toThrow()
    })

    it('devuelve false cuando el fetch lanza excepcion', async () => {
      setupMockThrow()

      const result = await warmSlugCache()

      expect(result).toBe(false)
    })

    it('pattern fallback sigue funcionando tras fallo de red', async () => {
      setupMockError(503)

      await warmSlugCache()

      // Pattern fallback (lawSlugSync, independiente de la fuente): 'ley-39-2015' → 'Ley 39/2015'
      expect(mapSlugToShortName('ley-39-2015')).toBe('Ley 39/2015')
    })
  })

  // ─── Invalidacion ────────────────────────────────────────────────

  describe('invalidacion', () => {
    it('invalidateAllSlugCaches limpia el cache sincrono', async () => {
      setupMockSuccess()

      await warmSlugCache()
      expect(isSyncCacheLoaded()).toBe(true)

      invalidateAllSlugCaches()

      expect(isSyncCacheLoaded()).toBe(false)
    })

    it('re-calienta correctamente despues de invalidar', async () => {
      setupMockSuccess()

      await warmSlugCache()
      invalidateAllSlugCaches()

      setupMockSuccess()
      await warmSlugCache()

      expect(isSyncCacheLoaded()).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  // ─── Datos del endpoint tienen prioridad ─────────────────────────

  describe('datos del endpoint tienen prioridad', () => {
    it('slugs del endpoint funcionan', async () => {
      setupMockSuccess([
        { shortName: 'Constitucion Espanola 1978', slug: 'constitucion-espanola' },
      ])

      await warmSlugCache()

      expect(mapSlugToShortName('constitucion-espanola')).toBe('Constitucion Espanola 1978')
    })

    it('pattern fallback funciona con endpoint vacío', async () => {
      setupMockSuccess([])

      await warmSlugCache()

      expect(mapSlugToShortName('ley-39-2015')).toBe('Ley 39/2015')
    })
  })

  // ─── Edge cases ──────────────────────────────────────────────────

  describe('edge cases', () => {
    it('resultado vacio no rompe nada', async () => {
      setupMockSuccess([])

      const result = await warmSlugCache()

      expect(result).toBe(true)
      expect(isSyncCacheLoaded()).toBe(true)
    })

    it('fetch al endpoint correcto con accept json', async () => {
      setupMockSuccess()

      await warmSlugCache()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v2/law-slugs'),
        expect.objectContaining({ headers: { accept: 'application/json' } }),
      )
    })
  })
})
