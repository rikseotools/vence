/**
 * @jest-environment node
 */
// __tests__/api/v2/dispute/resolveRoute.test.ts
// Tests del endpoint POST /api/v2/dispute/resolve.
// Mockean requireAdmin y resolveDispute para aislar el handler de la BD/email.

// ============================================
// Mocks (antes de importar el SUT)
// ============================================

const mockResolveDispute = jest.fn()
const mockRequireAdmin = jest.fn()

jest.mock('@/lib/api/v2/dispute', () => ({
  __esModule: true,
  resolveDispute: (...args: unknown[]) => mockResolveDispute(...args),
  resolveDisputeRequestSchema: jest.requireActual('@/lib/api/v2/dispute/schemas').resolveDisputeRequestSchema,
}))

jest.mock('@/lib/api/shared/auth', () => ({
  __esModule: true,
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}))

// withErrorLogging es passthrough en test (no se logea a BD)
jest.mock('@/lib/api/withErrorLogging', () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withErrorLogging: (_endpoint: string, handler: any) => handler,
}))

// ============================================
// SUT
// ============================================

import { POST } from '@/app/api/v2/dispute/resolve/route'
import type { NextRequest } from 'next/server'

const VALID_DISPUTE_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'

function buildRequest(body: unknown): NextRequest {
  // Mínimo viable: route handler solo usa request.json() y request.headers (vía requireAdmin mockeado)
  return {
    json: async () => body,
    headers: new Headers(),
  } as unknown as NextRequest
}

function buildBadJsonRequest(): NextRequest {
  return {
    json: async () => { throw new Error('invalid json') },
    headers: new Headers(),
  } as unknown as NextRequest
}

function adminAuthOk() {
  mockRequireAdmin.mockResolvedValueOnce({ ok: true, user: { id: 'admin-id', email: 'admin@vencemitfg.es' } })
}

function adminAuthFail() {
  const { NextResponse } = jest.requireActual('next/server')
  mockRequireAdmin.mockResolvedValueOnce({
    ok: false,
    response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }),
  })
}

beforeEach(() => {
  mockResolveDispute.mockReset()
  mockRequireAdmin.mockReset()
})

describe('POST /api/v2/dispute/resolve - autorizacion', () => {
  it('devuelve 403 si no es admin', async () => {
    adminAuthFail()
    const res = await POST(buildRequest({}))
    expect(res.status).toBe(403)
    expect(mockResolveDispute).not.toHaveBeenCalled()
  })
})

