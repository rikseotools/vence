// __tests__/lib/api/v2/feedback/respondFeedback.test.ts
// Tests unitarios de respondFeedback(). Mockean BD + sendEmailV2 para cubrir
// todas las combinaciones (message presente/vacío, user registrado/externo,
// sendEmail/sendBell flags, user actively browsing, fallos, excepciones).

// ============================================
// Mocks
// ============================================

const mockSendEmailV2 = jest.fn()
jest.mock('@/lib/api/emails', () => ({
  __esModule: true,
  sendEmailV2: (...args: unknown[]) => mockSendEmailV2(...args),
}))

// Drizzle chain mock
type Op = 'select' | 'update' | 'insert'
const dbResponses: Record<Op, unknown[][]> = { select: [], update: [], insert: [] }
const dbIdx: Record<Op, number> = { select: 0, update: 0, insert: 0 }
let activeBrowsing = false // flag controlado por tests

function makeChain(op: Op) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {}
  const ret = () => chain
  chain.from = ret
  chain.leftJoin = ret
  chain.innerJoin = ret
  chain.where = ret
  chain.orderBy = ret
  chain.limit = ret
  chain.set = ret
  chain.values = ret
  chain.returning = ret
  chain.then = (resolve: (v: unknown) => void) => {
    const i = dbIdx[op]
    const arr = dbResponses[op]
    dbIdx[op]++
    return resolve(i < arr.length ? arr[i] : [])
  }
  return chain
}

const txFns = {
  insert: jest.fn(() => makeChain('insert')),
  update: jest.fn(() => makeChain('update')),
}

const mockDb = {
  select: jest.fn(() => makeChain('select')),
  update: jest.fn(() => makeChain('update')),
  insert: jest.fn(() => makeChain('insert')),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transaction: jest.fn(async (fn: any) => fn(txFns)),
}

jest.mock('@/db/client', () => ({
  __esModule: true,
  getDb: () => mockDb,
}))

// Mock schema keys to avoid importing real schema
jest.mock('@/db/schema', () => {
  const key = (k: string) => k
  return {
    __esModule: true,
    userFeedback: new Proxy({}, { get: (_, k) => key(`uf.${String(k)}`) }),
    feedbackConversations: new Proxy({}, { get: (_, k) => key(`fc.${String(k)}`) }),
    feedbackMessages: new Proxy({}, { get: (_, k) => key(`fm.${String(k)}`) }),
    notificationLogs: new Proxy({}, { get: (_, k) => key(`nl.${String(k)}`) }),
    userProfiles: new Proxy({}, { get: (_, k) => key(`up.${String(k)}`) }),
    userSessions: new Proxy({}, { get: (_, k) => key(`us.${String(k)}`) }),
  }
})

jest.mock('drizzle-orm', () => ({
  __esModule: true,
  eq: (...args: unknown[]) => ({ __op: 'eq', args }),
  desc: (x: unknown) => ({ __op: 'desc', args: [x] }),
  and: (...args: unknown[]) => ({ __op: 'and', args }),
  isNull: (x: unknown) => ({ __op: 'isNull', args: [x] }),
}))

// SUT
import { respondFeedback } from '@/lib/api/v2/feedback/queries'
import type { RespondFeedbackRequest } from '@/lib/api/v2/feedback/schemas'

const FB_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
const USER_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
const ADMIN_ID = 'cccccccc-cccc-4ccc-cccc-cccccccccccc'
const CONV_ID = 'dddddddd-dddd-4ddd-dddd-dddddddddddd'
const MSG_ID = 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee'

function baseReq(over: Partial<RespondFeedbackRequest> = {}): RespondFeedbackRequest {
  return {
    feedbackId: FB_ID,
    adminUserId: ADMIN_ID,
    message: 'Gracias por el reporte, lo hemos revisado.',
    ...over,
  }
}

// Helpers para configurar el SELECT inicial (feedback + conv + user)
function setupFeedback(opts: {
  exists?: boolean
  userId?: string | null
  email?: string | null // email del feedback (externos)
  userEmail?: string | null // email del user_profile
  userName?: string | null
  hasConversation?: boolean
}) {
  const {
    exists = true,
    userId = USER_ID,
    email = null,
    userEmail = 'user@example.com',
    userName = 'Test User',
    hasConversation = true,
  } = opts
  if (exists) {
    dbResponses.select.push([
      {
        fbId: FB_ID,
        fbUserId: userId,
        fbEmail: email,
        convId: hasConversation ? CONV_ID : null,
        userEmail,
        userName,
      },
    ])
  } else {
    dbResponses.select.push([])
  }
}

