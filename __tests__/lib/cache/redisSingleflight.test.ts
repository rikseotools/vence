// __tests__/lib/cache/redisSingleflight.test.ts
// Tests del singleflight añadido en lib/cache/redis.ts:getOrSet (Fase 2).
//
// Garantiza:
//   1. N requests concurrentes con la misma key → fetcher se llama 1 sola vez,
//      todas reciben el mismo valor.
//   2. Si el fetcher rechaza, todas las N reciben el mismo error.
//   3. Tras un error, la siguiente request reintenta (Map limpio).
//   4. Claves distintas no comparten singleflight.
//   5. Cache hit no dispara singleflight.
//   6. Sin Redis (REDIS_CACHE_ENABLED=false) NO se aplica singleflight —
//      cada request llama a su propio fetcher (preserva semántica anterior).

// ============================================
// MOCKS — Upstash Redis
// ============================================

const mockGet = jest.fn()
const mockSet = jest.fn().mockResolvedValue('OK')

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: mockGet,
    set: mockSet,
    del: jest.fn().mockResolvedValue(0),
  })),
}))

// ============================================
// IMPORTS (después de mocks)
// ============================================

import { getOrSet, _singleflightInternalForTests } from '@/lib/cache/redis'

const flight = _singleflightInternalForTests()

// ============================================
// HELPERS
// ============================================

function deferred<T>(): {
  promise: Promise<T>
  resolve: (v: T) => void
  reject: (e: unknown) => void
} {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setEnvForTest(enabled: boolean) {
  if (enabled) {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token'
    delete process.env.REDIS_CACHE_ENABLED // default = enabled
  } else {
    process.env.REDIS_CACHE_ENABLED = 'false'
  }
}

// ============================================
// TESTS
// ============================================

describe('getOrSet — singleflight (Fase 2)', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockSet.mockClear()
    flight.clear()
    setEnvForTest(true)
  })

  test('N requests concurrentes con misma key → fetcher se llama 1 vez', async () => {
    mockGet.mockResolvedValue(null) // miss
    let calls = 0
    const d = deferred<string>()
    const fetcher = jest.fn(async () => {
      calls++
      return d.promise
    })

    // Lanzar 50 requests concurrentes ANTES de resolver el fetcher
    const requests = Array.from({ length: 50 }, () =>
      getOrSet('hot-key', 60, fetcher),
    )

    // Pequeña espera para que todas las requests pasen el cache miss check
    // y registren el await sobre la Promise inflight
    await new Promise(r => setTimeout(r, 0))

    expect(calls).toBe(1)
    expect(flight.has('hot-key')).toBe(true)

    // Resolver el fetcher
    d.resolve('shared-value')
    const results = await Promise.all(requests)

    expect(results).toEqual(Array(50).fill('shared-value'))
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(flight.has('hot-key')).toBe(false) // cleanup
  })

  test('fetcher rechaza → N waiters reciben el mismo error', async () => {
    mockGet.mockResolvedValue(null)
    const d = deferred<string>()
    const fetcher = jest.fn(() => d.promise)

    const requests = Array.from({ length: 10 }, () =>
      getOrSet('error-key', 60, fetcher).catch(e => e),
    )

    await new Promise(r => setTimeout(r, 0))

    const err = new Error('db down')
    d.reject(err)

    const results = await Promise.all(requests)

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(results).toEqual(Array(10).fill(err))
    expect(flight.has('error-key')).toBe(false) // cleanup tras error
  })

  test('tras error, la siguiente request reintenta (Map limpio)', async () => {
    mockGet.mockResolvedValue(null)

    // Primera ronda: fetcher falla
    const d1 = deferred<string>()
    const fetcher1 = jest.fn(() => d1.promise)
    const req1 = getOrSet('retry-key', 60, fetcher1).catch(e => e)
    await new Promise(r => setTimeout(r, 0))
    d1.reject(new Error('first failure'))
    await req1

    // Segunda ronda: la siguiente request DEBE invocar al fetcher de nuevo
    // (no reutilizar la Promise rechazada)
    const fetcher2 = jest.fn().mockResolvedValue('fresh-value')
    const result = await getOrSet('retry-key', 60, fetcher2)

    expect(result).toBe('fresh-value')
    expect(fetcher2).toHaveBeenCalledTimes(1)
  })

  test('claves distintas NO comparten singleflight', async () => {
    mockGet.mockResolvedValue(null)
    const dA = deferred<string>()
    const dB = deferred<string>()
    const fetcherA = jest.fn(() => dA.promise)
    const fetcherB = jest.fn(() => dB.promise)

    const reqA = getOrSet('key-A', 60, fetcherA)
    const reqB = getOrSet('key-B', 60, fetcherB)

    await new Promise(r => setTimeout(r, 0))

    expect(fetcherA).toHaveBeenCalledTimes(1)
    expect(fetcherB).toHaveBeenCalledTimes(1)
    expect(flight.size()).toBe(2)

    dA.resolve('A')
    dB.resolve('B')
    expect(await reqA).toBe('A')
    expect(await reqB).toBe('B')
  })

  test('cache hit NO dispara fetcher ni toca singleflight', async () => {
    mockGet.mockResolvedValue('cached-value')
    const fetcher = jest.fn()

    const result = await getOrSet('hit-key', 60, fetcher)

    expect(result).toBe('cached-value')
    expect(fetcher).not.toHaveBeenCalled()
    expect(flight.has('hit-key')).toBe(false)
  })

  test('sin Redis (REDIS_CACHE_ENABLED=false) NO aplica singleflight — semántica preservada', async () => {
    setEnvForTest(false)

    let calls = 0
    const fetcher = jest.fn(async () => {
      calls++
      return `value-${calls}`
    })

    // 5 requests concurrentes — sin Redis, cada una hace su propia llamada
    const results = await Promise.all([
      getOrSet('any-key', 60, fetcher),
      getOrSet('any-key', 60, fetcher),
      getOrSet('any-key', 60, fetcher),
      getOrSet('any-key', 60, fetcher),
      getOrSet('any-key', 60, fetcher),
    ])

    expect(fetcher).toHaveBeenCalledTimes(5)
    expect(new Set(results).size).toBe(5) // todos distintos (value-1..value-5)
    expect(flight.size()).toBe(0) // singleflight no se tocó
  })

  test('SET de Redis se llama con el valor del fetcher tras singleflight', async () => {
    mockGet.mockResolvedValue(null)
    const fetcher = jest.fn().mockResolvedValue({ stats: 42 })

    await Promise.all([
      getOrSet('set-key', 120, fetcher),
      getOrSet('set-key', 120, fetcher),
      getOrSet('set-key', 120, fetcher),
    ])

    // SET solo debería llamarse 1 vez (no 3) — fire-and-forget tras fetcher resuelto
    expect(mockSet).toHaveBeenCalledTimes(1)
    expect(mockSet).toHaveBeenCalledWith('set-key', { stats: 42 }, { ex: 120 })
  })
})
