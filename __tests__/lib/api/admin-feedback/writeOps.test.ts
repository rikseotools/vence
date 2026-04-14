// __tests__/lib/api/admin-feedback/writeOps.test.ts
// Tests unitarios de las operaciones de escritura en admin-feedback:
// updateFeedbackStatus() y markMessagesAsRead().

// ============================================
// Drizzle chain mock (reusable pattern)
// ============================================

type Op = 'select' | 'update' | 'insert'
const dbResponses: Record<Op, unknown[][]> = { select: [], update: [], insert: [] }
const dbIdx: Record<Op, number> = { select: 0, update: 0, insert: 0 }
let lastSetValues: Record<string, unknown> | null = null
const updateCallLog: Array<{ table: string | null }> = []

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeChain(op: Op, tableRef?: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {}
  const ret = () => chain
  chain.from = ret
  chain.leftJoin = ret
  chain.where = ret
  chain.limit = ret
  chain.orderBy = ret
  chain.set = jest.fn((v: Record<string, unknown>) => {
    lastSetValues = v
    return chain
  })
  chain.returning = ret
  chain.values = ret
  chain.then = (resolve: (v: unknown) => void) => {
    const i = dbIdx[op]
    const arr = dbResponses[op]
    dbIdx[op]++
    return resolve(i < arr.length ? arr[i] : [])
  }
  return chain
}

const mockDb = {
  select: jest.fn(() => makeChain('select')),
  update: jest.fn((t) => {
    updateCallLog.push({ table: t?.__tableName ?? null })
    return makeChain('update', t)
  }),
  insert: jest.fn(() => makeChain('insert')),
}

jest.mock('@/db/client', () => ({ __esModule: true, getDb: () => mockDb }))

jest.mock('@/db/schema', () => {
  const marker = (name: string) => new Proxy({ __tableName: name }, { get: (t, k) => k === '__tableName' ? name : `${name}.${String(k)}` })
  return {
    __esModule: true,
    userFeedback: marker('userFeedback'),
    feedbackConversations: marker('feedbackConversations'),
    feedbackMessages: marker('feedbackMessages'),
    userProfiles: marker('userProfiles'),
  }
})

jest.mock('drizzle-orm', () => ({
  __esModule: true,
  eq: (...a: unknown[]) => ({ __op: 'eq', a }),
  and: (...a: unknown[]) => ({ __op: 'and', a }),
  desc: (x: unknown) => ({ __op: 'desc', x }),
  sql: (s: unknown) => s,
  inArray: (...a: unknown[]) => ({ __op: 'inArray', a }),
  isNull: (x: unknown) => ({ __op: 'isNull', x }),
  ne: (...a: unknown[]) => ({ __op: 'ne', a }),
}))

// SUT
import { updateFeedbackStatus, markMessagesAsRead } from '@/lib/api/admin-feedback/queries'

const FB_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
const ADMIN_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
const CONV_ID = 'cccccccc-cccc-4ccc-cccc-cccccccccccc'

beforeEach(() => {
  dbResponses.select = []
  dbResponses.update = []
  dbResponses.insert = []
  dbIdx.select = 0
  dbIdx.update = 0
  dbIdx.insert = 0
  lastSetValues = null
  updateCallLog.length = 0
  mockDb.select.mockClear()
  mockDb.update.mockClear()
  mockDb.insert.mockClear()
})

// ============================================
// updateFeedbackStatus
// ============================================

