// __tests__/lib/oposicion/oposicionCache.test.ts
// Unit de la caché de oposición (pre-hidratación anti-race, bug Raquel).
import { readOposicionCache, writeOposicionCache, clearOposicionCache } from '@/lib/oposicion/oposicionCache'

const MADRID = 'auxiliar_administrativo_madrid'
const OPO_CACHE_KEY = 'vence_opo_cache_v1'

beforeEach(() => {
  window.localStorage.clear()
})

describe('oposicionCache', () => {
  it('round-trip: write válido → read devuelve id + data', () => {
    writeOposicionCache(MADRID, { name: 'Madrid', plazas: 1450 })
    expect(readOposicionCache()).toEqual({ id: MADRID, data: { name: 'Madrid', plazas: 1450 } })
  })

  it('write con data null → read devuelve id + data null', () => {
    writeOposicionCache(MADRID, null)
    expect(readOposicionCache()).toEqual({ id: MADRID, data: null })
  })

  it('IGNORA un id inválido: no cachea nada', () => {
    writeOposicionCache('opo_que_no_existe_xyz', { x: 1 })
    expect(readOposicionCache()).toBeNull()
    expect(window.localStorage.getItem(OPO_CACHE_KEY)).toBeNull()
  })

  it('read RECHAZA un id que ya no está en el catálogo (datos sucios legacy)', () => {
    window.localStorage.setItem(OPO_CACHE_KEY, JSON.stringify({ id: 'oposicion_retirada', data: null }))
    expect(readOposicionCache()).toBeNull()
  })

  it('localStorage corrupto (no-JSON) → read null SIN lanzar', () => {
    window.localStorage.setItem(OPO_CACHE_KEY, '{ esto no es json')
    expect(() => readOposicionCache()).not.toThrow()
    expect(readOposicionCache()).toBeNull()
  })

  it('clear borra la caché', () => {
    writeOposicionCache(MADRID, { name: 'Madrid' })
    expect(readOposicionCache()).not.toBeNull()
    clearOposicionCache()
    expect(readOposicionCache()).toBeNull()
  })

  it('sin caché → read null', () => {
    expect(readOposicionCache()).toBeNull()
  })

  it('sobrescribe: el último write gana', () => {
    writeOposicionCache(MADRID, { v: 1 })
    writeOposicionCache('auxiliar_administrativo_estado', { v: 2 })
    expect(readOposicionCache()).toEqual({ id: 'auxiliar_administrativo_estado', data: { v: 2 } })
  })
})
