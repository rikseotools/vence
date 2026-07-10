// Tests del primitivo genérico de límite de features (lib/api/featureLimits.ts).
// Núcleo del gating premium reutilizable. Mockea Redis para probar la lógica pura
// de identidad, contador, fail-open, premium-invariante y modo off/shadow/on.

import {
  getFeatureLimitStatus,
  consumeFeatureLimit,
  getFeatureLimit,
  getFeatureLimitMode,
  type FeatureIdentity,
} from '@/lib/api/featureLimits'
import { getCounter, incrementCounterWithTtl } from '@/lib/cache/redis'

jest.mock('@/lib/cache/redis', () => ({
  getCounter: jest.fn(),
  incrementCounterWithTtl: jest.fn(),
}))

const mockGetCounter = getCounter as jest.MockedFunction<typeof getCounter>
const mockIncr = incrementCounterWithTtl as jest.MockedFunction<typeof incrementCounterWithTtl>

const CONFIG = { feature: 'teoria_search', freeLimit: 5 }
const ORIGINAL_ENV = process.env

beforeEach(() => {
  jest.clearAllMocks()
  process.env = { ...ORIGINAL_ENV }
  delete process.env.TEORIA_SEARCH_FREE_LIMIT
  delete process.env.TEORIA_SEARCH_LIMIT_MODE
  mockGetCounter.mockResolvedValue(0)
  mockIncr.mockResolvedValue(1)
})

afterAll(() => { process.env = ORIGINAL_ENV })

const user = (over: Partial<FeatureIdentity> = {}): FeatureIdentity => ({
  userId: 'u1', deviceId: null, ip: '1.2.3.4', isPremium: false, ...over,
})

describe('getFeatureLimitStatus', () => {
  it('premium: siempre allowed, limit Infinity, NO lee contador (invariante)', async () => {
    const r = await getFeatureLimitStatus(CONFIG, user({ isPremium: true }))
    expect(r.allowed).toBe(true)
    expect(r.limit).toBe(Infinity)
    expect(r.isPremium).toBe(true)
    expect(mockGetCounter).not.toHaveBeenCalled()
  })

  it('free logueado: permitido por debajo del límite', async () => {
    mockGetCounter.mockResolvedValue(4)
    const r = await getFeatureLimitStatus(CONFIG, user())
    expect(r.allowed).toBe(true)
    expect(r.used).toBe(4)
    expect(r.remaining).toBe(1)
    expect(r.scope).toBe('user')
  })

  it('free logueado: bloquea al alcanzar el límite (5)', async () => {
    mockGetCounter.mockResolvedValue(5)
    const r = await getFeatureLimitStatus(CONFIG, user())
    expect(r.allowed).toBe(false)
    expect(r.remaining).toBe(0)
  })

  it('anónimo con deviceId: scope device', async () => {
    mockGetCounter.mockResolvedValue(2)
    const r = await getFeatureLimitStatus(CONFIG, user({ userId: null, deviceId: 'dev-9' }))
    expect(r.scope).toBe('device')
    expect(r.allowed).toBe(true)
  })

  it('anónimo sin deviceId: cae a scope ip', async () => {
    const r = await getFeatureLimitStatus(CONFIG, user({ userId: null, deviceId: null }))
    expect(r.scope).toBe('ip')
  })

  it('userId="anonymous" se trata como anónimo (device/ip)', async () => {
    const r = await getFeatureLimitStatus(CONFIG, user({ userId: 'anonymous', deviceId: 'dev-1' }))
    expect(r.scope).toBe('device')
  })

  it('fail-open: Redis caído (getCounter=0) → allowed', async () => {
    mockGetCounter.mockResolvedValue(0)
    const r = await getFeatureLimitStatus(CONFIG, user())
    expect(r.allowed).toBe(true)
  })

  it('override de límite por env <FEATURE>_FREE_LIMIT', async () => {
    process.env.TEORIA_SEARCH_FREE_LIMIT = '3'
    mockGetCounter.mockResolvedValue(3)
    const r = await getFeatureLimitStatus(CONFIG, user())
    expect(r.limit).toBe(3)
    expect(r.allowed).toBe(false)
  })

  it('modo off: allowed sin contar (limit Infinity)', async () => {
    process.env.TEORIA_SEARCH_LIMIT_MODE = 'off'
    mockGetCounter.mockResolvedValue(99)
    const r = await getFeatureLimitStatus(CONFIG, user())
    expect(r.allowed).toBe(true)
    expect(r.limit).toBe(Infinity)
    expect(mockGetCounter).not.toHaveBeenCalled()
  })

  it('modo shadow: cuenta pero NO bloquea (rollout seguro)', async () => {
    process.env.TEORIA_SEARCH_LIMIT_MODE = 'shadow'
    mockGetCounter.mockResolvedValue(10) // muy por encima
    const r = await getFeatureLimitStatus(CONFIG, user())
    expect(r.allowed).toBe(true)   // no bloquea
    expect(r.used).toBe(10)        // pero cuenta
  })

  it('features distintas usan claves distintas (no comparten cuota)', async () => {
    await getFeatureLimitStatus({ feature: 'teoria_search', freeLimit: 5 }, user())
    await getFeatureLimitStatus({ feature: 'otra_feature', freeLimit: 5 }, user())
    const k1 = mockGetCounter.mock.calls[0][0]
    const k2 = mockGetCounter.mock.calls[1][0]
    expect(k1).toContain('teoria_search')
    expect(k2).toContain('otra_feature')
    expect(k1).not.toBe(k2)
  })
})

describe('consumeFeatureLimit', () => {
  it('premium: no-op (no incrementa)', async () => {
    await consumeFeatureLimit(CONFIG, user({ isPremium: true }))
    expect(mockIncr).not.toHaveBeenCalled()
  })

  it('modo off: no-op', async () => {
    process.env.TEORIA_SEARCH_LIMIT_MODE = 'off'
    await consumeFeatureLimit(CONFIG, user())
    expect(mockIncr).not.toHaveBeenCalled()
  })

  it('free: incrementa con TTL', async () => {
    await consumeFeatureLimit(CONFIG, user())
    expect(mockIncr).toHaveBeenCalledTimes(1)
    const [key, ttl, by] = mockIncr.mock.calls[0]
    expect(key).toContain('featlimit:teoria_search:user:u1:')
    expect(ttl).toBeGreaterThan(0)
    expect(by).toBe(1)
  })
})

describe('helpers de config', () => {
  it('getFeatureLimit usa el default si no hay env válido', () => {
    expect(getFeatureLimit(CONFIG)).toBe(5)
    process.env.TEORIA_SEARCH_FREE_LIMIT = '0' // inválido (<=0)
    expect(getFeatureLimit(CONFIG)).toBe(5)
    process.env.TEORIA_SEARCH_FREE_LIMIT = '8'
    expect(getFeatureLimit(CONFIG)).toBe(8)
  })

  it('getFeatureLimitMode default on', () => {
    expect(getFeatureLimitMode('teoria_search')).toBe('on')
    process.env.TEORIA_SEARCH_LIMIT_MODE = 'shadow'
    expect(getFeatureLimitMode('teoria_search')).toBe('shadow')
  })
})
