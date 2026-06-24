/** @jest-environment node */
// Tests de los endpoints que reemplazan los 4 .rpc de UpgradeLimitModal (C1):
//   GET  /api/v2/upgrade-message         (get_random_upgrade_message)
//   POST /api/v2/upgrade-message/track   (shown / click / dismiss)

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

import { GET as MESSAGE } from '@/app/api/v2/upgrade-message/route'
import { POST as TRACK } from '@/app/api/v2/upgrade-message/track/route'

const MID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const IID = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'
function reqUrl() {
  return { headers: { get: () => null }, url: 'https://x' } as unknown as NextRequest
}
function reqBody(body: unknown) {
  return { headers: { get: () => null }, url: 'https://x', json: async () => body } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue({ rows: [] })
})

describe('GET /api/v2/upgrade-message', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await MESSAGE(reqUrl())).status).toBe(401)
  })
  test('devuelve message con user del token', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [{ id: MID, message_key: 'k1' }] })
    const j = await (await MESSAGE(reqUrl())).json()
    expect(j.message.id).toBe(MID)
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
  })
})

describe('POST /api/v2/upgrade-message/track', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await TRACK(reqBody({ action: 'click', impressionId: IID }))).status).toBe(401)
  })
  test('400 si action inválida', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    expect((await TRACK(reqBody({ action: 'nope' }))).status).toBe(400)
  })
  test('shown: devuelve impressionId, user del token', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [{ impression_id: IID }] })
    const j = await (await TRACK(reqBody({ action: 'shown', messageId: MID, questionsAnswered: 25 }))).json()
    expect(j.impressionId).toBe(IID)
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
  })
  test('click: usa impressionId', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    await TRACK(reqBody({ action: 'click', impressionId: IID }))
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain(IID)
  })
  test('dismiss: usa impressionId', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    await TRACK(reqBody({ action: 'dismiss', impressionId: IID }))
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('dismiss')
  })
})
