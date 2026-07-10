/**
 * @jest-environment node
 */
// __tests__/referrals/badge-endpoint.test.ts — CAPA unit del endpoint /api/referrals/badge.
// GET → nº ingresos sin ver (0 si no premium). POST → marca visto. Auth y queries mockeados.

import { NextResponse, NextRequest } from 'next/server'

jest.mock('@/lib/api/shared/auth', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/lib/referrals/queries', () => ({
  getUserPlanType: jest.fn(),
  getUnseenEarningsCount: jest.fn(),
  markEarningsSeen: jest.fn(),
}))

import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import { getUserPlanType, getUnseenEarningsCount, markEarningsSeen } from '@/lib/referrals/queries'
import { _GET, _POST } from '@/app/api/referrals/badge/route'

const mAuth = getAuthenticatedUser as unknown as jest.Mock
const mPlan = getUserPlanType as unknown as jest.Mock
const mUnseen = getUnseenEarningsCount as unknown as jest.Mock
const mSeen = markEarningsSeen as unknown as jest.Mock

const req = (method = 'GET') => new NextRequest('https://www.vence.es/api/referrals/badge', { method })

describe('/api/referrals/badge', () => {
  afterEach(() => jest.clearAllMocks())

  it('sin sesión → 401 del auth (GET)', async () => {
    mAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'no' }, { status: 401 }) })
    const res = await _GET(req())
    expect(res.status).toBe(401)
    expect(mUnseen).not.toHaveBeenCalled()
  })

  it('GET no premium → unseen:0 sin consultar la BD', async () => {
    mAuth.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    mPlan.mockResolvedValue('free')
    const res = await _GET(req())
    expect(await res.json()).toEqual({ unseen: 0 })
    expect(mUnseen).not.toHaveBeenCalled()
  })

  it('GET premium → devuelve el conteo de sin-ver', async () => {
    mAuth.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    mPlan.mockResolvedValue('premium')
    mUnseen.mockResolvedValue(3)
    const res = await _GET(req())
    expect(await res.json()).toEqual({ unseen: 3 })
    expect(mUnseen).toHaveBeenCalledWith('u1')
  })

  it('POST → marca visto', async () => {
    mAuth.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    mSeen.mockResolvedValue(undefined)
    const res = await _POST(req('POST'))
    expect(await res.json()).toEqual({ ok: true })
    expect(mSeen).toHaveBeenCalledWith('u1')
  })
})
