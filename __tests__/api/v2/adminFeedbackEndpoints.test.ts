/** @jest-environment node */
// Tests de los 7 endpoints admin de feedback (Fase C1, migración de /admin/feedback).
// Todos requireAdmin. Cubre 403 + happy path + el fix de start-conversation.

import { NextRequest } from 'next/server'

const mockRequireAdmin = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/shared/auth', () => ({ requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a) }))
jest.mock('@/db/client', () => ({ getAdminDb: () => ({ execute: mockExecute }) }))
jest.mock('@/lib/api/withErrorLogging', () => ({ withErrorLogging: (_p: string, h: unknown) => h }))

import { GET as FEEDBACKS } from '@/app/api/v2/admin/feedback/feedbacks-list/route'
import { GET as MESSAGES } from '@/app/api/v2/admin/feedback/messages/route'
import { GET as WAITING } from '@/app/api/v2/admin/feedback/waiting-conversations/route'
import { GET as USERCONVS } from '@/app/api/v2/admin/feedback/user-conversations/route'
import { GET as CONVFB } from '@/app/api/v2/admin/feedback/conversation-feedback-id/route'
import { POST as UPDATEFB } from '@/app/api/v2/admin/feedback/update-feedback/route'
import { POST as STARTCONV } from '@/app/api/v2/admin/feedback/start-conversation/route'

const UID = '11111111-1111-4111-8111-111111111111'
const CID = '22222222-2222-4222-8222-222222222222'
const FID = '33333333-3333-4333-8333-333333333333'
function reqUrl(url = 'https://x') { return { headers: { get: () => null }, url } as unknown as NextRequest }
function reqBody(b: unknown) { return { headers: { get: () => null }, url: 'https://x', json: async () => b } as unknown as NextRequest }
async function forbidden() {
  const { NextResponse } = await import('next/server')
  return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
}
const ADMIN = { ok: true, user: { id: UID, email: 'a@vencemitfg.es' } }

beforeEach(() => { jest.clearAllMocks(); mockExecute.mockResolvedValue({ rows: [] }) })

describe('admin feedback endpoints — todos exigen admin', () => {
  test('403 en todos sin admin', async () => {
    mockRequireAdmin.mockResolvedValue(await forbidden())
    expect((await FEEDBACKS(reqUrl())).status).toBe(403)
    expect((await MESSAGES(reqUrl(`https://x?conversationId=${CID}`))).status).toBe(403)
    expect((await WAITING(reqUrl())).status).toBe(403)
    expect((await USERCONVS(reqUrl(`https://x?userId=${UID}`))).status).toBe(403)
    expect((await CONVFB(reqUrl(`https://x?conversationId=${CID}`))).status).toBe(403)
    expect((await UPDATEFB(reqBody({ feedbackId: FID, status: 'resolved' }))).status).toBe(403)
    expect((await STARTCONV(reqBody({ feedbackId: FID, userId: UID }))).status).toBe(403)
    expect(mockExecute).not.toHaveBeenCalled()
  })
})

describe('happy paths', () => {
  beforeEach(() => mockRequireAdmin.mockResolvedValue(ADMIN))

  test('feedbacks-list devuelve feedbacks', async () => {
    mockExecute.mockResolvedValue({ rows: [{ id: FID }] })
    expect((await (await FEEDBACKS(reqUrl())).json()).feedbacks).toHaveLength(1)
  })
  test('messages: 400 sin conversationId; OK con él', async () => {
    expect((await MESSAGES(reqUrl())).status).toBe(400)
    mockExecute.mockResolvedValue({ rows: [{ id: 'm1' }] })
    const j = await (await MESSAGES(reqUrl(`https://x?conversationId=${CID}`))).json()
    expect(j.messages).toHaveLength(1)
  })
  test('waiting-conversations OK', async () => {
    mockExecute.mockResolvedValue({ rows: [{ id: CID }] })
    expect((await (await WAITING(reqUrl())).json()).conversations).toHaveLength(1)
  })
  test('user-conversations: 400 si userId no uuid', async () => {
    expect((await USERCONVS(reqUrl('https://x?userId=nope'))).status).toBe(400)
  })
  test('conversation-feedback-id devuelve feedbackId', async () => {
    mockExecute.mockResolvedValue({ rows: [{ feedback_id: FID }] })
    expect((await (await CONVFB(reqUrl(`https://x?conversationId=${CID}`))).json()).feedbackId).toBe(FID)
  })
  test('update-feedback: 400 sin status; OK con él', async () => {
    expect((await UPDATEFB(reqBody({ feedbackId: FID }))).status).toBe(400)
    mockExecute.mockResolvedValue({ rows: [{ id: FID }] })
    expect((await (await UPDATEFB(reqBody({ feedbackId: FID, status: 'resolved', adminResponse: 'ok' }))).json()).success).toBe(true)
    // admin_user_id del token, no del body
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain(UID)
  })
  test('start-conversation usa columnas correctas (admin_user_id, sin started_by_admin)', async () => {
    mockExecute.mockResolvedValue({ rows: [{ id: CID }] })
    await STARTCONV(reqBody({ feedbackId: FID, userId: UID }))
    const s = JSON.stringify(mockExecute.mock.calls[0][0])
    expect(s).toContain('admin_user_id')
    expect(s).not.toContain('started_by_admin')
    expect(s).toContain(UID)
  })
})
