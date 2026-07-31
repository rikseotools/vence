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
const mockEmitFireAndForget = jest.fn()
jest.mock('@/lib/observability/emit', () => ({
  __esModule: true,
  emit: (...args: unknown[]) => mockEmit(...args),
  // El módulo real exporta TAMBIÉN `emitFireAndForget`. Omitirlo hacía que cualquier ruta nueva que
  // lo usara explotara con "is not a function" DENTRO de resolveDispute, convirtiendo un fallo de
  // telemetría en "la impugnación no se pudo resolver". Un mock a medias miente sobre el contrato.
  emitFireAndForget: (...args: unknown[]) => mockEmitFireAndForget(...args),
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
    // Desde el 29/07/2026 la PUERTA de barajado exige que una legislativa resuelta tenga su
    // explicación ya en formato estructurado. El fixture representa el caso normal (la tiene);
    // los tests de la puerta en sí viven en `__tests__/impugnaciones/shuffleReadinessGate.test.ts`.
    explanationData = { intro: 'contexto', options: { '0': 'razón A', '1': 'razón B' } } as unknown,
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
        qExplanationData: explanationData,
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

describe('resolveDispute - idempotencyKey del email (T-116)', () => {
  async function keyFor(req: Partial<ResolveDisputeRequest>, disputeStatus = 'pending') {
    mockSendEmailV2.mockReset()
    setupDispute({ status: disputeStatus })
    setupUpdateOk()
    mockSendEmailV2.mockResolvedValueOnce({ success: true, emailId: 'em-1' })
    await resolveDispute(baseRequest(req))
    return mockSendEmailV2.mock.calls[0][0].idempotencyKey as string
  }

  it('pasa una idempotencyKey derivada de la impugnacion', async () => {
    const key = await keyFor({})
    expect(key.startsWith(`dispute-resolve-${VALID_DISPUTE_ID}-`)).toBe(true)
  })

  it('el MISMO cierre reintentado reusa la clave → Resend deduplica, no llegan 2 emails', async () => {
    const primera = await keyFor({})
    const reintento = await keyFor({})
    expect(reintento).toBe(primera)
  })

  it('contestar una alegacion `appealed` con otra respuesta cambia la clave → el email SÍ sale', async () => {
    // Caso real T-116: el usuario alega una impugnación ya resuelta (status
    // pasa a `appealed`, que la guardia de re-resolucion SÍ deja pasar) y el
    // admin contesta distinto dentro de la ventana de 24h de Resend. Con la
    // clave vieja (fija por disputeId) Resend rechazaba el cuerpo modificado y
    // el usuario se quedaba con el email erroneo.
    const original = await keyFor({ adminResponse: 'Tu impugnacion no procede.' })
    const trasAlegacion = await keyFor(
      { adminResponse: 'Revisado de nuevo: tenias razon, la clave era la B.' },
      'appealed'
    )
    expect(trasAlegacion).not.toBe(original)
  })

  it('cambiar solo el veredicto (mismo texto) tambien cambia la clave', async () => {
    const resuelta = await keyFor({ status: 'resolved' })
    const rechazada = await keyFor({ status: 'rejected' })
    expect(rechazada).not.toBe(resuelta)
  })

  it('la clave sigue al texto YA TRIMEADO que va en el email (no al crudo)', async () => {
    const limpio = await keyFor({ adminResponse: 'Respuesta definitiva.' })
    const conEspacios = await keyFor({ adminResponse: '   Respuesta definitiva.  \n' })
    expect(conEspacios).toBe(limpio)
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

  // T-422: el salto por preferencia NO deja rastro por sí solo — no genera fila en
  // `email_events` ni token de baja—, así que era indistinguible de "no se intentó nunca".
  // El reconciliador lo deducía releyendo `email_soporte_disabled`, que es MUTABLE: cuando
  // T-373 la restauró a 79 usuarios, 3 saltos correctos se releyeron como fallo silencioso y
  // la alerta disparó 7 veces. La evidencia tiene que emitirse en el momento de la decisión.
  it('emite `dispute_email_skipped` con el motivo (evidencia para el reconciliador)', async () => {
    setupDispute({})
    setupUpdateOk()
    mockSendEmailV2.mockResolvedValueOnce({ cancelled: true, reason: 'soporte_disabled' })

    await resolveDispute(baseRequest())

    const evento = mockEmit.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .find((e) => e?.eventType === 'dispute_email_skipped')

    expect(evento).toBeDefined()
    expect(evento).toMatchObject({
      severity: 'info', // decisión correcta, no avería: no debe pingar ninguna alerta
      endpoint: '/api/v2/dispute/resolve',
    })
    // El `disputeId` es la clave por la que lo busca el reconciliador: sin él, la evidencia
    // existe pero no se puede emparejar con la impugnación.
    expect((evento as { metadata?: Record<string, unknown> }).metadata).toMatchObject({
      reason: 'soporte_disabled',
    })
    expect((evento as { metadata?: { disputeId?: string } }).metadata?.disputeId).toBeTruthy()
  })

  it('un fallo al emitir la evidencia NO tumba la resolución (telemetría fail-open)', async () => {
    setupDispute({})
    setupUpdateOk()
    mockSendEmailV2.mockResolvedValueOnce({ cancelled: true, reason: 'soporte_disabled' })
    mockEmit.mockRejectedValueOnce(new Error('observabilidad caída'))

    const r = await resolveDispute(baseRequest())
    expect(r.success).toBe(true)
    if (r.success) expect(r.emailSkipReason).toBe('user_preferences')
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

// ── La PUERTA de barajado, CABLEADA (no solo el núcleo puro) ───────────────────
// El núcleo se testea aparte; esto comprueba que resolveDispute la respeta de verdad, que es
// donde fallaba antes: la regla existía en el manual y el endpoint no la miraba.
describe('puerta de barajado en resolveDispute', () => {
  it('NO cierra una legislativa resuelta si la pregunta no tiene explicación estructurada', async () => {
    setupDispute({ explanationData: null })
    const r = await resolveDispute({
      disputeId: VALID_DISPUTE_ID, questionType: 'legislative', status: 'resolved', adminResponse: 'Corregido.',
    } as never)
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/aplicar-explicacion/)
  })

  it('la cierra si se declara un motivo para saltarse la puerta', async () => {
    setupDispute({ explanationData: null })
    setupUpdateOk()
    const r = await resolveDispute({
      disputeId: VALID_DISPUTE_ID, questionType: 'legislative', status: 'resolved', adminResponse: 'Corregido.',
      skipShuffleReason: 'la pregunta se jubila por irreparable, no procede reescribirla',
    } as never)
    expect(r.success).toBe(true)
  })

  // Este test decía lo contrario («no estorba a un RECHAZO, que no toca la pregunta») hasta que
  // un caso real lo desmintió: una queja RECHAZADA —la clave era correcta— la había provocado
  // nuestra propia explicación, que citaba una letra. Cerrarla sin mirarla dejaba intacto el
  // motivo de la queja. Un rechazo es justo cuando más hay que sospechar de la explicación.
  it('un RECHAZO también pasa por la puerta: la queja suele venir de la explicación', async () => {
    setupDispute({ explanationData: null })
    setupUpdateOk()
    const r = await resolveDispute({
      disputeId: VALID_DISPUTE_ID, questionType: 'legislative', status: 'rejected', adminResponse: 'No procede.',
    } as never)
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/aplicar-explicacion/)
  })

  it('y si la explicación ya está estructurada, el rechazo se cierra sin fricción', async () => {
    setupDispute({ explanationData: { opciones: [{ letra: 'A', razon: 'porque sí' }] } })
    setupUpdateOk()
    const r = await resolveDispute({
      disputeId: VALID_DISPUTE_ID, questionType: 'legislative', status: 'rejected', adminResponse: 'No procede.',
    } as never)
    expect(r.success).toBe(true)
  })
})
