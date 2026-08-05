/**
 * @jest-environment node
 */
// __tests__/referrals/rewards-endpoints.test.ts — CAPA unit de los endpoints admin de bug/UGC.

import { NextResponse, NextRequest } from 'next/server'

jest.mock('@/lib/api/shared/auth', () => ({ requireAdmin: jest.fn() }))
jest.mock('@/lib/referrals/observability', () => ({ emitReferralEvent: jest.fn() }))
jest.mock('@/lib/referrals/queries', () => ({
  getPendingRewardSubmissions: jest.fn(),
  createRewardSubmission: jest.fn(),
  findUserIdByEmail: jest.fn(),
  payRewardSubmission: jest.fn(),
}))

import { requireAdmin } from '@/lib/api/shared/auth'
import { emitReferralEvent } from '@/lib/referrals/observability'
import {
  getPendingRewardSubmissions, createRewardSubmission, findUserIdByEmail, payRewardSubmission,
} from '@/lib/referrals/queries'
import { _GET, _POST } from '@/app/api/admin/rewards/route'
import { _POST as _PAY } from '@/app/api/admin/rewards/pay/route'

const mAdmin = requireAdmin as unknown as jest.Mock
const mList = getPendingRewardSubmissions as unknown as jest.Mock
const mCreate = createRewardSubmission as unknown as jest.Mock
const mFind = findUserIdByEmail as unknown as jest.Mock
const mPay = payRewardSubmission as unknown as jest.Mock
const mEmit = emitReferralEvent as unknown as jest.Mock

const post = (url: string, body: unknown) =>
  new NextRequest(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const get = (url: string) => new NextRequest(url)
const asAdmin = () => mAdmin.mockResolvedValue({ ok: true, user: { id: 'admin1' } })

const RURL = 'https://www.vence.es/api/admin/rewards'

describe('admin bug/UGC rewards', () => {
  afterEach(() => jest.clearAllMocks())

  it('GET no-admin → 403', async () => {
    mAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 403 }) })
    expect((await _GET(get(RURL))).status).toBe(403)
    expect(mList).not.toHaveBeenCalled()
  })

  it('GET admin → lista de recompensas', async () => {
    asAdmin(); mList.mockResolvedValue([{ id: 's1', type: 'ugc', amount: '5' }])
    const res = await _GET(get(RURL))
    expect((await res.json()).rewards).toHaveLength(1)
  })

  it('POST create sin email/type → 400', async () => {
    asAdmin()
    expect((await _POST(post(RURL, { type: 'bug' }))).status).toBe(400)
  })

  it('POST create email no encontrado → 404', async () => {
    asAdmin(); mFind.mockResolvedValue(null)
    expect((await _POST(post(RURL, { email: 'x@y.z', type: 'bug' }))).status).toBe(404)
  })

  it('POST create válido → crea (resuelve userId por email)', async () => {
    asAdmin(); mFind.mockResolvedValue('u1'); mCreate.mockResolvedValue({ ok: true, id: 's1' })
    const res = await _POST(post(RURL, { email: 'a@b.c', type: 'ugc', url: 'https://t.me/x' }))
    expect(res.status).toBe(200)
    expect(mCreate).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', type: 'ugc', url: 'https://t.me/x' }))
  })

  // ── T-477: premiar A MANO una impugnación ────────────────────────────────────────────────
  //
  // El manual promete que «lo subjetivo se sigue premiando a mano» desde que el euro automático
  // exige motivo verificable. La puerta lo rechazaba con 400 mientras el dominio lo soportaba
  // entero, así que la única forma de cumplir la política era saltarse el endpoint.

  it('POST create type=impugnacion con disputeId → crea (1 €, el importe lo pone el dominio)', async () => {
    asAdmin(); mFind.mockResolvedValue('u1'); mCreate.mockResolvedValue({ ok: true, id: 's9' })
    const res = await _POST(post(RURL, { email: 'a@b.c', type: 'impugnacion', disputeId: 'd1' }))
    expect(res.status).toBe(200)
    expect(mCreate).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', type: 'impugnacion', disputeId: 'd1' }))
  })

  it('POST create type=impugnacion SIN disputeId → 400 (sin motivo no hay anti-duplicado)', async () => {
    asAdmin(); mFind.mockResolvedValue('u1')
    const res = await _POST(post(RURL, { email: 'a@b.c', type: 'impugnacion' }))
    expect(res.status).toBe(400)
    // Y no llega al dominio: se para en la puerta, no se crea nada a medias.
    expect(mCreate).not.toHaveBeenCalled()
  })

  it('POST create la MISMA impugnación dos veces → 409 (el euro no se paga dos veces)', async () => {
    asAdmin(); mFind.mockResolvedValue('u1'); mCreate.mockResolvedValue({ ok: false, reason: 'duplicate' })
    const res = await _POST(post(RURL, { email: 'a@b.c', type: 'impugnacion', disputeId: 'd1' }))
    expect(res.status).toBe(409)
    expect(mEmit).toHaveBeenCalledWith('reward_duplicate', expect.objectContaining({ userId: 'u1' }))
  })

  it('un type inventado sigue rechazándose (la puerta se abre a UNO, no a cualquiera)', async () => {
    asAdmin(); mFind.mockResolvedValue('u1')
    expect((await _POST(post(RURL, { email: 'a@b.c', type: 'referido' }))).status).toBe(400)
  })

  it('POST create supera el tope → 409', async () => {
    asAdmin(); mFind.mockResolvedValue('u1'); mCreate.mockResolvedValue({ ok: false, reason: 'monthly_cap' })
    expect((await _POST(post(RURL, { email: 'a@b.c', type: 'ugc' }))).status).toBe(409)
  })

  it('POST create motivo DUPLICADO → 409 + evento reward_duplicate', async () => {
    asAdmin(); mFind.mockResolvedValue('u1'); mCreate.mockResolvedValue({ ok: false, reason: 'duplicate' })
    const res = await _POST(post(RURL, { email: 'a@b.c', type: 'bug', feedbackId: 'fb1' }))
    expect(res.status).toBe(409)
    expect(mEmit).toHaveBeenCalledWith('reward_duplicate', expect.objectContaining({ userId: 'u1' }))
  })

  it('PAY sin submissionId → 400', async () => {
    asAdmin()
    expect((await _PAY(post(`${RURL}/pay`, {}))).status).toBe(400)
  })

  it('PAY válido → 200 (approved_by = admin)', async () => {
    asAdmin(); mPay.mockResolvedValue({ ok: true, payoutId: 'p1' })
    const res = await _PAY(post(`${RURL}/pay`, { submissionId: 's1', giftcardRef: 'AMZN' }))
    expect(res.status).toBe(200)
    expect(mPay).toHaveBeenCalledWith(expect.objectContaining({ submissionId: 's1', adminUserId: 'admin1' }))
  })

  it('PAY en hold (UGC no vencido) → 409', async () => {
    asAdmin(); mPay.mockResolvedValue({ ok: false, reason: 'in_hold' })
    expect((await _PAY(post(`${RURL}/pay`, { submissionId: 's1' }))).status).toBe(409)
  })
})
