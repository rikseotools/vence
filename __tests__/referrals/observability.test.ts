/**
 * @jest-environment node
 */
// __tests__/referrals/observability.test.ts — emisor de eventos + endpoint track-copy.

import { NextResponse, NextRequest } from 'next/server'

jest.mock('@/lib/observability/emit', () => ({ emitFireAndForget: jest.fn() }))
jest.mock('@/lib/api/shared/auth', () => ({ getAuthenticatedUser: jest.fn() }))

import { emitFireAndForget } from '@/lib/observability/emit'
import { emitReferralEvent } from '@/lib/referrals/observability'
import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import { _POST as trackCopy } from '@/app/api/referrals/track-copy/route'
import { _POST as trackView } from '@/app/api/referrals/track-view/route'

const mEmit = emitFireAndForget as unknown as jest.Mock
const mAuth = getAuthenticatedUser as unknown as jest.Mock

describe('emitReferralEvent', () => {
  afterEach(() => jest.clearAllMocks())

  it('emite a observable_events con source fargate + userId + metadata', () => {
    emitReferralEvent('referral_qualified', { userId: 'u1', metadata: { planType: 'monthly' } })
    expect(mEmit).toHaveBeenCalledWith(expect.objectContaining({
      source: 'fargate', eventType: 'referral_qualified', userId: 'u1',
      severity: 'info', metadata: { planType: 'monthly' },
    }))
  })

  it('severity warn cuando se indica', () => {
    emitReferralEvent('referral_attribute_rejected', { userId: 'u1', severity: 'warn', metadata: { reason: 'self_referral' } })
    expect(mEmit).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warn' }))
  })
})

describe('POST /api/referrals/track-copy', () => {
  afterEach(() => jest.clearAllMocks())
  const req = () => new NextRequest('https://www.vence.es/api/referrals/track-copy', { method: 'POST' })

  it('sin sesión → 401 (no emite)', async () => {
    mAuth.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 401 }) })
    expect((await trackCopy(req())).status).toBe(401)
    expect(mEmit).not.toHaveBeenCalled()
  })

  it('autenticado → emite referral_link_copy con el userId del token', async () => {
    mAuth.mockResolvedValue({ ok: true, user: { id: 'embajador1' } })
    const res = await trackCopy(req())
    expect(res.status).toBe(200)
    expect(mEmit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'referral_link_copy', userId: 'embajador1' }))
  })
})

describe('POST /api/referrals/track-view', () => {
  afterEach(() => jest.clearAllMocks())
  const req = () => new NextRequest('https://www.vence.es/api/referrals/track-view', { method: 'POST' })

  it('anónimo → emite referral_page_view con userId null + 200 (NO 401)', async () => {
    mAuth.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 401 }) })
    const res = await trackView(req())
    expect(res.status).toBe(200)
    expect(mEmit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'referral_page_view', userId: null }))
  })

  it('logueado → captura el userId del visitante (trazabilidad)', async () => {
    mAuth.mockResolvedValue({ ok: true, user: { id: 'visitante1' } })
    const res = await trackView(req())
    expect(res.status).toBe(200)
    expect(mEmit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'referral_page_view', userId: 'visitante1' }))
  })
})
