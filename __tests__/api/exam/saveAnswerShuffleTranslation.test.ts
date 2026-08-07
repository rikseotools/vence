/**
 * __tests__/api/exam/saveAnswerShuffleTranslation.test.ts — T-277
 *
 * `saveAnswer` (lib/api/exam/queries.ts) es el único sitio donde el examen persiste una
 * respuesta. Si el examen se sirvió barajado, `userAnswer` llega en coordenadas de lo
 * MOSTRADO; este test comprueba que se traduce a coordenadas ORIGINALES del banco (leyendo
 * el orden de `tests.questions_metadata`, NUNCA del cliente) ANTES de comparar/guardar, y
 * que un examen SIN metadata de orden (histórico) se comporta EXACTAMENTE como hoy.
 *
 * Mismo patrón de mock que __tests__/api/exam/resumeExamData.test.ts (mismo fichero de
 * origen): un objeto "chainable" único donde cada método de Drizzle se devuelve a sí mismo,
 * y se resuelve por CONTADOR en el orden real de las llamadas.
 */
jest.mock('@/db/client', () => {
  const chainable: Record<string, jest.Mock> = {}
  const methods = ['select', 'from', 'where', 'orderBy', 'limit', 'insert', 'values', 'update', 'set', 'onConflictDoUpdate', 'returning']
  for (const m of methods) chainable[m] = jest.fn(() => chainable)
  return { getDb: jest.fn(() => chainable), getPoolerDb: jest.fn(() => chainable), __chainable: chainable }
})

jest.mock('@/db/schema', () => ({
  tests: { id: 'id', userId: 'user_id', questionsMetadata: 'questions_metadata' },
  testQuestions: {
    id: 'id', testId: 'test_id', questionId: 'question_id', questionOrder: 'question_order',
    userAnswer: 'user_answer', correctAnswer: 'correct_answer', questionText: 'question_text',
    isCorrect: 'is_correct', temaNumber: 'tema_number', timeSpentSeconds: 'time_spent_seconds',
    confidenceLevel: 'confidence_level', articleId: 'article_id', articleNumber: 'article_number',
    lawName: 'law_name', difficulty: 'difficulty', userId: 'user_id',
  },
  questions: { id: 'id', correctOption: 'correct_option' },
  userProfiles: { id: 'id', targetOposicion: 'target_oposicion' },
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: jest.fn((...args: unknown[]) => ({ type: 'and', args })),
  desc: jest.fn((...args: unknown[]) => ({ type: 'desc', args })),
  sql: jest.fn((...args: unknown[]) => ({ type: 'sql', args })),
  count: jest.fn(() => ({ type: 'count' })),
  isNull: jest.fn((...args: unknown[]) => ({ type: 'isNull', args })),
  inArray: jest.fn((...args: unknown[]) => ({ type: 'inArray', args })),
}))

jest.mock('@/lib/api/tema-resolver', () => ({
  resolveTemaByArticle: jest.fn().mockResolvedValue({ success: false }),
  resolveTemasBatchByQuestionIds: jest.fn(),
}))
jest.mock('@/lib/config/oposiciones', () => ({ ALL_OPOSICION_IDS: ['auxiliar_administrativo_estado'] }))
jest.mock('@/lib/api/dailyLimit', () => ({ estrenaRespuesta: (v: unknown) => !v }))

import { saveAnswer } from '@/lib/api/exam/queries'

const { __chainable: chainable } = jest.requireMock('@/db/client') as { __chainable: Record<string, jest.Mock> }

const TEST_ID = '11111111-1111-1111-1111-111111111111'
const Q_ID = 'aaaa0001-0001-0001-0001-000000000001'

beforeEach(() => {
  jest.clearAllMocks()
  for (const fn of Object.values(chainable)) fn.mockReturnValue(chainable)
})

