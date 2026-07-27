/**
 * Acceso a localStorage que no puede tumbar la interfaz.
 *
 * Caso real (27/07/2026): 19 `react_error_boundary` en 24 h porque `setItem` del fingerprint lanzaba
 * `QuotaExceededError` — el almacén del usuario estaba lleno y la llamada estaba desnuda. Guardar una
 * caché opcional rompía la pantalla.
 */
import { safeGet, safeSet, safeRemove, _resetAvisos } from '@/lib/storage/safeLocalStorage'
import { getOrCreateHardwareFingerprint, getHardwareFingerprint } from '@/lib/deviceFingerprint'

// El mock se declara con el prefijo `mock` que jest permite referenciar desde la factory.
const mockEmit = jest.fn()
jest.mock('@/lib/observability/client', () => ({
  emitClientEvent: (...args: unknown[]) => mockEmit(...args),
}))
const emitClientEvent = mockEmit

/** Sustituye window.localStorage por uno que se comporta como el del usuario con el disco lleno. */
function conAlmacen(impl: Partial<Storage>) {
  Object.defineProperty(window, 'localStorage', { value: impl, configurable: true, writable: true })
}

const almacenLleno = {
  getItem: () => null,
  setItem: () => { const e = new Error('Setting the value exceeded the quota.'); e.name = 'QuotaExceededError'; throw e },
  removeItem: () => { throw new Error('nope') },
}

describe('safeLocalStorage', () => {
  beforeEach(() => {
    emitClientEvent.mockClear()
    _resetAvisos()
    conAlmacen({
      getItem: jest.fn(() => 'valor'),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    })
  })

  it('funciona normal cuando el navegador funciona', () => {
    expect(safeGet('k')).toBe('valor')
    expect(safeSet('k', 'v')).toBe(true)
    expect(safeRemove('k')).toBe(true)
  })

  describe('cuando el almacén está lleno (el caso que rompía la app)', () => {
    beforeEach(() => conAlmacen(almacenLleno))

    it('NO lanza: devuelve false y la app sigue', () => {
      expect(() => safeSet('vence_hw_fingerprint', 'abc')).not.toThrow()
      expect(safeSet('vence_hw_fingerprint', 'abc')).toBe(false)
    })

    it('tampoco lanza al borrar', () => {
      expect(() => safeRemove('k')).not.toThrow()
      expect(safeRemove('k')).toBe(false)
    })

    it('el fallo NO se traga en silencio: se emite observabilidad', () => {
      safeSet('vence_hw_fingerprint', 'abc')
      expect(emitClientEvent).toHaveBeenCalledTimes(1)
      const ev = emitClientEvent.mock.calls[0][0] as { severity: string; metadata: Record<string, unknown> }
      expect(ev.metadata.quotaExceeded).toBe(true)
      expect(ev.metadata.key).toBe('vence_hw_fingerprint')
    })

    it('se emite como `warn`, no `error`: está contenido y no debe disparar la alerta de picos', () => {
      safeSet('k', 'v')
      expect((emitClientEvent.mock.calls[0][0] as { severity: string }).severity).toBe('warn')
    })

    it('no inunda: un aviso por clave y operación, no uno por intento', () => {
      for (let i = 0; i < 50; i++) safeSet('misma', 'v')
      expect(emitClientEvent).toHaveBeenCalledTimes(1)
    })
  })

  it('sobrevive al navegador donde hasta LEER lanza (Safari privado, cookies bloqueadas)', () => {
    conAlmacen({ getItem: () => { throw new Error('SecurityError') }, setItem: () => {}, removeItem: () => {} })
    expect(() => safeGet('k')).not.toThrow()
    expect(safeGet('k')).toBeNull()
  })

  it('en servidor (sin window.localStorage) devuelve valores neutros sin romper', () => {
    Object.defineProperty(window, 'localStorage', { value: undefined, configurable: true, writable: true })
    expect(safeGet('k')).toBeNull()
    expect(safeSet('k', 'v')).toBe(false)
  })
})

describe('deviceFingerprint ya no puede romper la interfaz', () => {
  beforeEach(() => { emitClientEvent.mockClear(); _resetAvisos() })

  it('EL BUG: con el almacén lleno devuelve un fingerprint igualmente', () => {
    conAlmacen(almacenLleno)
    let fp = ''
    expect(() => { fp = getOrCreateHardwareFingerprint() }).not.toThrow()
    expect(fp.length).toBeGreaterThan(0)
  })

  it('el fingerprint es estable aunque no se pueda cachear (mismo hardware ⇒ mismo hash)', () => {
    conAlmacen(almacenLleno)
    expect(getOrCreateHardwareFingerprint()).toBe(getOrCreateHardwareFingerprint())
  })

  it('si hay caché, la usa (no recalcula por gusto)', () => {
    const getItem = jest.fn(() => 'cacheado')
    conAlmacen({ getItem, setItem: jest.fn(), removeItem: jest.fn() })
    expect(getOrCreateHardwareFingerprint()).toBe('cacheado')
    expect(getHardwareFingerprint()).toBe('cacheado')
  })
})
