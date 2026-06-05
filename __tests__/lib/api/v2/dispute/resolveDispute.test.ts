// __tests__/lib/api/v2/dispute/resolveDispute.test.ts
// Tests unitarios de resolveDispute(): mockean BD y sendEmailV2 para simular
// todos los caminos del flujo (idempotencia, email skip por respuesta vacía,
// usuario sin email, cancelación por preferencias, fallos de Resend, excepciones).

// ============================================
// Mocks (DEBEN ir antes de los imports del SUT)
// ============================================

const mockSendEmailV2 = jest.fn()
jest.mock('@/lib/api/emails', () => ({
  __esModule: true,
  sendEmailV2: (...args: unknown[]) => mockSendEmailV2(...args),
}))

// Observabilidad: el drop silencioso del email debe emitir un evento estructurado.
const mockEmit = jest.fn().mockResolvedValue(undefined)
jest.mock('@/lib/observability/emit', () => ({
  __esModule: true,
  emit: (...args: unknown[]) => mockEmit(...args),
}))

// Drizzle chain mock: cada `select`/`update` consume el siguiente "response"
// programado en `dbResponses`. Las llamadas chainables (.from, .leftJoin,
// .where, .set, .returning, .limit) devuelven el propio chain. La cadena se
// resuelve cuando se hace `await`.
type DbOp = 'select' | 'update'
const dbResponses: Record<DbOp, unknown[][]> = { select: [], update: [] }
const dbIdx: Record<DbOp, number> = { select: 0, update: 0 }
let lastUpdateSet: Record<string, unknown> | null = null
let lastUpdateWhereCalled = false

function makeChain(op: DbOp) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {}
  const noop = () => chain
  chain.from = noop
  chain.leftJoin = noop
  chain.where = jest.fn(() => {
    if (op === 'update') lastUpdateWhereCalled = true
    return chain
  })
  chain.limit = noop
  chain.set = jest.fn((vals: Record<string, unknown>) => {
    lastUpdateSet = vals
    return chain
  })
  chain.returning = noop
  chain.then = (resolve: (v: unknown) => void) => {
    const i = dbIdx[op]
    const arr = dbResponses[op]
    dbIdx[op]++
    return resolve(i < arr.length ? arr[i] : [])
  }
  return chain
}

const mockGetDb = jest.fn(() => ({
  select: jest.fn(() => makeChain('select')),
  update: jest.fn(() => makeChain('update')),
}))

jest.mock('@/db/client', () => ({
  __esModule: true,
  getDb: () => mockGetDb(),
}))

jest.mock('@/db/schema', () => ({
  __esModule: true,
  questionDisputes: {
    id: 'questionDisputes.id',
    status: 'questionDisputes.status',
    userId: 'questionDisputes.userId',
    questionId: 'questionDisputes.questionId',
  },
  psychometricQuestionDisputes: {
    id: 'psychometricQuestionDisputes.id',
    status: 'psychometricQuestionDisputes.status',
    userId: 'psychometricQuestionDisputes.userId',
    questionId: 'psychometricQuestionDisputes.questionId',
  },
  questions: { id: 'questions.id', questionText: 'questions.questionText' },
  psychometricQuestions: { id: 'psychometricQuestions.id', questionText: 'psychometricQuestions.questionText' },
  userProfiles: { id: 'userProfiles.id', email: 'userProfiles.email', fullName: 'userProfiles.fullName' },
}))

jest.mock('drizzle-orm', () => ({
  __esModule: true,
  eq: (...args: unknown[]) => ({ __op: 'eq', args }),
  and: (...args: unknown[]) => ({ __op: 'and', args }),
}))

// ============================================
// SUT
// ============================================

import { resolveDispute } from '@/lib/api/v2/dispute/queries'
import type { ResolveDisputeRequest } from '@/lib/api/v2/dispute/schemas'

const VALID_DISPUTE_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
const VALID_USER_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
const VALID_QUESTION_ID = 'cccccccc-cccc-4ccc-cccc-cccccccccccc'

function baseRequest(overrides: Partial<ResolveDisputeRequest> = {}): ResolveDisputeRequest {
  return {
    disputeId: VALID_DISPUTE_ID,
    questionType: 'legislative',
    status: 'resolved',
    adminResponse: 'Hemos revisado y la respuesta es correcta. Muchas gracias.',
    ...overrides,
  }
}

function setupDispute(opts: {
  found?: boolean
  status?: string
  userEmail?: string | null
  userName?: string | null
  questionText?: string | null
  userId?: string | null
}) {
  const {
    found = true,
    status = 'pending',
    userEmail = 'usuario@example.com',
    userName = 'Test User',
    questionText = 'Cual es la respuesta correcta?',
    userId = VALID_USER_ID,
  } = opts

  if (found) {
    dbResponses.select.push([
      {
        dId: VALID_DISPUTE_ID,
        dStatus: status,
        dUserId: userId,
        dQuestionId: VALID_QUESTION_ID,
        uEmail: userEmail,
        uName: userName,
        qText: questionText,
      },
    ])
  } else {
    dbResponses.select.push([])
  }
}