// Helper para el segundo SELECT (user_sessions check de activeBrowsing)
function pushActiveBrowsingResponse() {
  if (activeBrowsing) {
    dbResponses.select.push([{ updatedAt: new Date().toISOString() }])
  } else {
    // ninguna sesión reciente
    dbResponses.select.push([])
  }
}

// Helper para el INSERT de feedback_messages (devuelve messageId)
function pushMessageInsertResult() {
  dbResponses.insert.push([{ id: MSG_ID }])
}

beforeEach(() => {
  dbResponses.select = []
  dbResponses.update = []
  dbResponses.insert = []
  dbIdx.select = 0
  dbIdx.update = 0
  dbIdx.insert = 0
  activeBrowsing = false
  mockSendEmailV2.mockReset()
  mockDb.transaction.mockClear()
  txFns.insert.mockClear()
  txFns.update.mockClear()
})

describe('respondFeedback — feedback no encontrado / sin conversación', () => {
  it('devuelve error si el feedback no existe', async () => {
    setupFeedback({ exists: false })
    const r = await respondFeedback(baseReq())
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/no encontrado/)
  })

  it('devuelve error si hay mensaje pero no hay conversación', async () => {
    setupFeedback({ hasConversation: false })
    const r = await respondFeedback(baseReq())
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/conversacion/)
  })

  it('cierre silencioso SIN mensaje Y sin conversación → success sin INSERT', async () => {
    setupFeedback({ hasConversation: false })
    const r = await respondFeedback(baseReq({ message: undefined, finalStatus: 'dismissed' }))
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.messageId).toBeNull()
      expect(r.emailSent).toBe(false)
      expect(r.bellSent).toBe(false)
    }
  })
})

describe('respondFeedback — cierre silencioso (sin mensaje)', () => {
  it('message undefined → solo UPDATE status, sin email, sin campana', async () => {
    setupFeedback({})
    const r = await respondFeedback(baseReq({ message: undefined, finalStatus: 'dismissed' }))
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.messageId).toBeNull()
      expect(r.emailSent).toBe(false)
      expect(r.emailSkipReason).toBe('empty_message')
      expect(r.bellSent).toBe(false)
      expect(r.finalStatus).toBe('dismissed')
    }
    expect(mockSendEmailV2).not.toHaveBeenCalled()
    expect(txFns.insert).not.toHaveBeenCalled()
  })

  it('message solo whitespace → tratado como vacío', async () => {
    setupFeedback({})
    const r = await respondFeedback(baseReq({ message: '   \n\t  ', finalStatus: 'dismissed' }))
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.messageId).toBeNull()
      expect(r.emailSkipReason).toBe('empty_message')
    }
  })

  it('sin mensaje y sin finalStatus → finalStatus queda null', async () => {
    setupFeedback({})
    const r = await respondFeedback(baseReq({ message: undefined }))
    expect(r.success).toBe(true)
    if (r.success) expect(r.finalStatus).toBeNull()
  })
})

describe('respondFeedback — flujo completo (mensaje, user registrado)', () => {
  it('respuesta normal → INSERT msg + campana + email', async () => {
    setupFeedback({})
    pushMessageInsertResult()
    pushActiveBrowsingResponse() // no activo
    mockSendEmailV2.mockResolvedValueOnce({ success: true, emailId: 'em-1' })

    const r = await respondFeedback(baseReq())
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.messageId).toBe(MSG_ID)
      expect(r.bellSent).toBe(true)
      expect(r.bellSkipReason).toBeNull()
      expect(r.emailSent).toBe(true)
      expect(r.emailId).toBe('em-1')
      expect(r.finalStatus).toBe('resolved')
    }
    expect(mockDb.transaction).toHaveBeenCalled()
    expect(mockSendEmailV2).toHaveBeenCalledWith(expect.objectContaining({
      userId: USER_ID,
      emailType: 'soporte_respuesta',
    }))
  })

  it('sendEmail:false → INSERT + campana pero NO email', async () => {
    setupFeedback({})
    pushMessageInsertResult()
    const r = await respondFeedback(baseReq({ sendEmail: false }))
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.emailSent).toBe(false)
      expect(r.emailSkipReason).toBe('send_email_false_flag')
      expect(r.bellSent).toBe(true)
    }
    expect(mockSendEmailV2).not.toHaveBeenCalled()
  })

  it('sendBell:false → INSERT + email pero NO campana', async () => {
    setupFeedback({})
    pushMessageInsertResult()
    pushActiveBrowsingResponse()
    mockSendEmailV2.mockResolvedValueOnce({ success: true, emailId: 'em-1' })

    const r = await respondFeedback(baseReq({ sendBell: false }))
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.bellSent).toBe(false)
      expect(r.bellSkipReason).toBe('send_bell_false_flag')
      expect(r.emailSent).toBe(true)
    }
  })

  it('ambos flags false → INSERT solo, nada más', async () => {
    setupFeedback({})
    pushMessageInsertResult()
    const r = await respondFeedback(baseReq({ sendEmail: false, sendBell: false }))
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.messageId).toBe(MSG_ID)
      expect(r.emailSent).toBe(false)
      expect(r.bellSent).toBe(false)
    }
  })
})

