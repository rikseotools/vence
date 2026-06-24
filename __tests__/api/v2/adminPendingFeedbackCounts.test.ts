/** @jest-environment node */
// Tests de GET /api/v2/admin/pending-feedback-counts (Fase C1 tier admin, migración
// de useAdminNotifications). requireAdmin + lógica needsAttention portada del hook.

import { NextRequest } from 'next/server'

const mockRequireAdmin = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/shared/auth', () => ({
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
}))
jest.mock('@/db/client', () => ({
  getAdminDb: () => ({ execute: mockExecute }),
}))
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_p: string, h: unknown) => h,
}))

import { GET } from '@/app/api/v2/admin/pending-feedback-counts/route'

function req() {
  return { headers: { get: () => null }, url: 'https://x' } as unknown as NextRequest
}
// El endpoint hace 3 execute() en orden: feedbacks, reopened, rate-limit.
function setQueries(feedbacks: unknown[], reopened: unknown[], rateLimit: number) {
  mockExecute
    .mockResolvedValueOnce({ rows: feedbacks })
    .mockResolvedValueOnce({ rows: reopened })
    .mockResolvedValueOnce({ rows: [{ n: rateLimit }] })
}

beforeEach(() => jest.clearAllMocks())

describe('GET /api/v2/admin/pending-feedback-counts', () => {
  test('403 si no es admin', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) })
    expect((await GET(req())).status).toBe(403)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('feedback sin conversación → cuenta como pendiente', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'A', email: 'a@x' } })
    setQueries([{ type: 'bug', feedback_conversations: [] }], [], 0)
    const j = await (await GET(req())).json()
    expect(j.pendingFeedback).toBe(1)
    expect(j.feedbackByType.bug).toBe(1)
  })

  test('último mensaje del ADMIN → NO cuenta', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'A', email: 'a@x' } })
    setQueries([{
      type: 'bug',
      feedback_conversations: [{ status: 'open', feedback_messages: [
        { id: 'm1', is_admin: false, created_at: '2026-06-01T00:00:00Z' },
        { id: 'm2', is_admin: true, created_at: '2026-06-02T00:00:00Z' },
      ] }],
    }], [], 0)
    const j = await (await GET(req())).json()
    expect(j.pendingFeedback).toBe(0)
  })

  test('último mensaje del USUARIO → cuenta', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'A', email: 'a@x' } })
    setQueries([{
      type: 'account_deletion',
      feedback_conversations: [{ status: 'open', feedback_messages: [
        { id: 'm1', is_admin: true, created_at: '2026-06-01T00:00:00Z' },
        { id: 'm2', is_admin: false, created_at: '2026-06-02T00:00:00Z' },
      ] }],
    }], [], 0)
    const j = await (await GET(req())).json()
    expect(j.pendingFeedback).toBe(1)
    expect(j.feedbackByType.deletion).toBe(1)
  })

  test('reabierta con último msg del usuario cuenta + rate-limit passthrough', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'A', email: 'a@x' } })
    setQueries([], [{
      user_feedback: { type: 'email' },
      feedback_messages: [{ id: 'm1', is_admin: false, created_at: '2026-06-02T00:00:00Z' }],
    }], 7)
    const j = await (await GET(req())).json()
    expect(j.pendingFeedback).toBe(1)
    expect(j.feedbackByType.email).toBe(1)
    expect(j.rateLimitHits).toBe(7)
  })
})
