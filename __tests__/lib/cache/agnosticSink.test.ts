/**
 * Capa agnóstica de caché (lib/cache/sink). Verifica el selector de proveedor,
 * el mapeo del sink Upstash a la interfaz CacheSink, y que las funciones
 * públicas (getOrSet/setCached) hablan SÓLO con el sink (inyección de fake).
 * Principio: "AWS-native by default, agnóstico by contract".
 */

const mockRedisInstance = {
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn(),
  del: jest.fn().mockResolvedValue(1),
}
jest.mock('@upstash/redis', () => ({ Redis: jest.fn(() => mockRedisInstance) }))

import { getSink, _setSinkForTests, type CacheSink } from '@/lib/cache/sink'
import { createUpstashSink } from '@/lib/cache/sinks/upstash'
import { getOrSet, setCached } from '@/lib/cache/redis'

const OLD = process.env
beforeEach(() => {
  jest.clearAllMocks()
  process.env = { ...OLD, UPSTASH_REDIS_REST_URL: 'https://x.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'tok' }
  delete process.env.REDIS_CACHE_ENABLED
  delete process.env.CACHE_PROVIDER
  _setSinkForTests(undefined)
})
afterAll(() => { process.env = OLD; _setSinkForTests(undefined) })

describe('getSink — selector de proveedor', () => {
  test('default → upstash', () => {
    expect(getSink()?.name).toBe('upstash')
  })
  test('REDIS_CACHE_ENABLED=false → null (en cada llamada, no se cachea)', () => {
    expect(getSink()?.name).toBe('upstash')
    process.env.REDIS_CACHE_ENABLED = 'false'
    expect(getSink()).toBeNull()
    delete process.env.REDIS_CACHE_ENABLED
    expect(getSink()?.name).toBe('upstash') // re-evalúa
  })
  test('sin credenciales → null', () => {
    delete process.env.UPSTASH_REDIS_REST_URL
    _setSinkForTests(undefined)
    expect(getSink()).toBeNull()
  })
})

describe('UpstashCacheSink — mapeo a la interfaz', () => {
  test('set(key,value,ttl) → redis.set(key,value,{ex:ttl})', async () => {
    const sink = createUpstashSink()!
    await sink.set('k', { a: 1 }, 60)
    expect(mockRedisInstance.set).toHaveBeenCalledWith('k', { a: 1 }, { ex: 60 })
  })
  test('del([a,b]) → redis.del(a,b) (spread)', async () => {
    const sink = createUpstashSink()!
    await sink.del(['a', 'b'])
    expect(mockRedisInstance.del).toHaveBeenCalledWith('a', 'b')
  })
  test('del([]) → no llama', async () => {
    const sink = createUpstashSink()!
    await sink.del([])
    expect(mockRedisInstance.del).not.toHaveBeenCalled()
  })
  test('get normaliza undefined → null', async () => {
    mockRedisInstance.get.mockResolvedValueOnce(undefined)
    const sink = createUpstashSink()!
    expect(await sink.get('k')).toBeNull()
  })
})

describe('Las funciones públicas hablan SÓLO con el sink (inyección de fake)', () => {
  test('getOrSet: miss → fetcher → set en el sink; luego hit', async () => {
    const store = new Map<string, unknown>()
    const fake: CacheSink = {
      name: 'fake',
      get: async <T>(k: string) => (store.has(k) ? (store.get(k) as T) : null),
      set: async <T>(k: string, v: T) => { store.set(k, v) },
      del: async (ks) => { ks.forEach(k => store.delete(k)) },
      incr: async () => 0, incrby: async () => 0, expire: async () => {},
      hincrby: async () => {}, hgetall: async () => null,
    }
    _setSinkForTests(fake)

    const fetcher = jest.fn().mockResolvedValue({ v: 42 })
    const r1 = await getOrSet('key:1', 60, fetcher)
    expect(r1).toEqual({ v: 42 })
    expect(fetcher).toHaveBeenCalledTimes(1)
    await new Promise(r => setTimeout(r, 0)) // dejar landing el set fire-and-forget

    const r2 = await getOrSet('key:1', 60, fetcher)
    expect(r2).toEqual({ v: 42 })
    expect(fetcher).toHaveBeenCalledTimes(1) // hit, no re-fetch
  })

  test('setCached escribe en el sink', async () => {
    const setSpy = jest.fn().mockResolvedValue(undefined)
    _setSinkForTests({ name: 'fake', set: setSpy, get: async () => null, del: async () => {}, incr: async () => 0, incrby: async () => 0, expire: async () => {}, hincrby: async () => {}, hgetall: async () => null })
    await setCached('k', { x: 1 }, 30)
    await new Promise(r => setTimeout(r, 0))
    expect(setSpy).toHaveBeenCalledWith('k', { x: 1 }, 30)
  })
})
