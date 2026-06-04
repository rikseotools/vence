/**
 * Tests de comportamiento de lib/api/chatLimit.ts — el tope diario del chat IA.
 *
 * Cubre: premium salta, buckets separados (explain/free) para free logueado,
 * cubo único 'anon' para anónimos (device→IP), límites por env, fail-open ante
 * Redis caído, e idempotencia de clave entre status e increment.
 */

import {
  getChatLimitStatus,
  incrementChatUsage,
  getChatLimitMode,
  getChatLimits,
} from '@/lib/api/chatLimit'
import { getCounter, incrementCounterWithTtl } from '@/lib/cache/redis'

jest.mock('@/lib/cache/redis', () => ({
  getCounter: jest.fn(),
  incrementCounterWithTtl: jest.fn(),
}))

const mockGetCounter = getCounter as jest.MockedFunction<typeof getCounter>
const mockIncr = incrementCounterWithTtl as jest.MockedFunction<typeof incrementCounterWithTtl>

const ORIG_ENV = { ...process.env }

beforeEach(() => {
  jest.clearAllMocks()
  mockGetCounter.mockResolvedValue(0)
  mockIncr.mockResolvedValue(1)
  // limpiar overrides de límite/modo entre tests
  delete process.env.CHAT_LIMIT_ANON
  delete process.env.CHAT_LIMIT_FREE_EXPLAIN
  delete process.env.CHAT_LIMIT_FREE_CHAT
  delete process.env.CHAT_LIMITS_MODE
})

afterAll(() => {
  process.env = ORIG_ENV
})

describe('getChatLimitStatus', () => {
  it('premium: siempre allowed, limit Infinity, NO lee contador', async () => {
    const r = await getChatLimitStatus({ userId: 'u1', deviceId: 'd1', ip: '1.1.1.1', bucket: 'explain', isPremium: true })
    expect(r.allowed).toBe(true)
    expect(r.limit).toBe(Infinity)
    expect(mockGetCounter).not.toHaveBeenCalled()
  })

  it('free logueado bucket explain: límite por defecto 10', async () => {
    mockGetCounter.mockResolvedValue(9)
    const r = await getChatLimitStatus({ userId: 'u1', ip: '1.1.1.1', bucket: 'explain', isPremium: false })
    expect(r.scope).toBe('user')
    expect(r.bucket).toBe('explain')
    expect(r.limit).toBe(10)
    expect(r.allowed).toBe(true) // 9 < 10
  })

  it('free logueado bucket explain: bloquea al alcanzar 10', async () => {
    mockGetCounter.mockResolvedValue(10)
    const r = await getChatLimitStatus({ userId: 'u1', ip: '1.1.1.1', bucket: 'explain', isPremium: false })
    expect(r.allowed).toBe(false)
  })

  it('free logueado bucket free: límite por defecto 5', async () => {
    mockGetCounter.mockResolvedValue(5)
    const r = await getChatLimitStatus({ userId: 'u1', ip: '1.1.1.1', bucket: 'free', isPremium: false })
    expect(r.bucket).toBe('free')
    expect(r.limit).toBe(5)
    expect(r.allowed).toBe(false)
  })

  it('anónimo con deviceId: scope device, cubo anon, límite 5', async () => {
    const r = await getChatLimitStatus({ userId: null, deviceId: 'dev-abc', ip: '1.1.1.1', bucket: 'explain', isPremium: false })
    expect(r.scope).toBe('device')
    expect(r.bucket).toBe('anon') // explain se normaliza a anon para anónimos
    expect(r.limit).toBe(5)
    const key = mockGetCounter.mock.calls[0][0]
    expect(key).toContain('chatlimit:anon:device:dev-abc:')
  })

  it('anónimo sin deviceId: cae a scope ip', async () => {
    const r = await getChatLimitStatus({ userId: null, deviceId: null, ip: '9.9.9.9', bucket: 'free', isPremium: false })
    expect(r.scope).toBe('ip')
    expect(r.bucket).toBe('anon')
    const key = mockGetCounter.mock.calls[0][0]
    expect(key).toContain('chatlimit:anon:ip:9.9.9.9:')
  })

  it('userId="anonymous" se trata como anónimo', async () => {
    const r = await getChatLimitStatus({ userId: 'anonymous', deviceId: 'dev-x', ip: '1.1.1.1', bucket: 'free', isPremium: false })
    expect(r.scope).toBe('device')
    expect(r.bucket).toBe('anon')
  })

  it('buckets explain y free usan claves distintas (cubos separados)', async () => {
    await getChatLimitStatus({ userId: 'u1', ip: '1.1.1.1', bucket: 'explain', isPremium: false })
    await getChatLimitStatus({ userId: 'u1', ip: '1.1.1.1', bucket: 'free', isPremium: false })
    const k1 = mockGetCounter.mock.calls[0][0]
    const k2 = mockGetCounter.mock.calls[1][0]
    expect(k1).toContain('chatlimit:explain:user:u1:')
    expect(k2).toContain('chatlimit:free:user:u1:')
    expect(k1).not.toBe(k2)
  })

  it('fail-open: Redis caído (getCounter=0) → allowed aunque límite sea bajo', async () => {
    mockGetCounter.mockResolvedValue(0)
    const r = await getChatLimitStatus({ userId: 'u1', ip: '1.1.1.1', bucket: 'free', isPremium: false })
    expect(r.allowed).toBe(true)
  })

  it('respeta overrides de límite por env', async () => {
    process.env.CHAT_LIMIT_FREE_EXPLAIN = '3'
    mockGetCounter.mockResolvedValue(3)
    const r = await getChatLimitStatus({ userId: 'u1', ip: '1.1.1.1', bucket: 'explain', isPremium: false })
    expect(r.limit).toBe(3)
    expect(r.allowed).toBe(false)
  })
})