describe('POST /api/v2/dispute/resolve - validacion del body', () => {
  it('400 si el body no es JSON valido', async () => {
    adminAuthOk()
    const res = await POST(buildBadJsonRequest())
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/JSON invalido/)
  })

  it('400 si falta disputeId', async () => {
    adminAuthOk()
    const res = await POST(buildRequest({
      questionType: 'legislative',
      status: 'resolved',
      adminResponse: 'ok',
    }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/Datos de entrada invalidos/)
    expect(json.details).toBeDefined()
  })

  it('400 si disputeId no es UUID', async () => {
    adminAuthOk()
    const res = await POST(buildRequest({
      disputeId: 'not-a-uuid',
      questionType: 'legislative',
      status: 'resolved',
      adminResponse: 'ok',
    }))
    expect(res.status).toBe(400)
  })

  it('400 si questionType no es legislative ni psychometric', async () => {
    adminAuthOk()
    const res = await POST(buildRequest({
      disputeId: VALID_DISPUTE_ID,
      questionType: 'foo',
      status: 'resolved',
      adminResponse: 'ok',
    }))
    expect(res.status).toBe(400)
  })

  it('400 si status no es resolved ni rejected', async () => {
    adminAuthOk()
    const res = await POST(buildRequest({
      disputeId: VALID_DISPUTE_ID,
      questionType: 'legislative',
      status: 'pending',
      adminResponse: 'ok',
    }))
    expect(res.status).toBe(400)
  })

  it('400 si adminResponse supera 5000 caracteres', async () => {
    adminAuthOk()
    const res = await POST(buildRequest({
      disputeId: VALID_DISPUTE_ID,
      questionType: 'legislative',
      status: 'resolved',
      adminResponse: 'a'.repeat(5001),
    }))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/v2/dispute/resolve - flujo exitoso', () => {
  it('200 cuando resolveDispute devuelve success con email enviado', async () => {
    adminAuthOk()
    mockResolveDispute.mockResolvedValueOnce({
      success: true,
      disputeId: VALID_DISPUTE_ID,
      status: 'resolved',
      emailSent: true,
      emailId: 'em-123',
      emailError: null,
      emailSkipReason: null,
    })

    const res = await POST(buildRequest({
      disputeId: VALID_DISPUTE_ID,
      questionType: 'legislative',
      status: 'resolved',
      adminResponse: 'Gracias.',
    }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.emailSent).toBe(true)
    expect(json.emailId).toBe('em-123')

    // Verificar que se llamo a resolveDispute con los datos parseados
    expect(mockResolveDispute).toHaveBeenCalledWith({
      disputeId: VALID_DISPUTE_ID,
      questionType: 'legislative',
      status: 'resolved',
      adminResponse: 'Gracias.',
    })
  })

  it('200 cuando resolveDispute devuelve success con email skipped por respuesta vacia', async () => {
    adminAuthOk()
    mockResolveDispute.mockResolvedValueOnce({
      success: true,
      disputeId: VALID_DISPUTE_ID,
      status: 'rejected',
      emailSent: false,
      emailId: null,
      emailError: null,
      emailSkipReason: 'empty_response',
    })

    const res = await POST(buildRequest({
      disputeId: VALID_DISPUTE_ID,
      questionType: 'legislative',
      status: 'rejected',
      adminResponse: '',
    }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.emailSent).toBe(false)
    expect(json.emailSkipReason).toBe('empty_response')
  })

  it('200 cuando email falla pero la disputa quedo resuelta', async () => {
    adminAuthOk()
    mockResolveDispute.mockResolvedValueOnce({
      success: true,
      disputeId: VALID_DISPUTE_ID,
      status: 'resolved',
      emailSent: false,
      emailId: null,
      emailError: 'Resend 503',
      emailSkipReason: null,
    })

    const res = await POST(buildRequest({
      disputeId: VALID_DISPUTE_ID,
      questionType: 'psychometric',
      status: 'resolved',
      adminResponse: 'Texto valido.',
    }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.emailSent).toBe(false)
    expect(json.emailError).toBe('Resend 503')
  })
})

describe('POST /api/v2/dispute/resolve - errores logicos', () => {
  it('404 si la disputa no existe', async () => {
    adminAuthOk()
    mockResolveDispute.mockResolvedValueOnce({
      success: false,
      error: 'Impugnacion no encontrada',
    })

    const res = await POST(buildRequest({
      disputeId: VALID_DISPUTE_ID,
      questionType: 'legislative',
      status: 'resolved',
      adminResponse: 'Texto.',
    }))

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toMatch(/no encontrada/)
  })

  it('409 si la disputa ya estaba resolved (idempotencia)', async () => {
    adminAuthOk()
    mockResolveDispute.mockResolvedValueOnce({
      success: false,
      error: 'La impugnacion ya estaba resolved y no se puede re-resolver',
    })

    const res = await POST(buildRequest({
      disputeId: VALID_DISPUTE_ID,
      questionType: 'legislative',
      status: 'resolved',
      adminResponse: 'Texto.',
    }))

    expect(res.status).toBe(409)
  })

  it('400 para otros errores logicos genericos', async () => {
    adminAuthOk()
    mockResolveDispute.mockResolvedValueOnce({
      success: false,
      error: 'Error actualizando impugnacion legislativa',
    })

    const res = await POST(buildRequest({
      disputeId: VALID_DISPUTE_ID,
      questionType: 'legislative',
      status: 'resolved',
      adminResponse: 'Texto.',
    }))

    expect(res.status).toBe(400)
  })
})
