/** @jest-environment node */
// Tests de los endpoints admin de notificaciones (Fase C1, events + users):
//   GET /api/v2/admin/notification-events       (embed user_profiles)
//   GET /api/v2/admin/notification-users        (métricas+perfil+conteos)
//   GET /api/v2/admin/notification-user-events  (eventos de un userId)

import { NextRequest } from 'next/server'

const mockRequireAdmin = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/shared/auth', () => ({ requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a) }))
jest.mock('@/db/client', () => ({ getAdminDb: () => ({ execute: mockExecute }) }))
jest.mock('@/lib/api/withErrorLogging', () => ({ withErrorLogging: (_p: string, h: unknown) => h }))

import { GET as EVENTS } from '@/app/api/v2/admin/notification-events/route'
import { GET as USERS } from '@/app/api/v2/admin/notification-users/route'
import { GET as USER_EVENTS } from '@/app/api/v2/admin/notification-user-events/route'

const UID = '11111111-1111-4111-8111-111111111111'
function req(url = 'https://x') {
  return { headers: { get: () => null }, url } as unknown as NextRequest
}
async function forbidden() {
  const { NextResponse } = await import('next/server')
  return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue({ rows: [] })
})

describe('GET /api/v2/admin/notification-events', () => {
  test('403 si no admin', async () => {
    mockRequireAdmin.mockResolvedValue(await forbidden())
    expect((await EVENTS(req())).status).toBe(403)
  })
  test('admin → push + email', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'A', email: 'a@x' } })
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 'p1', user_profiles: { email: 'u@x' } }] }).mockResolvedValueOnce({ rows: [] })
    const j = await (await EVENTS(req())).json()
    expect(j.pushEvents).toHaveLength(1)
    expect(j.emailEvents).toEqual([])
  })
})

describe('GET /api/v2/admin/notification-users', () => {
  test('403 si no admin', async () => {
    mockRequireAdmin.mockResolvedValue(await forbidden())
    expect((await USERS(req())).status).toBe(403)
  })
  test('enriquece métricas con perfil + conteos', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'A', email: 'a@x' } })
    mockExecute
      .mockResolvedValueOnce({ rows: [{ user_id: UID, overall_engagement_score: 50 }] }) // metrics
      .mockResolvedValueOnce({ rows: [{ id: UID, email: 'u@x' }] })                       // profiles
      .mockResolvedValueOnce({ rows: [{ user_id: UID, n: 3 }] })                          // push counts
      .mockResolvedValueOnce({ rows: [{ user_id: UID, n: 2 }] })                          // email counts
    const j = await (await USERS(req())).json()
    expect(j.users[0].user_profiles.email).toBe('u@x')
    expect(j.users[0].recentPushEvents).toBe(3)
    expect(j.users[0].recentEmailEvents).toBe(2)
    expect(j.users[0].totalRecentEvents).toBe(5)
  })
})

describe('GET /api/v2/admin/notification-user-events', () => {
  test('403 si no admin', async () => {
    mockRequireAdmin.mockResolvedValue(await forbidden())
    expect((await USER_EVENTS(req(`https://x?userId=${UID}`))).status).toBe(403)
  })
  test('400 si userId no uuid', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'A', email: 'a@x' } })
    expect((await USER_EVENTS(req('https://x?userId=nope'))).status).toBe(400)
  })
  test('admin → eventos del usuario, query filtra por userId', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'A', email: 'a@x' } })
    mockExecute.mockResolvedValue({ rows: [{ id: 'e1' }] })
    const res = await USER_EVENTS(req(`https://x?userId=${UID}`))
    expect(res.status).toBe(200)
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain(UID)
  })
})