function setupUpdateOk() {
  dbResponses.update.push([{ id: VALID_DISPUTE_ID }])
}

function setupUpdateFail() {
  dbResponses.update.push([])
}

beforeEach(() => {
  dbResponses.select = []
  dbResponses.update = []
  dbIdx.select = 0
  dbIdx.update = 0
  lastUpdateSet = null
  lastUpdateWhereCalled = false
  mockSendEmailV2.mockReset()
  mockEmit.mockClear()
})

describe('resolveDispute - disputa no encontrada o estado invalido', () => {
  it('devuelve error si la disputa no existe (legislativa)', async () => {
    setupDispute({ found: false })
    const r = await resolveDispute(baseRequest())
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/no encontrada/)
  })

  it('devuelve error si la disputa psicotecnica no existe', async () => {
    setupDispute({ found: false })
    const r = await resolveDispute(baseRequest({ questionType: 'psychometric' }))
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/psicotecnica no encontrada/)
  })

  it('rechaza re-resolver una disputa ya resolved (idempotencia)', async () => {
    setupDispute({ status: 'resolved' })
    const r = await resolveDispute(baseRequest())
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/ya estaba resolved/)
    expect(mockSendEmailV2).not.toHaveBeenCalled()
  })

  it('rechaza re-resolver una disputa ya rejected (idempotencia)', async () => {
    setupDispute({ status: 'rejected' })
    const r = await resolveDispute(baseRequest({ status: 'rejected' }))
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/ya estaba rejected/)
  })

  it('rechaza si la disputa no tiene userId asociado', async () => {
    setupDispute({ userId: null })
    const r = await resolveDispute(baseRequest())
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/no tiene usuario/)
  })

  it('devuelve error si el UPDATE legislativa no afecta filas', async () => {
    setupDispute({})
    setupUpdateFail()
    const r = await resolveDispute(baseRequest())
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/Error actualizando/)
  })

  it('devuelve error si el UPDATE psicotecnica no afecta filas', async () => {
    setupDispute({})
    setupUpdateFail()
    const r = await resolveDispute(baseRequest({ questionType: 'psychometric' }))
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/psicotecnica/)
  })
})

describe('resolveDispute - email skip por adminResponse vacio o solo whitespace', () => {
  it('skip email si adminResponse es cadena vacia', async () => {
    setupDispute({})
    setupUpdateOk()
    const r = await resolveDispute(baseRequest({ adminResponse: '' }))
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.emailSent).toBe(false)
      expect(r.emailSkipReason).toBe('empty_response')
    }
    expect(mockSendEmailV2).not.toHaveBeenCalled()
  })

  it('skip email si adminResponse es solo whitespace', async () => {
    setupDispute({})
    setupUpdateOk()
    const r = await resolveDispute(baseRequest({ adminResponse: '   \n\t  ' }))
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.emailSent).toBe(false)
      expect(r.emailSkipReason).toBe('empty_response')
    }
  })

  it('persiste adminResponse=null en BD cuando viene vacio', async () => {
    setupDispute({})
    setupUpdateOk()
    await resolveDispute(baseRequest({ adminResponse: '   ' }))
    expect(lastUpdateSet?.adminResponse).toBeNull()
  })
})

describe('resolveDispute - email skip por usuario sin email', () => {
  it('skip email si user_profiles.email es null', async () => {
    setupDispute({ userEmail: null })
    setupUpdateOk()
    const r = await resolveDispute(baseRequest())
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.emailSent).toBe(false)
      expect(r.emailSkipReason).toBe('no_user_email')
      expect(r.emailError).toBeNull()
    }
    expect(mockSendEmailV2).not.toHaveBeenCalled()
  })
})

