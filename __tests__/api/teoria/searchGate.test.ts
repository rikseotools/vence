/** @jest-environment node */
// Integración del ENDPOINT de gate de búsquedas (app/api/teoria/search).
// Ejercita el route handler REAL + el primitivo REAL (lib/api/featureLimits),
// mockeando solo la infra leaf (Redis, auth, BD, device/IP). Cubre el cableado
// que el unit del primitivo no ve: resolución de identidad, fail-open del check
// premium, forma del 429 (loggedIn), y que premium no consume cuota.

import { NextRequest } from 'next/server'

jest.mock('@/lib/cache/redis', () => ({
  getCounter: jest.fn(),
  incrementCounterWithTtl: jest.fn(),
}))
jest.mock('@/lib/api/auth/verifyAuth', () => ({ verifyAuthOptional: jest.fn() }))
jest.mock('@/lib/api/deviceLimit', () => ({ getDeviceIdFromRequest: jest.fn(() => null) }))
jest.mock('@/lib/api/rateLimit', () => ({ getClientIp: jest.fn(() => '9.9.9.9') }))
jest.mock('@/db/client', () => ({ getAdminDb: jest.fn() }))

import { GET } from '@/app/api/teoria/search/route'
import { getCounter, incrementCounterWithTtl } from '@/lib/cache/redis'
import { verifyAuthOptional } from '@/lib/api/auth/verifyAuth'
import { getAdminDb } from '@/db/client'

const mockGetCounter = getCounter as jest.MockedFunction<typeof getCounter>
const mockIncr = incrementCounterWithTtl as jest.MockedFunction<typeof incrementCounterWithTtl>
const mockAuth = verifyAuthOptional as jest.MockedFunction<typeof verifyAuthOptional>
const mockDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>

// getAdminDb().select().from().where().limit() → Promise<rows>
function dbReturning(rows: unknown[]) {
  const chain: any = {
    select: () => chain, from: () => chain, where: () => chain,
    limit: () => Promise.resolve(rows),
  }
  mockDb.mockReturnValue(chain)
}

const req = (q: string) => new NextRequest(`http://localhost/api/teoria/search?q=${encodeURIComponent(q)}`)

beforeEach(() => {
  jest.clearAllMocks()
  mockGetCounter.mockResolvedValue(0)
  mockIncr.mockResolvedValue(1)
  mockAuth.mockResolvedValue(null as any) // anónimo por defecto
  dbReturning([])
})

describe('GET /api/teoria/search (gate)', () => {
  it('query vacía: no gatea ni consume', async () => {
    const res = await GET(req(''))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ allowed: true, counted: false })
    expect(mockGetCounter).not.toHaveBeenCalled()
    expect(mockIncr).not.toHaveBeenCalled()
  })

  it('anónimo bajo el límite: 200 y consume 1', async () => {
    mockGetCounter.mockResolvedValue(2)
    const res = await GET(req('constitucion'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.allowed).toBe(true)
    expect(body.remaining).toBe(2) // 5 - (2+1)
    expect(mockIncr).toHaveBeenCalledTimes(1)
  })

  it('anónimo en el límite: 429 con loggedIn=false y NO consume', async () => {
    mockGetCounter.mockResolvedValue(5)
    const res = await GET(req('constitucion'))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.blocked).toBe(true)
    expect(body.loggedIn).toBe(false)
    expect(body.remaining).toBe(0)
    expect(mockIncr).not.toHaveBeenCalled()
  })

  it('logueado free en el límite: 429 con loggedIn=true', async () => {
    mockAuth.mockResolvedValue({ userId: 'u1' } as any)
    dbReturning([{ plan_type: 'free' }])
    mockGetCounter.mockResolvedValue(5)
    const res = await GET(req('constitucion'))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.loggedIn).toBe(true)
  })

  it('premium: 200, ilimitado, NO lee ni incrementa contador', async () => {
    mockAuth.mockResolvedValue({ userId: 'u1' } as any)
    dbReturning([{ plan_type: 'premium' }])
    mockGetCounter.mockResolvedValue(999)
    const res = await GET(req('constitucion'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isPremium).toBe(true)
    expect(mockGetCounter).not.toHaveBeenCalled()
    expect(mockIncr).not.toHaveBeenCalled()
  })

  it('trial cuenta como premium (ilimitado)', async () => {
    mockAuth.mockResolvedValue({ userId: 'u1' } as any)
    dbReturning([{ plan_type: 'trial' }])
    const res = await GET(req('constitucion'))
    const body = await res.json()
    expect(body.isPremium).toBe(true)
  })

  it('fail-open del check premium: si la BD lanza, trata como free (no premium gratis)', async () => {
    mockAuth.mockResolvedValue({ userId: 'u1' } as any)
    const chain: any = { select: () => chain, from: () => chain, where: () => chain, limit: () => Promise.reject(new Error('db down')) }
    mockDb.mockReturnValue(chain)
    mockGetCounter.mockResolvedValue(5)
    const res = await GET(req('constitucion'))
    expect(res.status).toBe(429) // free → aplica límite (no se cuela como premium)
  })
})
