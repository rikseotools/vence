/**
 * @jest-environment node
 */
// __tests__/referrals/attribute-endpoint.test.ts — CAPA unit del endpoint POST /api/referrals/attribute.

import { NextResponse, NextRequest } from 'next/server'

jest.mock('@/lib/api/shared/auth', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/lib/referrals/queries', () => ({
  resolveActiveReferralCode: jest.fn(),
  attributeReferral: jest.fn(),
  getUserPlanType: jest.fn(),
  hasUserEverPaid: jest.fn(),
}))

import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import {
  resolveActiveReferralCode, attributeReferral, getUserPlanType, hasUserEverPaid,
} from '@/lib/referrals/queries'
import { _POST } from '@/app/api/referrals/attribute/route'

const mAuth = getAuthenticatedUser as unknown as jest.Mock
const mResolve = resolveActiveReferralCode as unknown as jest.Mock
const mAttr = attributeReferral as unknown as jest.Mock
const mPlan = getUserPlanType as unknown as jest.Mock
const mPaid = hasUserEverPaid as unknown as jest.Mock

const req = (cookie?: string) =>
  new NextRequest('https://www.vence.es/api/referrals/attribute', {
    method: 'POST',
    headers: cookie ? { cookie } : {},
  })

describe('POST /api/referrals/attribute', () => {
  beforeEach(() => mAuth.mockResolvedValue({ ok: true, user: { id: 'referred' } }))
  afterEach(() => jest.clearAllMocks())

  it('sin sesión → 401', async () => {
    mAuth.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 401 }) })
    const res = await _POST(req('vence_ref=abc'))
    expect(res.status).toBe(401)
  })

  it('sin cookie ref → no_ref', async () => {
    const res = await _POST(req())
    expect(await res.json()).toEqual({ attributed: false, reason: 'no_ref' })
  })

  it('código inválido → code_invalid', async () => {
    mResolve.mockResolvedValue(null)
    const res = await _POST(req('vence_ref=bad'))
    expect(await res.json()).toEqual({ attributed: false, reason: 'code_invalid' })
  })

  it('elegible → attributed:true (pasa premium + never-paid a attributeReferral)', async () => {
    mResolve.mockResolvedValue({ ownerUserId: 'owner' })
    mPlan.mockResolvedValue('premium')
    mPaid.mockResolvedValue(false)
    mAttr.mockResolvedValue({ ok: true, referralId: 'r1', referrerUserId: 'owner' })
    const res = await _POST(req('vence_ref=abc'))
    expect(await res.json()).toEqual({ attributed: true, alreadyAttributed: false })
    expect(mAttr).toHaveBeenCalledWith(expect.objectContaining({
      code: 'abc', referredUserId: 'referred', referrerIsActivePremium: true, referredHasEverPaid: false,
    }))
  })

  it('no elegible → attributed:false con la razón', async () => {
    mResolve.mockResolvedValue({ ownerUserId: 'owner' })
    mPlan.mockResolvedValue('free')
    mPaid.mockResolvedValue(false)
    mAttr.mockResolvedValue({ ok: false, reason: 'referrer_not_premium' })
    const res = await _POST(req('vence_ref=abc'))
    expect(await res.json()).toEqual({ attributed: false, reason: 'referrer_not_premium' })
  })
})
