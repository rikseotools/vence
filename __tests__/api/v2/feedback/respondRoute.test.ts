/**
 * @jest-environment node
 */
// __tests__/api/v2/feedback/respondRoute.test.ts

const mockRespondFeedback = jest.fn()
const mockRequireAdmin = jest.fn()

jest.mock('@/lib/api/v2/feedback', () => ({
  __esModule: true,
  respondFeedback: (...args: unknown[]) => mockRespondFeedback(...args),
  respondFeedbackRequestSchema: jest.requireActual('@/lib/api/v2/feedback/schemas').respondFeedbackRequestSchema,
}))

jest.mock('@/lib/api/shared/auth', () => ({
  __esModule: true,
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}))

jest.mock('@/lib/api/withErrorLogging', () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withErrorLogging: (_endpoint: string, handler: any) => handler,
}))

import { POST } from '@/app/api/v2/feedback/respond/route'
import type { NextRequest } from 'next/server'

const FB_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
const ADMIN_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'

function buildRequest(body: unknown): NextRequest {
  return { json: async () => body, headers: new Headers() } as unknown as NextRequest
}
function buildBadJsonRequest(): NextRequest {
  return { json: async () => { throw new Error('invalid json') }, headers: new Headers() } as unknown as NextRequest
}
function adminOk() {
  mockRequireAdmin.mockResolvedValueOnce({ ok: true, user: { id: ADMIN_ID, email: 'admin@vencemitfg.es' } })
}
function adminFail() {
  const { NextResponse } = jest.requireActual('next/server')
  mockRequireAdmin.mockResolvedValueOnce({
    ok: false,
    response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }),
  })
}

beforeEach(() => {
  mockRespondFeedback.mockReset()
  mockRequireAdmin.mockReset()
})

describe('POST /api/v2/feedback/respond — auth', () => {
  it('403 si no es admin', async () => {
    adminFail()
    const res = await POST(buildRequest({}))
    expect(res.status).toBe(403)
    expect(mockRespondFeedback).not.toHaveBeenCalled()
  })
})

describe('POST /api/v2/feedback/respond — validación body', () => {
  it('400 body JSON inválido', async () => {
    adminOk()
    const res = await POST(buildBadJsonRequest())
    expect(res.status).toBe(400)
    const j = await res.json()
    expect(j.error).toMatch(/JSON invalido/)
  })

  it('400 falta feedbackId', async () => {
    adminOk()
    const res = await POST(buildRequest({ adminUserId: ADMIN_ID }))
    expect(res.status).toBe(400)
  })

  it('400 feedbackId no es UUID', async () => {
    adminOk()
    const res = await POST(buildRequest({ feedbackId: 'no-uuid', adminUserId: ADMIN_ID }))
    expect(res.status).toBe(400)
  })

  it('400 finalStatus inválido', async () => {
    adminOk()
    const res = await POST(buildRequest({
      feedbackId: FB_ID, adminUserId: ADMIN_ID, finalStatus: 'pending',
    }))
    expect(res.status).toBe(400)
  })

  it('400 mensaje >5000 chars', async () => {
    adminOk()
    const res = await POST(buildRequest({
      feedbackId: FB_ID, adminUserId: ADMIN_ID, message: 'x'.repeat(5001),
    }))
    expect(res.status).toBe(400)
  })

  it('200 mensaje válido 5000 chars', async () => {
    adminOk()
    mockRespondFeedback.mockResolvedValueOnce({
      success: true, feedbackId: FB_ID, conversationId: 'conv', messageId: 'm',
      bellSent: true, bellSkipReason: null,
      emailSent: true, emailId: 'em', emailError: null, emailSkipReason: null,
      finalStatus: 'resolved',
    })
    const res = await POST(buildRequest({
      feedbackId: FB_ID, adminUserId: ADMIN_ID, message: 'x'.repeat(5000),
    }))
    expect(res.status).toBe(200)
  })
})

describe('POST /api/v2/feedback/respond — flujo exitoso', () => {
  it('200 cuando respondFeedback devuelve success', async () => {
    adminOk()
    mockRespondFeedback.mockResolvedValueOnce({
      success: true, feedbackId: FB_ID, conversationId: 'conv', messageId: 'm',
      bellSent: true, bellSkipReason: null,
      emailSent: true, emailId: 'em', emailError: null, emailSkipReason: null,
      finalStatus: 'resolved',
    })
    const res = await POST(buildRequest({
      feedbackId: FB_ID, adminUserId: ADMIN_ID, message: 'Gracias.',
    }))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.success).toBe(true)
    expect(j.bellSent).toBe(true)
    expect(j.emailSent).toBe(true)
  })

  it('200 cierre silencioso (sin mensaje)', async () => {
    adminOk()
    mockRespondFeedback.mockResolvedValueOnce({
      success: true, feedbackId: FB_ID, conversationId: 'conv', messageId: null,
      bellSent: false, bellSkipReason: null,
      emailSent: false, emailId: null, emailError: null, emailSkipReason: 'empty_message',
      finalStatus: 'dismissed',
    })
    const res = await POST(buildRequest({
      feedbackId: FB_ID, adminUserId: ADMIN_ID, finalStatus: 'dismissed',
    }))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.messageId).toBeNull()
    expect(j.emailSkipReason).toBe('empty_message')
  })

  it('200 con email fallido pero feedback resuelto', async () => {
    adminOk()
    mockRespondFeedback.mockResolvedValueOnce({
      success: true, feedbackId: FB_ID, conversationId: 'conv', messageId: 'm',
      bellSent: true, bellSkipReason: null,
      emailSent: false, emailId: null, emailError: 'Resend 503', emailSkipReason: null,
      finalStatus: 'resolved',
    })
    const res = await POST(buildRequest({
      feedbackId: FB_ID, adminUserId: ADMIN_ID, message: 'ok',
    }))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.emailError).toBe('Resend 503')
  })
})

describe('POST /api/v2/feedback/respond — errores lógicos', () => {
  it('404 si respondFeedback devuelve "no encontrado"', async () => {
    adminOk()
    mockRespondFeedback.mockResolvedValueOnce({ success: false, error: 'Feedback no encontrado' })
    const res = await POST(buildRequest({
      feedbackId: FB_ID, adminUserId: ADMIN_ID, message: 'x',
    }))
    expect(res.status).toBe(404)
  })

  it('409 si respondFeedback devuelve "conversacion"', async () => {
    adminOk()
    mockRespondFeedback.mockResolvedValueOnce({ success: false, error: 'El feedback no tiene conversacion' })
    const res = await POST(buildRequest({
      feedbackId: FB_ID, adminUserId: ADMIN_ID, message: 'x',
    }))
    expect(res.status).toBe(409)
  })

  it('500 para otros errores', async () => {
    adminOk()
    mockRespondFeedback.mockResolvedValueOnce({ success: false, error: 'Error interno BD' })
    const res = await POST(buildRequest({
      feedbackId: FB_ID, adminUserId: ADMIN_ID, message: 'x',
    }))
    expect(res.status).toBe(500)
  })
})
