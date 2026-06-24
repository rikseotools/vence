/** @jest-environment node */
// Tests de los endpoints que reemplazan rpc/from de SharePrompt + admin/configuracion (C1):
//   GET /api/v2/share-stats          (verifyAuth, get_user_share_stats)
//   GET /api/v2/admin/email-logs     (requireAdmin, email_logs + embed)

import { NextRequest } from 'next/server'

const mockVerifyAuth = jest.fn()
const mockRequireAdmin = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({
  verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a),
}))
jest.mock('@/lib/api/shared/auth', () => ({
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
}))
jest.mock('@/db/client', () => ({
  getAdminDb: () => ({ execute: mockExecute }),
}))
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_p: string, h: unknown) => h,
}))

import { GET as SHARE_STATS } from '@/app/api/v2/share-stats/route'
import { GET as EMAIL_LOGS } from '@/app/api/v2/admin/email-logs/route'

function req() {
  return { headers: { get: () => null }, url: 'https://x' } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue({ rows: [] })
})

describe('GET /api/v2/share-stats', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await SHARE_STATS(req())).status).toBe(401)
  })
  test('devuelve stats del usuario del token', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [{ total_shares: 3, total_tests: 9 }] })
    const j = await (await SHARE_STATS(req())).json()
    expect(j.stats).toEqual({ total_shares: 3, total_tests: 9 })
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
  })
  test('stats=null si sin filas', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    expect((await (await SHARE_STATS(req())).json()).stats).toBeNull()
  })

  test('degrada a stats:null (200) si la función SQL falla (rota en BD), sin 500', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockRejectedValueOnce(new Error('relation "detailed_answers" does not exist'))
    const res = await SHARE_STATS(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, stats: null })
  })
})

describe('GET /api/v2/admin/email-logs', () => {
  test('403 si no admin', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) })
    expect((await EMAIL_LOGS(req())).status).toBe(403)
    expect(mockExecute).not.toHaveBeenCalled()
  })
  test('admin → devuelve logs', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'A', email: 'a@x' } })
    mockExecute.mockResolvedValue({ rows: [{ id: 'l1', user_profiles: { email: 'u@x' } }] })
    expect((await (await EMAIL_LOGS(req())).json()).logs).toHaveLength(1)
  })
})
