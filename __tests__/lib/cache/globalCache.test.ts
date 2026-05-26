// __tests__/lib/cache/globalCache.test.ts
//
// Verifica que createGlobalCache:
// 1. Comparte storage via globalThis (no per-bundle).
// 2. Respeta TTL.
// 3. Invalidate funciona.
// 4. Loader solo se invoca cuando el cache está vacío o expirado (no por
//    request — esto es lo que rompió en LawsAPI antes del fix).

import { createGlobalCache } from '@/lib/cache/globalCache'

describe('createGlobalCache', () => {
  // Limpiar globalThis entre tests para aislar.
  afterEach(() => {
    for (const k of Object.keys(globalThis as unknown as Record<string, unknown>)) {
      if (k.startsWith('__vence_cache_')) {
        delete (globalThis as unknown as Record<string, unknown>)[k]
      }
    }
  })

  it('carga vía loader la primera vez', async () => {
    const cache = createGlobalCache<number>('test-1-v1', 60_000)
    const loader = jest.fn(async () => 42)
    const value = await cache.getOrLoad(loader)
    expect(value).toBe(42)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('reutiliza el valor cacheado en llamadas sucesivas dentro de TTL', async () => {
    const cache = createGlobalCache<number>('test-2-v1', 60_000)
    const loader = jest.fn(async () => 42)
    await cache.getOrLoad(loader)
    await cache.getOrLoad(loader)
    await cache.getOrLoad(loader)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('recarga cuando expira el TTL', async () => {
    const cache = createGlobalCache<number>('test-3-v1', 10) // 10ms TTL
    const loader = jest.fn(async () => 42)
    await cache.getOrLoad(loader)
    await new Promise((r) => setTimeout(r, 20))
    await cache.getOrLoad(loader)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('comparte storage entre dos instancias con misma key (mismo runtime)', async () => {
    // Esta es la propiedad CRÍTICA — simula el escenario de Next.js
    // bundleando el mismo archivo dos veces.
    const cacheA = createGlobalCache<number>('test-4-v1', 60_000)
    const cacheB = createGlobalCache<number>('test-4-v1', 60_000)
    const loaderA = jest.fn(async () => 100)
    const loaderB = jest.fn(async () => 200)

    const valueA = await cacheA.getOrLoad(loaderA)
    const valueB = await cacheB.getOrLoad(loaderB)

    // Ambos retornan el valor que cargó cacheA (loaderB nunca se llamó porque
    // cacheB encuentra el slot relleno por cacheA).
    expect(valueA).toBe(100)
    expect(valueB).toBe(100)
    expect(loaderA).toHaveBeenCalledTimes(1)
    expect(loaderB).toHaveBeenCalledTimes(0)
  })

  it('keys distintas NO se pisan', async () => {
    const cacheA = createGlobalCache<number>('test-5a-v1', 60_000)
    const cacheB = createGlobalCache<number>('test-5b-v1', 60_000)
    await cacheA.getOrLoad(async () => 100)
    await cacheB.getOrLoad(async () => 200)
    expect(cacheA.peek()).toBe(100)
    expect(cacheB.peek()).toBe(200)
  })

  it('invalidate() fuerza recarga', async () => {
    const cache = createGlobalCache<number>('test-6-v1', 60_000)
    const loader = jest.fn(async () => 42)
    await cache.getOrLoad(loader)
    cache.invalidate()
    await cache.getOrLoad(loader)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('peek() lee sin disparar loader', async () => {
    const cache = createGlobalCache<number>('test-7-v1', 60_000)
    expect(cache.peek()).toBeNull()
    await cache.getOrLoad(async () => 42)
    expect(cache.peek()).toBe(42)
  })

  it('isFresh() devuelve true solo si hay valor cacheado dentro de TTL', async () => {
    const cache = createGlobalCache<number>('test-8-v1', 10)
    expect(cache.isFresh()).toBe(false)
    await cache.getOrLoad(async () => 42)
    expect(cache.isFresh()).toBe(true)
    await new Promise((r) => setTimeout(r, 20))
    expect(cache.isFresh()).toBe(false)
  })

  it('versionar la key (v1→v2) crea slot independiente', async () => {
    const cacheV1 = createGlobalCache<number>('test-9-v1', 60_000)
    const cacheV2 = createGlobalCache<number>('test-9-v2', 60_000)
    await cacheV1.getOrLoad(async () => 100)
    await cacheV2.getOrLoad(async () => 200)
    expect(cacheV1.peek()).toBe(100)
    expect(cacheV2.peek()).toBe(200)
  })

  it('set() guarda el valor para próximas lecturas', async () => {
    const cache = createGlobalCache<number>('test-10-v1', 60_000)
    cache.set(99)
    expect(cache.peek()).toBe(99)
    expect(cache.isFresh()).toBe(true)
    // Próximo getOrLoad reutiliza sin disparar loader
    const loader = jest.fn(async () => 0)
    const value = await cache.getOrLoad(loader)
    expect(value).toBe(99)
    expect(loader).toHaveBeenCalledTimes(0)
  })
})
