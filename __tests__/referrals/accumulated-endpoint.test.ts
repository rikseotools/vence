/**
 * @jest-environment node
 */
// __tests__/referrals/accumulated-endpoint.test.ts — CAPA unit del endpoint de pago acumulado.

import { NextResponse, NextRequest } from 'next/server'

jest.mock('@/lib/api/shared/auth', () => ({ requireAdmin: jest.fn() }))
jest.mock('@/lib/referrals/observability', () => ({ emitReferralEvent: jest.fn() }))
jest.mock('@/lib/referrals/queries', () => ({
  getEmbajadoresWithBalance: jest.fn(),
  payAccumulated: jest.fn(),
}))

import { requireAdmin } from '@/lib/api/shared/auth'
import { getEmbajadoresWithBalance, payAccumulated } from '@/lib/referrals/queries'
import { _GET, _POST } from '@/app/api/admin/rewards/accumulated/route'

const mAdmin = requireAdmin as unknown as jest.Mock
const mBalances = getEmbajadoresWithBalance as unknown as jest.Mock
const mPay = payAccumulated as unknown as jest.Mock

const get = () => new NextRequest('https://www.vence.es/api/admin/rewards/accumulated')
const post = (body: unknown) => new NextRequest('https://www.vence.es/api/admin/rewards/accumulated', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})
const asAdmin = () => mAdmin.mockResolvedValue({ ok: true, user: { id: 'admin1' } })

describe('admin /api/admin/rewards/accumulated', () => {
  afterEach(() => jest.clearAllMocks())

  it('GET no-admin → 403', async () => {
    mAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 403 }) })
    expect((await _GET(get())).status).toBe(403)
  })

  it('GET admin → balances con denominación sugerida (13€ → sugiere 10€)', async () => {
    asAdmin()
    mBalances.mockResolvedValue([{ userId: 'u1', name: 'Ana', email: 'a@b.c', balance: 13 }])
    const res = await _GET(get())
    const body = await res.json()
    expect(body.balances[0]).toMatchObject({ userId: 'u1', balance: 13, suggested: 10 })
  })

  it('POST sin userId/amount → 400', async () => {
    asAdmin()
    expect((await _POST(post({ userId: 'u1' }))).status).toBe(400)
  })

  it('POST válido → paga (amount + admin del token)', async () => {
    asAdmin(); mPay.mockResolvedValue({ ok: true, payoutId: 'p1' })
    const res = await _POST(post({ userId: 'u1', amount: 10, giftcardRef: 'AMZN' }))
    expect(res.status).toBe(200)
    expect(mPay).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', amount: 10, adminUserId: 'admin1' }))
  })

  it('POST que excede saldo → 409', async () => {
    asAdmin(); mPay.mockResolvedValue({ ok: false, reason: 'amount_exceeds_balance(5)' })
    expect((await _POST(post({ userId: 'u1', amount: 10 }))).status).toBe(409)
  })
})