describe('resolveDispute - flujo email exitoso', () => {
  it('llama sendEmailV2 con los datos correctos y devuelve emailSent=true', async () => {
    setupDispute({})
    setupUpdateOk()
    mockSendEmailV2.mockResolvedValueOnce({ success: true, emailId: 'em-123' })

    const r = await resolveDispute(baseRequest())
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.emailSent).toBe(true)
      expect(r.emailId).toBe('em-123')
      expect(r.emailError).toBeNull()
      expect(r.emailSkipReason).toBeNull()
    }

    expect(mockSendEmailV2).toHaveBeenCalledTimes(1)
    const call = mockSendEmailV2.mock.calls[0][0]
    expect(call.userId).toBe(VALID_USER_ID)
    expect(call.emailType).toBe('impugnacion_respuesta')
    expect(call.customData.to).toBe('usuario@example.com')
    expect(call.customData.userName).toBe('Test User')
    expect(call.customData.status).toBe('resolved')
    expect(call.customData.adminResponse).toContain('Muchas gracias')
    expect(call.customData.disputeUrl).toContain(VALID_DISPUTE_ID)
  })

  it('usa "Usuario" como fallback si full_name es null', async () => {
    setupDispute({ userName: null })
    setupUpdateOk()
    mockSendEmailV2.mockResolvedValueOnce({ success: true, emailId: 'em-1' })

    await resolveDispute(baseRequest())
    expect(mockSendEmailV2.mock.calls[0][0].customData.userName).toBe('Usuario')
  })

  it('respeta el status rejected en el customData', async () => {
    setupDispute({})
    setupUpdateOk()
    mockSendEmailV2.mockResolvedValueOnce({ success: true, emailId: 'em-1' })

    await resolveDispute(baseRequest({ status: 'rejected' }))
    expect(mockSendEmailV2.mock.calls[0][0].customData.status).toBe('rejected')
  })

  it('persiste el status correcto y la fecha de resolved_at en BD', async () => {
    setupDispute({})
    setupUpdateOk()
    mockSendEmailV2.mockResolvedValueOnce({ success: true, emailId: 'em-1' })

    await resolveDispute(baseRequest({ status: 'rejected' }))
    expect(lastUpdateSet?.status).toBe('rejected')
    expect(lastUpdateSet?.resolvedAt).toBeDefined()
    expect(lastUpdateSet?.updatedAt).toBeDefined()
    expect(lastUpdateWhereCalled).toBe(true)
  })
})

describe('resolveDispute - email cancelado por preferencias del usuario', () => {
  it('devuelve emailSent=false con skipReason=user_preferences', async () => {
    setupDispute({})
    setupUpdateOk()
    mockSendEmailV2.mockResolvedValueOnce({ cancelled: true, reason: 'unsubscribed' })

    const r = await resolveDispute(baseRequest())
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.emailSent).toBe(false)
      expect(r.emailSkipReason).toBe('user_preferences')
      expect(r.emailError).toBeNull()
    }
  })
})

describe('resolveDispute - email falla pero la disputa queda resuelta (sin rollback)', () => {
  it('emailResult.success=false → success:true con emailError', async () => {
    setupDispute({})
    setupUpdateOk()
    mockSendEmailV2.mockResolvedValueOnce({ success: false, error: 'Resend 503' })

    const r = await resolveDispute(baseRequest())
    expect(r.success).toBe(true) // la disputa se resuelve igualmente
    if (r.success) {
      expect(r.emailSent).toBe(false)
      expect(r.emailError).toBe('Resend 503')
      expect(r.emailSkipReason).toBeNull()
    }
    // El drop debe quedar VISIBLE en observabilidad (no solo detectable 1h tarde)
    expect(mockEmit).toHaveBeenCalledTimes(1)
    expect(mockEmit.mock.calls[0][0]).toMatchObject({
      eventType: 'dispute_email_failed',
      severity: 'warn',
      metadata: expect.objectContaining({ reason: 'Resend 503', kind: 'send_unsuccessful' }),
    })
  })

  it('sendEmailV2 lanza excepcion → success:true con emailError generico', async () => {
    setupDispute({})
    setupUpdateOk()
    mockSendEmailV2.mockRejectedValueOnce(new Error('network down'))

    const r = await resolveDispute(baseRequest())
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.emailSent).toBe(false)
      expect(r.emailError).toBe('network down')
    }
    expect(mockEmit).toHaveBeenCalledTimes(1)
    expect(mockEmit.mock.calls[0][0]).toMatchObject({
      eventType: 'dispute_email_failed',
      metadata: expect.objectContaining({ reason: 'network down', kind: 'exception' }),
    })
  })

  it('sendEmailV2 lanza excepcion no-Error (string) → emailError fallback', async () => {
    setupDispute({})
    setupUpdateOk()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSendEmailV2.mockImplementationOnce(() => { throw 'broken' as any })

    const r = await resolveDispute(baseRequest())
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.emailError).toMatch(/Excepcion desconocida/)
    }
  })
})

describe('resolveDispute - psicotecnica usa la tabla correcta', () => {
  it('una disputa psicotecnica resolved llama sendEmailV2 con datos del flujo psico', async () => {
    setupDispute({ questionText: 'Que numero falta en la serie?' })
    setupUpdateOk()
    mockSendEmailV2.mockResolvedValueOnce({ success: true, emailId: 'em-psi' })

    const r = await resolveDispute(baseRequest({ questionType: 'psychometric' }))
    expect(r.success).toBe(true)
    if (r.success) expect(r.emailSent).toBe(true)
    expect(mockSendEmailV2.mock.calls[0][0].customData.questionText).toBe(
      'Que numero falta en la serie?'
    )
  })
})

describe('resolveDispute - manejo de excepciones en BD', () => {
  it('si getDb tira durante la consulta → devuelve error generico', async () => {
    mockGetDb.mockImplementationOnce(() => { throw new Error('db connection lost') })
    const r = await resolveDispute(baseRequest())
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('db connection lost')
  })
})