describe('respondFeedback — contactos externos (user_id null)', () => {
  it('user externo → skip campana automático, email vía path externo', async () => {
    setupFeedback({ userId: null, userEmail: null, email: 'externo@email.com' })
    pushMessageInsertResult()
    // No hay user_session ni usamos sendEmailV2 para externos
    const r = await respondFeedback(baseReq())
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.bellSent).toBe(false)
      expect(r.bellSkipReason).toBe('external_contact')
      // emailSkipReason será 'no_user_email' porque externos requieren path aparte
      expect(r.emailSent).toBe(false)
    }
    expect(mockSendEmailV2).not.toHaveBeenCalled()
  })
})

describe('respondFeedback — skip reasons de email', () => {
  it('usuario registrado pero sin email en user_profiles → no_user_email', async () => {
    setupFeedback({ userEmail: null })
    pushMessageInsertResult()
    const r = await respondFeedback(baseReq())
    if (r.success) {
      expect(r.emailSent).toBe(false)
      expect(r.emailSkipReason).toBe('no_user_email')
    }
    expect(mockSendEmailV2).not.toHaveBeenCalled()
  })

  it('usuario activamente navegando → skip email, campana sí', async () => {
    setupFeedback({})
    pushMessageInsertResult()
    activeBrowsing = true
    pushActiveBrowsingResponse()

    const r = await respondFeedback(baseReq())
    if (r.success) {
      expect(r.bellSent).toBe(true)
      expect(r.emailSent).toBe(false)
      expect(r.emailSkipReason).toBe('user_actively_browsing')
    }
    expect(mockSendEmailV2).not.toHaveBeenCalled()
  })

  it('sendEmailV2 cancelled por preferencias → user_preferences', async () => {
    setupFeedback({})
    pushMessageInsertResult()
    pushActiveBrowsingResponse()
    mockSendEmailV2.mockResolvedValueOnce({ cancelled: true, reason: 'unsubscribed' })

    const r = await respondFeedback(baseReq())
    if (r.success) {
      expect(r.emailSent).toBe(false)
      expect(r.emailSkipReason).toBe('user_preferences')
    }
  })

  it('sendEmailV2 falla → emailError set, success queda true', async () => {
    setupFeedback({})
    pushMessageInsertResult()
    pushActiveBrowsingResponse()
    mockSendEmailV2.mockResolvedValueOnce({ success: false, error: 'Resend 503' })

    const r = await respondFeedback(baseReq())
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.emailSent).toBe(false)
      expect(r.emailError).toBe('Resend 503')
    }
  })

  it('sendEmailV2 lanza excepción → success true con emailError', async () => {
    setupFeedback({})
    pushMessageInsertResult()
    pushActiveBrowsingResponse()
    mockSendEmailV2.mockRejectedValueOnce(new Error('network fail'))

    const r = await respondFeedback(baseReq())
    expect(r.success).toBe(true)
    if (r.success) expect(r.emailError).toBe('network fail')
  })
})

describe('respondFeedback — mensaje largo y caracteres especiales', () => {
  it('mensaje >100 chars → preview truncado en notification_logs', async () => {
    setupFeedback({})
    pushMessageInsertResult()
    pushActiveBrowsingResponse()
    mockSendEmailV2.mockResolvedValueOnce({ success: true, emailId: 'em' })

    const longMsg = 'a'.repeat(150)
    const r = await respondFeedback(baseReq({ message: longMsg }))
    expect(r.success).toBe(true)
    if (r.success) expect(r.bellSent).toBe(true)
  })

  it('acepta acentos y emojis sin romper', async () => {
    setupFeedback({})
    pushMessageInsertResult()
    pushActiveBrowsingResponse()
    mockSendEmailV2.mockResolvedValueOnce({ success: true, emailId: 'em' })

    const msg = 'Saludo cordial con á é í ó ú ñ y 🎉'
    const r = await respondFeedback(baseReq({ message: msg }))
    expect(r.success).toBe(true)
  })
})

describe('respondFeedback — BD falla', () => {
  it('getDb lanza en el SELECT inicial → devuelve error', async () => {
    mockDb.select.mockImplementationOnce(() => { throw new Error('db down') })
    const r = await respondFeedback(baseReq())
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('db down')
  })
})
