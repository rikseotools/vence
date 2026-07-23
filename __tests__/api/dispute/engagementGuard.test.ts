// Integración: red de seguridad del servidor (engagement de impugnación).
// Una impugnación de una pregunta que el usuario NUNCA respondió (sin fila en test_questions)
// es sospechosa de mala atribución (bug 21/07). El guard lo EMITE (observable), NO bloquea, y
// va DESACOPLADO del path de latencia.

const mockEmit = jest.fn()
jest.mock('@/lib/observability/emit', () => ({ emitFireAndForget: (...a: unknown[]) => mockEmit(...a) }))

// Espía sobre eq() de Drizzle: captura (columna, valor) para verificar que el guard consulta
// las COLUMNAS correctas (si alguien cambia la columna del WHERE, el control-flow seguiría
// pasando; esto lo caza).
const mockEqCalls: Array<[unknown, unknown]> = []
jest.mock('drizzle-orm', () => {
  const actual = jest.requireActual('drizzle-orm')
  return { ...actual, eq: (col: unknown, val: unknown) => { mockEqCalls.push([col, val]); return actual.eq(col, val) } }
})

// Cola de resultados del builder fluido de Drizzle (cada await terminal saca uno). Un Error en
// la cola simula un fallo de BD.
const mockState: { queue: unknown[] } = { queue: [] }
jest.mock('@/db/client', () => {
  const makeChain = () => {
    const chain: any = {
      select: () => chain, from: () => chain, where: () => chain, limit: () => chain,
      insert: () => chain, values: () => chain, returning: () => chain,
      then: (resolve: any, reject: any) => {
        const v = mockState.queue.shift()
        return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(resolve, reject)
      },
    }
    return chain
  }
  return { getDb: () => makeChain(), getPoolerDb: () => makeChain() }
})

import { checkDisputeEngagement, createDispute } from '@/lib/api/dispute/queries'
import { testQuestions } from '@/db/schema'

const USER = '0983b900-9238-4644-9778-7661e16bd6eb'
const Q = '3bfcfd34-4444-4444-4444-444444444444'
const insertRow = [{ id: 'd1', questionId: Q, userId: USER, disputeType: 'otro', description: 'x', status: 'pending', createdAt: '2026-07-21' }]

beforeEach(() => {
  mockEmit.mockClear()
  mockEqCalls.length = 0
  mockState.queue = []
  delete process.env.USE_SELF_HOSTED_POOLER
})

function emittedNotEngaged() {
  return mockEmit.mock.calls.some(([e]) => e?.eventType === 'dispute_question_not_engaged')
}

describe('checkDisputeEngagement — red de seguridad observable', () => {
  it('EMITE warn cuando el usuario NO respondió la pregunta', async () => {
    mockState.queue = [[]] // sin fila en test_questions
    await checkDisputeEngagement(USER, Q, 'otro')
    expect(emittedNotEngaged()).toBe(true)
    const [event] = mockEmit.mock.calls.find(([e]) => e?.eventType === 'dispute_question_not_engaged')!
    expect(event.severity).toBe('warn')
    expect(event.userId).toBe(USER)
    expect(event.metadata.questionId).toBe(Q)
  })

  it('NO emite cuando el usuario SÍ respondió la pregunta', async () => {
    mockState.queue = [[{ id: 'tq1' }]]
    await checkDisputeEngagement(USER, Q, 'otro')
    expect(emittedNotEngaged()).toBe(false)
  })

  it('consulta las COLUMNAS correctas (test_questions.userId Y .questionId)', async () => {
    mockState.queue = [[]]
    await checkDisputeEngagement(USER, Q, 'otro')
    expect(mockEqCalls).toContainEqual([testQuestions.userId, USER])
    expect(mockEqCalls).toContainEqual([testQuestions.questionId, Q])
  })

  it('best-effort: si la consulta falla, no lanza ni emite', async () => {
    mockState.queue = [new Error('db down')]
    await expect(checkDisputeEngagement(USER, Q, 'otro')).resolves.toBeUndefined()
    expect(emittedNotEngaged()).toBe(false)
  })
})

describe('createDispute — llama al guard SIN bloquear la creación', () => {
  it('crea la impugnación (guard desacoplado, no bloquea)', async () => {
    // orden de consumo: [pregunta existe][engagement][sin previa][insert]
    mockState.queue = [[{ id: Q }], [{ id: 'tq1' }], [], insertRow]
    const res = await createDispute(Q, USER, 'otro', 'texto')
    expect(res.success).toBe(true)
  })

  it('si la pregunta no existe, ni siquiera consulta engagement', async () => {
    mockState.queue = [[]] // pregunta no encontrada
    const res = await createDispute(Q, USER, 'otro', 'texto')
    expect(res.success).toBe(false)
    expect(emittedNotEngaged()).toBe(false)
  })
})
