/** @jest-environment node */
// Tests de los endpoints que reemplazan los 2 .from de app/Header.tsx (C1):
//   GET /api/v2/streak                       (user-scoped: current_streak del token)
//   GET /api/v2/admin/feedback/open-count    (requireAdmin: conversaciones abiertas)

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

import { GET as STREAK } from '@/app/api/v2/streak/route'
import { GET as OPEN_COUNT } from '@/app/api/v2/admin/feedback/open-count/route'

function req() {
  return { headers: { get: () => null }, url: 'https://x' } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue({ rows: [] })
})

describe('GET /api/v2/streak', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await STREAK(req())).status).toBe(401)
  })

  test('devuelve current_streak del usuario', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [{ current_streak: 7 }] })
    expect(await (await STREAK(req())).json()).toEqual({ success: true, currentStreak: 7 })
  })

  test('0 si usuario nuevo (sin fila)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    expect((await (await STREAK(req())).json()).currentStreak).toBe(0)
  })

  test('AISLAMIENTO: filtra por userId del TOKEN', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    await STREAK(req())
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
  })
})

describe('GET /api/v2/admin/feedback/open-count', () => {
  test('responde 403 si requireAdmin rechaza', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) })
    const res = await OPEN_COUNT(req())
    expect(res.status).toBe(403)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('admin: devuelve count', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'A', email: 'admin@x' } })
    mockExecute.mockResolvedValue({ rows: [{ n: 4 }] })
    expect(await (await OPEN_COUNT(req())).json()).toEqual({ success: true, count: 4 })
  })
})
