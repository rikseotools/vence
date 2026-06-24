/** @jest-environment node */
// Tests de GET /api/v2/admin/notification-overview (Fase C1, migración de
// /admin/notificaciones/overview). requireAdmin + enriquecimiento con perfil.

import { NextRequest } from 'next/server'

const mockRequireAdmin = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/shared/auth', () => ({ requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a) }))
jest.mock('@/db/client', () => ({ getAdminDb: () => ({ execute: mockExecute }) }))
jest.mock('@/lib/api/withErrorLogging', () => ({ withErrorLogging: (_p: string, h: unknown) => h }))

import { GET } from '@/app/api/v2/admin/notification-overview/route'

function req(url = 'https://x?days=30') {
  return { headers: { get: () => null }, url } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue({ rows: [] })
})

describe('GET /api/v2/admin/notification-overview', () => {
  test('403 si no admin', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) })
    expect((await GET(req())).status).toBe(403)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('admin → enriquece eventos con user_profiles', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'A', email: 'a@x' } })
    mockExecute
      .mockResolvedValueOnce({ rows: [{ id: 'p1', user_id: 'U1' }] })  // push
      .mockResolvedValueOnce({ rows: [{ id: 'e1', user_id: 'U2' }] })  // email
      .mockResolvedValueOnce({ rows: [{ user_id: 'U1', overall_engagement_score: 5 }] }) // metrics
      .mockResolvedValueOnce({ rows: [{ id: 'U1', email: 'u1@x' }, { id: 'U2', email: 'u2@x' }] }) // profiles
    const j = await (await GET(req())).json()
    expect(j.pushEvents[0].user_profiles).toEqual({ id: 'U1', email: 'u1@x' })
    expect(j.emailEvents[0].user_profiles).toEqual({ id: 'U2', email: 'u2@x' })
    expect(j.userMetrics[0].user_profiles.id).toBe('U1')
  })

  test('sin eventos no consulta perfiles (4ª query no corre)', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'A', email: 'a@x' } })
    await GET(req())
    expect(mockExecute).toHaveBeenCalledTimes(3) // push, email, metrics; sin profiles
  })
})
