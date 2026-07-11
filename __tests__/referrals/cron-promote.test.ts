/**
 * @jest-environment node
 */
// __tests__/referrals/cron-promote.test.ts — CAPA unit del cron promote (query mockeada + auth).

import { NextRequest } from 'next/server'

jest.mock('@/lib/referrals/observability', () => ({ emitReferralEvent: jest.fn() }))
jest.mock('@/lib/referrals/queries', () => ({ promoteEligibleToPayable: jest.fn() }))
import { promoteEligibleToPayable } from '@/lib/referrals/queries'
import { _GET } from '@/app/api/cron/referrals-promote/route'

const mPromote = promoteEligibleToPayable as unknown as jest.Mock
const req = (auth?: string) =>
  new NextRequest('https://www.vence.es/api/cron/referrals-promote', {
    headers: auth ? { authorization: auth } : {},
  })

describe('GET /api/cron/referrals-promote', () => {
  const OLD = process.env.CRON_SECRET
  beforeAll(() => { process.env.CRON_SECRET = 'sekret' })
  afterAll(() => { process.env.CRON_SECRET = OLD })
  afterEach(() => jest.clearAllMocks())

  it('sin Bearer correcto → 401 (no promueve)', async () => {
    const res = await _GET(req('Bearer wrong'))
    expect(res.status).toBe(401)
    expect(mPromote).not.toHaveBeenCalled()
  })

  it('sin header → 401', async () => {
    const res = await _GET(req())
    expect(res.status).toBe(401)
  })

  it('con secret correcto → promueve y devuelve el conteo', async () => {
    mPromote.mockResolvedValue(3)
    const res = await _GET(req('Bearer sekret'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, promoted: 3 })
  })
})
