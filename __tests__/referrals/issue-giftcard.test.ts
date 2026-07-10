/**
 * @jest-environment node
 */
// __tests__/referrals/issue-giftcard.test.ts — CAPA unit del endpoint admin de emisión de vale.
// Foco en la SEGURIDAD DE DINERO: no comprar sin admin, sin saldo o con denominación inválida; y si
// la compra falla NO registrar el payout (no descuadrar el saldo).

import { NextResponse, NextRequest } from 'next/server'

jest.mock('@/lib/api/shared/auth', () => ({ requireAdmin: jest.fn() }))
jest.mock('@/lib/referrals/observability', () => ({ emitReferralEvent: jest.fn() }))
jest.mock('@/lib/referrals/bitrefill', () => ({ purchaseAmazonGiftCard: jest.fn() }))
jest.mock('@/lib/referrals/queries', () => ({ getUserOwedBalance: jest.fn(), payAccumulated: jest.fn() }))
// isValidDenomination NO se mockea (real): 5 válido, 3 inválido.

import { requireAdmin } from '@/lib/api/shared/auth'
import { getUserOwedBalance, payAccumulated } from '@/lib/referrals/queries'
import { purchaseAmazonGiftCard } from '@/lib/referrals/bitrefill'
import { _POST } from '@/app/api/admin/rewards/issue-giftcard/route'

const mAdmin = requireAdmin as unknown as jest.Mock
const mBal = getUserOwedBalance as unknown as jest.Mock
const mPay = payAccumulated as unknown as jest.Mock
const mBuy = purchaseAmazonGiftCard as unknown as jest.Mock

const UID = '11111111-1111-4111-8111-111111111111'
const post = (body: unknown) =>
  new NextRequest('https://www.vence.es/api/admin/rewards/issue-giftcard', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
const asAdmin = () => mAdmin.mockResolvedValue({ ok: true, user: { id: 'admin1' } })

afterEach(() => jest.clearAllMocks())

describe('POST /api/admin/rewards/issue-giftcard', () => {
  it('no admin → 403 y no compra', async () => {
    mAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 403 }) })
    expect((await _POST(post({ userId: UID, amount: 5 }))).status).toBe(403)
    expect(mBuy).not.toHaveBeenCalled()
  })

  it('denominación inválida (3 €) → 400 y no compra', async () => {
    asAdmin()
    expect((await _POST(post({ userId: UID, amount: 3 }))).status).toBe(400)
    expect(mBuy).not.toHaveBeenCalled()
  })

  it('saldo insuficiente → 409 y NO compra (no gastar sin saldo)', async () => {
    asAdmin(); mBal.mockResolvedValue(3)
    expect((await _POST(post({ userId: UID, amount: 5 }))).status).toBe(409)
    expect(mBuy).not.toHaveBeenCalled()
  })

  it('la compra falla → 502 y NO registra payout (no descuadre)', async () => {
    asAdmin(); mBal.mockResolvedValue(10)
    mBuy.mockResolvedValue({ ok: false, code: null, error: 'http_500', dryRun: false })
    expect((await _POST(post({ userId: UID, amount: 5 }))).status).toBe(502)
    expect(mPay).not.toHaveBeenCalled()
  })

  it('éxito (dry-run) → 200 y registra el payout con el código y purchasedVia', async () => {
    asAdmin(); mBal.mockResolvedValue(10)
    mBuy.mockResolvedValue({ ok: true, code: 'DRYRUN-AMZ-5EUR', dryRun: true, ref: 'x' })
    mPay.mockResolvedValue({ ok: true, payoutId: 'p1' })
    const res = await _POST(post({ userId: UID, amount: 5 }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, dryRun: true, code: 'DRYRUN-AMZ-5EUR' })
    expect(mPay).toHaveBeenCalledWith(expect.objectContaining({
      userId: UID, amount: 5, giftcardRef: 'DRYRUN-AMZ-5EUR', purchasedVia: 'bitrefill_dryrun',
    }))
  })
})
