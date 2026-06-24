/** @jest-environment node */
// Tests de POST /api/v2/notifications/mark-conversation-read (Fase C1, migración de
// app/soporte). Marca notificaciones de una conversación como leídas (user del token).

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

import { POST } from '@/app/api/v2/notifications/mark-conversation-read/route'

function reqBody(body: unknown) {
  return { headers: { get: () => null }, url: 'https://x', json: async () => body } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue({ rows: [] })
})

describe('POST /api/v2/notifications/mark-conversation-read', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await POST(reqBody({ conversationId: 'c1' }))).status).toBe(401)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('400 sin conversationId', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    expect((await POST(reqBody({}))).status).toBe(400)
  })

  test('marca con userId del token + filtro de conversación', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    const res = await POST(reqBody({ conversationId: 'CONV1', user_id: 'U_ATTACKER' }))
    expect(res.status).toBe(200)
    const s = JSON.stringify(mockExecute.mock.calls[0][0])
    expect(s).toContain('U_TOKEN')
    expect(s).not.toContain('U_ATTACKER')
    expect(s).toContain('CONV1')
  })
})