describe('incrementChatUsage', () => {
  it('premium: no incrementa', async () => {
    await incrementChatUsage({ userId: 'u1', ip: '1.1.1.1', bucket: 'explain', isPremium: true })
    expect(mockIncr).not.toHaveBeenCalled()
  })

  it('free: incrementa la MISMA clave que lee el gate (idempotencia de identidad)', async () => {
    await getChatLimitStatus({ userId: 'u1', ip: '1.1.1.1', bucket: 'explain', isPremium: false })
    await incrementChatUsage({ userId: 'u1', ip: '1.1.1.1', bucket: 'explain', isPremium: false })
    const statusKey = mockGetCounter.mock.calls[0][0]
    const incrKey = mockIncr.mock.calls[0][0]
    expect(incrKey).toBe(statusKey)
  })

  it('anónimo: incrementa el cubo anon por dispositivo', async () => {
    await incrementChatUsage({ userId: null, deviceId: 'dev-z', ip: '1.1.1.1', bucket: 'free', isPremium: false })
    const key = mockIncr.mock.calls[0][0]
    expect(key).toContain('chatlimit:anon:device:dev-z:')
    // TTL > 0
    expect(mockIncr.mock.calls[0][1]).toBeGreaterThan(0)
  })
})

describe('getChatLimitMode', () => {
  it('default es "on"', () => {
    expect(getChatLimitMode()).toBe('on')
  })
  it('reconoce shadow y off', () => {
    process.env.CHAT_LIMITS_MODE = 'shadow'
    expect(getChatLimitMode()).toBe('shadow')
    process.env.CHAT_LIMITS_MODE = 'off'
    expect(getChatLimitMode()).toBe('off')
  })
})

describe('getChatLimits', () => {
  it('defaults: anon 5, freeExplain 10, freeChat 5', () => {
    expect(getChatLimits()).toEqual({ anon: 5, freeExplain: 10, freeChat: 5 })
  })
})
