/** @jest-environment node */
// Tests de POST /api/v2/avatar/public-profile (Fase C1, migración de AvatarChanger).
// Actualiza el avatar en public_user_profiles del usuario del TOKEN (UPDATE).

import { NextRequest } from 'next/server'

const mockVerifyAuth = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({
  verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a),
}))
jest.mock('@/db/client', () => ({
  getAdminDb: () => ({ execute: mockExecute }),
}))
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_p: string, h: unknown) => h,
}))

import { POST } from '@/app/api/v2/avatar/public-profile/route'

function reqBody(body: unknown) {
  return { headers: { get: () => null }, url: 'https://x', json: async () => body } as unknown as NextRequest
}
const predefined = { avatarType: 'predefined', avatarUrl: null, avatarEmoji: '🐶', avatarColor: '#fff', avatarName: 'Perro' }

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue({ rows: [{ id: 'U_TOKEN' }] })
})

describe('POST /api/v2/avatar/public-profile', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await POST(reqBody(predefined))).status).toBe(401)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('400 si falta un campo (no nullable-opcional)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    expect((await POST(reqBody({ avatarType: 'predefined' }))).status).toBe(400)
  })

  test('predefinido: 200 updated=true', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    expect(await (await POST(reqBody(predefined))).json()).toEqual({ success: true, updated: true })
  })

  test('reset (todo null): 200', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    const reset = { avatarType: null, avatarUrl: null, avatarEmoji: null, avatarColor: null, avatarName: null }
    expect((await POST(reqBody(reset))).status).toBe(200)
  })

  test('AISLAMIENTO: el UPDATE usa el userId del TOKEN', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    await POST(reqBody(predefined))
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
  })
})
