/** @jest-environment node */
// Tests de los endpoints que migran useIntelligentNotifications (Fase C1):
//   GET  /api/v2/notifications/system      (system notifs no abiertas)
//   POST /api/v2/notifications/mark-read   (marcar una)
//   GET  /api/v2/avatar/rotation           (settings + profile)
//   POST /api/v2/avatar/rotation/mark-read

import { NextRequest } from 'next/server'

const mockVerifyAuth = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({ verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a) }))
jest.mock('@/db/client', () => ({ getAdminDb: () => ({ execute: mockExecute }) }))
jest.mock('@/lib/api/withErrorLogging', () => ({ withErrorLogging: (_p: string, h: unknown) => h }))

import { GET as SYS } from '@/app/api/v2/notifications/system/route'
import { POST as SYS_READ } from '@/app/api/v2/notifications/mark-read/route'
import { GET as ROT } from '@/app/api/v2/avatar/rotation/route'
import { POST as ROT_READ } from '@/app/api/v2/avatar/rotation/mark-read/route'

const NID = '11111111-1111-4111-8111-111111111111'
function reqUrl() { return { headers: { get: () => null }, url: 'https://x' } as unknown as NextRequest }
function reqBody(b: unknown) { return { headers: { get: () => null }, url: 'https://x', json: async () => b } as unknown as NextRequest }
const AUTH = { success: true, userId: 'U_TOKEN', email: 'a@b.c' }

beforeEach(() => { jest.clearAllMocks(); mockExecute.mockResolvedValue({ rows: [] }) })

describe('notifications/system + mark-read', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await SYS(reqUrl())).status).toBe(401)
    expect((await SYS_READ(reqBody({ notificationId: NID }))).status).toBe(401)
  })
  test('system: filtra por user del token', async () => {
    mockVerifyAuth.mockResolvedValue(AUTH)
    mockExecute.mockResolvedValue({ rows: [{ id: 'n1' }] })
    expect((await (await SYS(reqUrl())).json()).notifications).toHaveLength(1)
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
  })
  test('mark-read: 400 sin uuid; OK + filtra por user del token', async () => {
    mockVerifyAuth.mockResolvedValue(AUTH)
    expect((await SYS_READ(reqBody({ notificationId: 'x' }))).status).toBe(400)
    await SYS_READ(reqBody({ notificationId: NID }))
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
  })
})

describe('avatar/rotation + mark-read', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await ROT(reqUrl())).status).toBe(401)
    expect((await ROT_READ(reqUrl())).status).toBe(401)
  })
  test('rotation: null si no hay pendiente (no consulta profile)', async () => {
    mockVerifyAuth.mockResolvedValue(AUTH)
    mockExecute.mockResolvedValueOnce({ rows: [{ rotation_notification_pending: false }] })
    const j = await (await ROT(reqUrl())).json()
    expect(j.avatarSettings).toBeNull()
    expect(mockExecute).toHaveBeenCalledTimes(1)
  })
  test('rotation: devuelve settings + profile si pendiente', async () => {
    mockVerifyAuth.mockResolvedValue(AUTH)
    mockExecute
      .mockResolvedValueOnce({ rows: [{ rotation_notification_pending: true, current_profile: 'p1' }] })
      .mockResolvedValueOnce({ rows: [{ emoji: '🦊', name_es: 'Zorro' }] })
    const j = await (await ROT(reqUrl())).json()
    expect(j.profile.emoji).toBe('🦊')
  })
  test('rotation/mark-read: filtra por user del token', async () => {
    mockVerifyAuth.mockResolvedValue(AUTH)
    await ROT_READ(reqUrl())
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
  })
})
