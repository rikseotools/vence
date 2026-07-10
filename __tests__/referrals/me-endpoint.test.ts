/**
 * @jest-environment node
 */
// __tests__/referrals/me-endpoint.test.ts — CAPA unit del endpoint GET /api/referrals/me.
// Auth y queries mockeados (sin BD): verifica el gate premium y la forma de la respuesta.

import { NextResponse, NextRequest } from 'next/server'

jest.mock('@/lib/api/shared/auth', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/lib/referrals/queries', () => ({
  getUserPlanType: jest.fn(),
  getOrCreateReferralCode: jest.fn(),
  getReferralStats: jest.fn(),
  getReferralDetails: jest.fn(),
  getReferralFunnelCounts: jest.fn(),
  getEmbajadorEarnings: jest.fn(),
  getUnseenEarningsCount: jest.fn(),
  getRecentEarnings: jest.fn(),
}))

import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import {
  getUserPlanType, getOrCreateReferralCode, getReferralStats, getReferralDetails, getReferralFunnelCounts,
  getEmbajadorEarnings, getUnseenEarningsCount, getRecentEarnings,
} from '@/lib/referrals/queries'
import { _GET } from '@/app/api/referrals/me/route'

const mAuth = getAuthenticatedUser as unknown as jest.Mock
const mPlan = getUserPlanType as unknown as jest.Mock
const mCode = getOrCreateReferralCode as unknown as jest.Mock
const mStats = getReferralStats as unknown as jest.Mock
const mDetails = getReferralDetails as unknown as jest.Mock
const mFunnel = getReferralFunnelCounts as unknown as jest.Mock
const mEarn = getEmbajadorEarnings as unknown as jest.Mock
const mUnseen = getUnseenEarningsCount as unknown as jest.Mock
const mRecent = getRecentEarnings as unknown as jest.Mock

const req = () => new NextRequest('https://www.vence.es/api/referrals/me')

describe('GET /api/referrals/me', () => {
  afterEach(() => jest.clearAllMocks())

  it('sin sesión → devuelve la respuesta 401 del auth', async () => {
    mAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'no' }, { status: 401 }) })
    const res = await _GET(req())
    expect(res.status).toBe(401)
    expect(mPlan).not.toHaveBeenCalled()
  })

  it('usuario NO premium → isAmbassador:false (sin código ni stats)', async () => {
    mAuth.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    mPlan.mockResolvedValue('free')
    const res = await _GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ isAmbassador: false })
    expect(mCode).not.toHaveBeenCalled()
  })

  it('usuario premium → isAmbassador:true con código, enlace y métricas', async () => {
    mAuth.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    mPlan.mockResolvedValue('premium')
    mCode.mockResolvedValue('abc123def456')
    mStats.mockResolvedValue({ registros: 3, compradores: 1, conversion: 1 / 3 })
    mDetails.mockResolvedValue([{ name: 'Ana', city: 'Madrid', oposicion: 'auxiliar_administrativo_estado', status: 'pending', date: '2026-07-10' }])
    mFunnel.mockResolvedValue({ copies: 5, clicks: 12 })
    mEarn.mockResolvedValue({ balance: 10, earnedLifetime: 15, paidLifetime: 0, pending: 5, bySource: [{ source: 'referido', earned: 10, count: 1 }, { source: 'ugc', earned: 5, count: 1 }] })
    mUnseen.mockResolvedValue(2)
    mRecent.mockResolvedValue([{ source: 'referido', amount: 10, date: '2026-07-10' }])
    const res = await _GET(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isAmbassador).toBe(true)
    expect(body.code).toBe('abc123def456')
    expect(body.link).toContain('/r/abc123def456')
    expect(body.stats).toMatchObject({ registros: 3, compradores: 1 })
    expect(body.details).toHaveLength(1)
    expect(body.funnel).toEqual({ copies: 5, clicks: 12 })
    expect(body.earnings).toMatchObject({ balance: 10, pending: 5 })
    expect(body.earnings.bySource).toHaveLength(2)
    expect(body.unseen).toBe(2)
    expect(body.recent).toHaveLength(1)
  })
})
