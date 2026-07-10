/**
 * @jest-environment node
 */
// __tests__/referrals/admin-payouts-endpoint.test.ts — CAPA unit del endpoint admin de payout.

import { NextResponse, NextRequest } from 'next/server'

jest.mock('@/lib/api/shared/auth', () => ({ requireAdmin: jest.fn() }))
jest.mock('@/lib/referrals/observability', () => ({ emitReferralEvent: jest.fn() }))
jest.mock('@/lib/referrals/queries', () => ({
  getPayableReferrals: jest.fn(),
  payReferral: jest.fn(),
}))

import { requireAdmin } from '@/lib/api/shared/auth'
import { getPayableReferrals, payReferral } from '@/lib/referrals/queries'
import { _GET, _POST } from '@/app/api/admin/referrals/payouts/route'

const mAdmin = requireAdmin as unknown as jest.Mock
const mList = getPayableReferrals as unknown as jest.Mock
const mPay = payReferral as unknown as jest.Mock

const postReq = (body: unknown) =>
  new NextRequest('https://www.vence.es/api/admin/referrals/payouts', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
const getReq = () => new NextRequest('https://www.vence.es/api/admin/referrals/payouts')

describe('admin /api/admin/referrals/payouts', () => {
  afterEach(() => jest.clearAllMocks())

  it('GET no-admin → 403', async () => {
    mAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 403 }) })
    const res = await _GET(getReq())
    expect(res.status).toBe(403)
    expect(mList).not.toHaveBeenCalled()
  })

  it('GET admin → lista de payables', async () => {
    mAdmin.mockResolvedValue({ ok: true, user: { id: 'admin1' } })
    mList.mockResolvedValue([{ referralId: 'r1', amount: '10' }])
    const res = await _GET(getReq())
    expect(res.status).toBe(200)
    expect((await res.json()).payables).toHaveLength(1)
  })

  it('POST sin referralId → 400', async () => {
    mAdmin.mockResolvedValue({ ok: true, user: { id: 'admin1' } })
    const res = await _POST(postReq({}))
    expect(res.status).toBe(400)
    expect(mPay).not.toHaveBeenCalled()
  })

  it('POST válido → paga (approved_by = admin del token) → 200', async () => {
    mAdmin.mockResolvedValue({ ok: true, user: { id: 'admin1' } })
    mPay.mockResolvedValue({ ok: true, payoutId: 'p1' })
    const res = await _POST(postReq({ referralId: 'r1', giftcardRef: 'AMZN-XXX', purchasedVia: 'bitrefill' }))
    expect(res.status).toBe(200)
    expect(mPay).toHaveBeenCalledWith(expect.objectContaining({
      referralId: 'r1', adminUserId: 'admin1', giftcardRef: 'AMZN-XXX', purchasedVia: 'bitrefill',
    }))
  })

  it('POST cuando ya no es payable → 409', async () => {
    mAdmin.mockResolvedValue({ ok: true, user: { id: 'admin1' } })
    mPay.mockResolvedValue({ ok: false, reason: 'not_payable(paid)' })
    const res = await _POST(postReq({ referralId: 'r1' }))
    expect(res.status).toBe(409)
  })
})
