// __tests__/lib/cache/metrics.test.ts
// Tests de la instrumentación de cache hit/miss en getOrSet (Phase 6).

const mockGet = jest.fn()
const mockSet = jest.fn().mockResolvedValue('OK')
const mockHincrby = jest.fn().mockResolvedValue(1)
const mockHgetall = jest.fn()

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: mockGet,
    set: mockSet,
    del: jest.fn().mockResolvedValue(0),
    hincrby: mockHincrby,
    hgetall: mockHgetall,
  })),
}))

import {
  getOrSet,
  getCacheMetrics,
  _singleflightInternalForTests,
} from '@/lib/cache/redis'

const flight = _singleflightInternalForTests()

beforeEach(() => {
  mockGet.mockReset()
  mockSet.mockClear()
  mockHincrby.mockClear()
  mockHgetall.mockReset()
  flight.clear()
  process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
  process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token'
  delete process.env.REDIS_CACHE_ENABLED
  delete process.env.CACHE_METRICS_ENABLED
})

describe('getOrSet — instrumentación de hit/miss', () => {
  test('cache hit dispara HINCRBY user_stats:hit', async () => {
    mockGet.mockResolvedValue('cached-value')
    const fetcher = jest.fn()

    await getOrSet('user_stats:abc-123', 60, fetcher)

    // Debe haber llamado hincrby con field "user_stats:hit"
    expect(mockHincrby).toHaveBeenCalledWith('cache_metrics', 'user_stats:hit', 1)
    expect(fetcher).not.toHaveBeenCalled()
  })

  test('cache miss dispara HINCRBY user_stats:miss', async () => {
    mockGet.mockResolvedValue(null)
    const fetcher = jest.fn().mockResolvedValue('fresh')

    await getOrSet('user_stats:xyz', 60, fetcher)

    expect(mockHincrby).toHaveBeenCalledWith('cache_metrics', 'user_stats:miss', 1)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  test('singleflight reuse (segunda request concurrente) cuenta como hit', async () => {
    mockGet.mockResolvedValue(null)
    let calls = 0
    let resolve!: (v: string) => void
    const fetcher = jest.fn(() => {
      calls++
      return new Promise<string>(r => { resolve = r })
    })

    // Lanzar 3 concurrentes — la primera dispara fetcher (miss),
    // las otras 2 lo dedupean (hit via singleflight).
    const p1 = getOrSet('user_stats:k1', 60, fetcher)
    const p2 = getOrSet('user_stats:k1', 60, fetcher)
    const p3 = getOrSet('user_stats:k1', 60, fetcher)

    await new Promise(r => setTimeout(r, 0))
    resolve!('shared')
    await Promise.all([p1, p2, p3])

    expect(calls).toBe(1)

    // Distribución esperada:
    //   3 GETs Redis → 3 misses iniciales (todos llegaron antes de SET)
    // Pero singleflight cuenta como hit las 2 últimas: 1 miss + 2 hits.
    const calls_arr = mockHincrby.mock.calls.map(c => c[1])
    const hits = calls_arr.filter(f => f === 'user_stats:hit').length
    const misses = calls_arr.filter(f => f === 'user_stats:miss').length
    expect(hits).toBeGreaterThanOrEqual(2)
    expect(misses).toBe(1)
  })

  test('CACHE_METRICS_ENABLED=false desactiva HINCRBY', async () => {
    process.env.CACHE_METRICS_ENABLED = 'false'
    mockGet.mockResolvedValue(null)
    const fetcher = jest.fn().mockResolvedValue('fresh')

    await getOrSet('user_stats:abc', 60, fetcher)

    expect(mockHincrby).not.toHaveBeenCalled()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  test('prefijo se extrae correctamente con keys complejas', async () => {
    mockGet.mockResolvedValue('cached')
    await getOrSet('exam_pending:user-uuid:exam:10', 30, jest.fn())

    expect(mockHincrby).toHaveBeenCalledWith('cache_metrics', 'exam_pending:hit', 1)
  })

  test('prefijo cuando key no tiene ":" usa la key entera', async () => {
    mockGet.mockResolvedValue('cached')
    await getOrSet('global_config', 60, jest.fn())

    expect(mockHincrby).toHaveBeenCalledWith('cache_metrics', 'global_config:hit', 1)
  })

  test('hincrby fallido no rompe getOrSet', async () => {
    mockHincrby.mockRejectedValueOnce(new Error('redis down'))
    mockGet.mockResolvedValue('cached')

    const result = await getOrSet('user_stats:abc', 60, jest.fn())
    expect(result).toBe('cached')
  })
})

describe('getCacheMetrics', () => {
  test('parsea HGETALL y devuelve números', async () => {
    mockHgetall.mockResolvedValue({
      'user_stats:hit': '1234',
      'user_stats:miss': '56',
      'exam_pending:hit': 89,
    })

    const metrics = await getCacheMetrics()
    expect(metrics).toEqual({
      'user_stats:hit': 1234,
      'user_stats:miss': 56,
      'exam_pending:hit': 89,
    })
  })

  test('devuelve {} si Redis devuelve null', async () => {
    mockHgetall.mockResolvedValue(null)
    expect(await getCacheMetrics()).toEqual({})
  })

  test('devuelve {} si Redis falla', async () => {
    mockHgetall.mockRejectedValue(new Error('boom'))
    expect(await getCacheMetrics()).toEqual({})
  })

  test('valor no numérico se parsea como 0', async () => {
    mockHgetall.mockResolvedValue({ 'foo:hit': 'NaN' })
    expect(await getCacheMetrics()).toEqual({ 'foo:hit': 0 })
  })
})
