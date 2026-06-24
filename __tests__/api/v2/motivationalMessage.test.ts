/** @jest-environment node */
// Tests de los endpoints que reemplazan el .rpc + .from de MotivationalMessage.js (C1):
//   GET  /api/v2/motivational-message               (get_personalized_message + reacción previa)
//   POST /api/v2/motivational-message/interaction    (INSERT user_message_interactions)

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

import { GET } from '@/app/api/v2/motivational-message/route'
import { POST } from '@/app/api/v2/motivational-message/interaction/route'

const MID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
function reqUrl(url = 'https://x?category=exam_result') {
  return { headers: { get: () => null }, url } as unknown as NextRequest
}
function reqBody(body: unknown) {
  return { headers: { get: () => null }, url: 'https://x', json: async () => body } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue({ rows: [] })
})

describe('GET /api/v2/motivational-message', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await GET(reqUrl())).status).toBe(401)
  })

  test('devuelve message + reaction; ambas queries con userId del token', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute
      .mockResolvedValueOnce({ rows: [{ message_id: MID, message_text: 'Ánimo' }] })
      .mockResolvedValueOnce({ rows: [{ action_type: 'like' }] })
    const res = await GET(reqUrl())
    const j = await res.json()
    expect(j.message.message_id).toBe(MID)
    expect(j.reaction).toBe('like')
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
    expect(JSON.stringify(mockExecute.mock.calls[1][0])).toContain('U_TOKEN')
  })

  test('sin mensaje → no consulta reacción', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValueOnce({ rows: [] })
    const j = await (await GET(reqUrl())).json()
    expect(j.message).toBeNull()
    expect(j.reaction).toBeNull()
    expect(mockExecute).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/v2/motivational-message/interaction', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await POST(reqBody({ messageId: MID, actionType: 'view' }))).status).toBe(401)
  })

  test('400 si messageId no es uuid', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    expect((await POST(reqBody({ messageId: 'x', actionType: 'view' }))).status).toBe(400)
  })

  test('inserta con userId del token (no del body)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    await POST(reqBody({ messageId: MID, actionType: 'like', user_id: 'U_ATTACKER' }))
    const s = JSON.stringify(mockExecute.mock.calls[0][0])
    expect(s).toContain('U_TOKEN')
    expect(s).not.toContain('U_ATTACKER')
  })
})