describe('saveAnswer — traduce userAnswer de MOSTRADA a ORIGINAL antes de comparar/guardar (T-277)', () => {
  it('examen barajado, fila YA EXISTE: la respuesta mostrada se traduce y SE COMPARA en coordenadas originales', async () => {
    // order = [2,0,1,3]: posición mostrada 1 ('b') → índice original 0 ('a')
    let limitCall = 0
    chainable.limit.mockImplementation(() => {
      limitCall++
      if (limitCall === 1) {
        // SELECT existing test_questions row
        return [{ id: 'row-1', correctAnswer: 'a', temaNumber: 3, userAnswer: '' }]
      }
      // SELECT tests (userId + questionsMetadata)
      return [{ userId: 'user-1', questionsMetadata: { option_orders: { [Q_ID]: [2, 0, 1, 3] } } }]
    })

    const result = await saveAnswer({
      testId: TEST_ID,
      callerUserId: 'user-1',
      questionId: Q_ID,
      questionOrder: 1,
      userAnswer: 'b', // lo que el usuario CLICÓ (posición mostrada)
    })

    expect(result.success).toBe(true)
    // correctAnswer='a' (original, ya en la fila) y userAnswer TRADUCIDO 'b'→'a' → coinciden
    expect(result.isCorrect).toBe(true)

    // Lo que se envía a `.set(...)` en el UPDATE debe llevar la letra ORIGINAL, no la mostrada:
    // si se guardara 'b' tal cual, cualquier lectura futura de test_questions (stats,
    // analítica) mentiría sobre qué opción del BANCO marcó el usuario.
    const setCall = chainable.set.mock.calls[0][0]
    expect(setCall.userAnswer).toBe('a')
    expect(setCall.isCorrect).toBe(true)
  })

  it('examen barajado: una respuesta MOSTRADA distinta de la correcta original se guarda como fallo, no como acierto', async () => {
    let limitCall = 0
    chainable.limit.mockImplementation(() => {
      limitCall++
      if (limitCall === 1) return [{ id: 'row-1', correctAnswer: 'a', temaNumber: 3, userAnswer: '' }]
      return [{ userId: 'user-1', questionsMetadata: { option_orders: { [Q_ID]: [2, 0, 1, 3] } } }]
    })

    // 'a' mostrada → order[0]=2 → original 'c', que NO es 'a' (la correcta) → debe fallar
    const result = await saveAnswer({ testId: TEST_ID, callerUserId: 'user-1', questionId: Q_ID, questionOrder: 1, userAnswer: 'a' })

    expect(result.isCorrect).toBe(false)
    expect(chainable.set.mock.calls[0][0].userAnswer).toBe('c')
  })

  it('SIN metadata.option_orders (examen histórico o sin shuffle): identidad total, cero cambio de comportamiento', async () => {
    let limitCall = 0
    chainable.limit.mockImplementation(() => {
      limitCall++
      if (limitCall === 1) return [{ id: 'row-1', correctAnswer: 'b', temaNumber: 3, userAnswer: '' }]
      return [{ userId: 'user-1', questionsMetadata: { question_ids: [Q_ID] } }] // sin option_orders
    })

    const result = await saveAnswer({ testId: TEST_ID, callerUserId: 'user-1', questionId: Q_ID, questionOrder: 1, userAnswer: 'b' })

    expect(result.isCorrect).toBe(true)
    expect(chainable.set.mock.calls[0][0].userAnswer).toBe('b') // sin traducir, tal cual llegó
  })

  it('la pregunta de ESTE testId no tiene orden propio en el mapa (otra pregunta sí): tampoco se traduce', async () => {
    let limitCall = 0
    chainable.limit.mockImplementation(() => {
      limitCall++
      if (limitCall === 1) return [{ id: 'row-1', correctAnswer: 'c', temaNumber: 3, userAnswer: '' }]
      // el mapa tiene orden para OTRA pregunta, no para Q_ID
      return [{ userId: 'user-1', questionsMetadata: { option_orders: { 'otra-pregunta-id': [1, 0] } } }]
    })

    const result = await saveAnswer({ testId: TEST_ID, callerUserId: 'user-1', questionId: Q_ID, questionOrder: 1, userAnswer: 'c' })

    expect(result.isCorrect).toBe(true) // identidad: 'c' se compara tal cual contra 'c'
    expect(chainable.set.mock.calls[0][0].userAnswer).toBe('c')
  })
})