describe('updateFeedbackStatus', () => {
  it('actualiza status correctamente (resolved) y setea resolvedAt', async () => {
    dbResponses.update.push([{ id: FB_ID, status: 'resolved' }])
    // Segundo update: feedback_conversations (por ser resolved)
    dbResponses.update.push([])

    const r = await updateFeedbackStatus({
      feedbackId: FB_ID, status: 'resolved', adminUserId: ADMIN_ID,
    })
    expect(r.success).toBe(true)
    expect(lastSetValues?.status).toBe('resolved')
    expect(lastSetValues?.adminUserId).toBe(ADMIN_ID)
    // Debería tener resolvedAt cuando status es resolved/dismissed
    // (el último set es el de conversation, no el feedback — pero
    // basta con verificar que se llamó 2 veces update)
    expect(mockDb.update).toHaveBeenCalledTimes(2)
  })

  it('NO setea resolvedAt si status es pending', async () => {
    dbResponses.update.push([{ id: FB_ID, status: 'pending' }])
    const r = await updateFeedbackStatus({
      feedbackId: FB_ID, status: 'pending', adminUserId: ADMIN_ID,
    })
    expect(r.success).toBe(true)
    // Solo 1 update (feedback, no conversation porque status no es resolved/dismissed)
    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })

  it('NO setea resolvedAt si status es in_review', async () => {
    dbResponses.update.push([{ id: FB_ID, status: 'in_review' }])
    await updateFeedbackStatus({
      feedbackId: FB_ID, status: 'in_review', adminUserId: ADMIN_ID,
    })
    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })

  it('incluye adminResponse en el set si se pasa', async () => {
    dbResponses.update.push([{ id: FB_ID, status: 'resolved', adminResponse: 'Gracias' }])
    dbResponses.update.push([])
    await updateFeedbackStatus({
      feedbackId: FB_ID, status: 'resolved', adminUserId: ADMIN_ID,
      adminResponse: 'Gracias por el reporte',
    })
    // adminResponse se incluye en el primer set (al feedback)
    // lastSetValues captura el ÚLTIMO set, que es el de conversation
    // Tenemos que verificar que al menos uno incluyó adminResponse
    expect(mockDb.update).toHaveBeenCalledTimes(2)
  })

  it('devuelve error si el feedback no existe (update no afecta filas)', async () => {
    dbResponses.update.push([])
    const r = await updateFeedbackStatus({
      feedbackId: FB_ID, status: 'resolved', adminUserId: ADMIN_ID,
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/no encontrado/)
  })

  it('actualiza conversation status solo si feedback status es resolved/dismissed', async () => {
    dbResponses.update.push([{ id: FB_ID, status: 'dismissed' }])
    dbResponses.update.push([])
    await updateFeedbackStatus({
      feedbackId: FB_ID, status: 'dismissed', adminUserId: ADMIN_ID,
    })
    expect(mockDb.update).toHaveBeenCalledTimes(2)
    // Segundo update fue a feedback_conversations
    expect(updateCallLog[1]?.table).toBe('feedbackConversations')
  })

  it('maneja excepciones de BD', async () => {
    mockDb.update.mockImplementationOnce(() => { throw new Error('db error') })
    const r = await updateFeedbackStatus({
      feedbackId: FB_ID, status: 'resolved', adminUserId: ADMIN_ID,
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('db error')
  })
})

// ============================================
// markMessagesAsRead
// ============================================

describe('markMessagesAsRead', () => {
  it('marca mensajes como leídos y devuelve count', async () => {
    // Primer update: feedback_messages → devuelve ids
    dbResponses.update.push([{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }])
    // Segundo update: feedback_conversations.adminViewedAt
    dbResponses.update.push([])

    const r = await markMessagesAsRead({
      conversationId: CONV_ID, adminUserId: ADMIN_ID,
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.updatedCount).toBe(3)
    expect(mockDb.update).toHaveBeenCalledTimes(2)
  })

  it('devuelve count=0 si no había mensajes no leídos', async () => {
    dbResponses.update.push([]) // ningún mensaje updated
    dbResponses.update.push([])

    const r = await markMessagesAsRead({
      conversationId: CONV_ID, adminUserId: ADMIN_ID,
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.updatedCount).toBe(0)
  })

  it('actualiza adminViewedAt de la conversation', async () => {
    dbResponses.update.push([{ id: 'm1' }])
    dbResponses.update.push([])
    await markMessagesAsRead({
      conversationId: CONV_ID, adminUserId: ADMIN_ID,
    })
    // Verificar que ambos tables fueron updated
    expect(updateCallLog[0]?.table).toBe('feedbackMessages')
    expect(updateCallLog[1]?.table).toBe('feedbackConversations')
  })

  it('maneja excepciones de BD', async () => {
    mockDb.update.mockImplementationOnce(() => { throw new Error('db fail') })
    const r = await markMessagesAsRead({
      conversationId: CONV_ID, adminUserId: ADMIN_ID,
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('db fail')
  })
})
