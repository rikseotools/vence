/**
 * @jest-environment node
 */
// __tests__/referrals/admin-embajador-panel.test.ts — CAPA unit del endpoint admin de vista del panel
// de embajador (solo lectura). Verifica: gate admin (403), UUID inválido (400), usuario inexistente
// (404), no-premium (isAmbassador:false) y camino feliz (200 + queries llamadas con el userId de la RUTA).

import { NextResponse, NextRequest } from 'next/server'

jest.mock('@/lib/api/shared/auth', () => ({ requireAdmin: jest.fn() }))
// El panel admin lee del PRIMARIO (getAdminDb) para datos en vivo, no de la réplica.
jest.mock('@/db/client', () => ({ getAdminDb: jest.fn() }))
jest.mock('@/lib/referrals/queries', () => ({
  getReferralCode: jest.fn(),
  getReferralStats: jest.fn(),
  getReferralDetails: jest.fn(),
  getReferralFunnelCounts: jest.fn(),
  getEmbajadorEarnings: jest.fn(),
  getUnseenEarningsCount: jest.fn(),
  getRecentEarnings: jest.fn(),
}))

import { requireAdmin } from '@/lib/api/shared/auth'
import { getAdminDb } from '@/db/client'
import {
  getReferralCode, getReferralStats, getReferralDetails, getReferralFunnelCounts,
  getEmbajadorEarnings, getUnseenEarningsCount, getRecentEarnings,
} from '@/lib/referrals/queries'
import { _GET } from '@/app/api/admin/embajadores/[userId]/panel/route'

const mAdmin = requireAdmin as unknown as jest.Mock
const mDb = getAdminDb as unknown as jest.Mock
const mCode = getReferralCode as unknown as jest.Mock
const mStats = getReferralStats as unknown as jest.Mock
const mDetails = getReferralDetails as unknown as jest.Mock
const mFunnel = getReferralFunnelCounts as unknown as jest.Mock
const mEarn = getEmbajadorEarnings as unknown as jest.Mock
const mUnseen = getUnseenEarningsCount as unknown as jest.Mock
const mRecent = getRecentEarnings as unknown as jest.Mock

const UID = '11111111-1111-4111-8111-111111111111'
const req = (id: string) => new NextRequest(`https://www.vence.es/api/admin/embajadores/${id}/panel`)
const ctx = (id: string) => ({ params: Promise.resolve({ userId: id }) })
const asAdmin = () => mAdmin.mockResolvedValue({ ok: true, user: { id: 'admin1', email: 'manueltrader@gmail.com' } })
const dbReturns = (rows: unknown[]) => mDb.mockReturnValue({ execute: jest.fn().mockResolvedValue(rows) })

beforeEach(() => {
  mCode.mockResolvedValue('abc123'); mStats.mockResolvedValue({ registros: 2, compradores: 1, conversion: 0.5 })
  mDetails.mockResolvedValue([]); mFunnel.mockResolvedValue({ copies: 3, clicks: 5 })
  mEarn.mockResolvedValue({ balance: 3, pending: 0, paidLifetime: 0, bySource: [] })
  mUnseen.mockResolvedValue(1); mRecent.mockResolvedValue([])
})
afterEach(() => jest.clearAllMocks())

describe('GET /api/admin/embajadores/[userId]/panel', () => {
  it('NO admin → 403 y no toca la BD', async () => {
    mAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 403 }) })
    const res = await _GET(req(UID), ctx(UID))
    expect(res.status).toBe(403)
    expect(mDb).not.toHaveBeenCalled()
    expect(mStats).not.toHaveBeenCalled()
  })

  it('userId no-UUID → 400 (no confía en el param a ciegas)', async () => {
    asAdmin()
    const res = await _GET(req('no-es-uuid'), ctx('no-es-uuid'))
    expect(res.status).toBe(400)
    expect(mDb).not.toHaveBeenCalled()
  })

  it('usuario inexistente → 404', async () => {
    asAdmin(); dbReturns([])
    const res = await _GET(req(UID), ctx(UID))
    expect(res.status).toBe(404)
    expect(mStats).not.toHaveBeenCalled()
  })

  it('usuario no premium → 200 isAmbassador:false (sin cargar el panel)', async () => {
    asAdmin(); dbReturns([{ full_name: 'Ana García', plan_type: 'free' }])
    const res = await _GET(req(UID), ctx(UID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ isAmbassador: false, firstName: 'Ana' })
    expect(mStats).not.toHaveBeenCalled()
  })

  it('premium → 200 con el panel, queries con el userId de la RUTA', async () => {
    asAdmin(); dbReturns([{ full_name: 'Ana García', plan_type: 'premium' }])
    const res = await _GET(req(UID), ctx(UID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isAmbassador).toBe(true)
    expect(body.firstName).toBe('Ana')
    expect(body.link).toBe('https://www.vence.es/r/abc123')
    expect(body.stats).toMatchObject({ registros: 2, compradores: 1 })
    // el userId servido es SIEMPRE el de la ruta (validado), nunca uno del cliente.
    // 2º arg = el executor primario (getAdminDb) que se pasa para leer EN VIVO.
    expect(mStats).toHaveBeenCalledWith(UID, expect.anything())
    expect(mEarn).toHaveBeenCalledWith(UID, expect.anything())
  })
})
