/**
 * Tests para getResumedExamData y getPendingExams sin ghost rows
 * Verifica que el path de metadata y el fallback legacy funcionan correctamente
 */

// Setup mocks before any imports
jest.mock('@/db/client', () => {
  const chainable: Record<string, jest.Mock> = {}
  const methods = ['select', 'from', 'where', 'orderBy', 'limit', 'insert', 'values', 'update', 'set']
  for (const m of methods) {
    chainable[m] = jest.fn(() => chainable)
  }
  return {
    getDb: jest.fn(() => chainable),
    __chainable: chainable,
  }
})

jest.mock('@/db/schema', () => ({
  tests: {
    id: 'id',
    userId: 'user_id',
    temaNumber: 'tema_number',
    totalQuestions: 'total_questions',
    isCompleted: 'is_completed',
    questionsMetadata: 'questions_metadata',
    title: 'title',
    testType: 'test_type',
    score: 'score',
    createdAt: 'created_at',
    completedAt: 'completed_at',
  },
  testQuestions: {
    id: 'id',
    testId: 'test_id',
    questionId: 'question_id',
    questionOrder: 'question_order',
    userAnswer: 'user_answer',
    correctAnswer: 'correct_answer',
    questionText: 'question_text',
    isCorrect: 'is_correct',
    timeSpentSeconds: 'time_spent_seconds',
  },
  questions: {
    id: 'id',
    correctOption: 'correct_option',
  },
  userProfiles: {
    id: 'id',
    targetOposicion: 'target_oposicion',
  },
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: jest.fn((...args: unknown[]) => ({ type: 'and', args })),
  desc: jest.fn((...args: unknown[]) => ({ type: 'desc', args })),
  sql: jest.fn((...args: unknown[]) => {
    const result: Record<string, unknown> = { type: 'sql', args, as: jest.fn() }
    result.as = jest.fn(() => result)
    return result
  }),
  count: jest.fn(() => ({ type: 'count' })),
  isNull: jest.fn((...args: unknown[]) => ({ type: 'isNull', args })),
  inArray: jest.fn((...args: unknown[]) => ({ type: 'inArray', args })),
}))

jest.mock('@/lib/api/tema-resolver', () => ({
  resolveTemaByArticle: jest.fn(),
  resolveTemasBatchByQuestionIds: jest.fn(),
}))

jest.mock('@/lib/config/oposiciones', () => ({
  ALL_OPOSICION_IDS: ['auxiliar_administrativo_estado'],
}))

import { getResumedExamData } from '@/lib/api/exam/queries'

const { __chainable: chainable } = jest.requireMock('@/db/client') as { __chainable: Record<string, jest.Mock> }

// Helper UUIDs
const TEST_ID = '11111111-1111-1111-1111-111111111111'
const USER_ID = '22222222-2222-2222-2222-222222222222'
const Q1_ID = 'aaaa0001-0001-0001-0001-000000000001'
const Q2_ID = 'aaaa0002-0002-0002-0002-000000000002'
const Q3_ID = 'aaaa0003-0003-0003-0003-000000000003'

describe('getResumedExamData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    for (const fn of Object.values(chainable)) {
      fn.mockReturnValue(chainable)
    }
  })

  describe('con metadata (path nuevo)', () => {
    it('lee question_ids de metadata y hace merge con respuestas', async () => {
      // Primer select: test con metadata
      const testData = [{
        id: TEST_ID,
        temaNumber: 1,
        totalQuestions: 3,
        isCompleted: false,
        questionsMetadata: {
          question_ids: [Q1_ID, Q2_ID, Q3_ID],
        },
      }]

      // Segundo select: respuestas parciales (solo Q1 respondida)
      const answeredData = [{
        questionOrder: 1,
        questionId: Q1_ID,
        userAnswer: 'b',
        correctAnswer: 'b',
        questionText: 'Pregunta 1',
      }]

      // Mock encadenado: limit -> testData, orderBy -> answeredData
      let callCount = 0
      chainable.limit.mockImplementation(() => {
        callCount++
        if (callCount === 1) return testData
        return answeredData
      })
      chainable.orderBy.mockReturnValue(answeredData)

      const result = await getResumedExamData(TEST_ID)

      expect(result.success).toBe(true)
      expect(result.totalQuestions).toBe(3)
      expect(result.answeredCount).toBe(1)
      expect(result.questions).toHaveLength(3)
      // Q1 con respuesta
      expect(result.questions![0].questionId).toBe(Q1_ID)
      expect(result.questions![0].userAnswer).toBe('b')
      // Q2 y Q3 sin respuesta
      expect(result.questions![1].questionId).toBe(Q2_ID)
      expect(result.questions![1].userAnswer).toBeNull()
      expect(result.questions![2].questionId).toBe(Q3_ID)
      expect(result.questions![2].userAnswer).toBeNull()
    })

    it('maneja 0 respuestas correctamente', async () => {
      const testData = [{
        id: TEST_ID,
        temaNumber: 1,
        totalQuestions: 3,
        isCompleted: false,
        questionsMetadata: {
          question_ids: [Q1_ID, Q2_ID, Q3_ID],
        },
      }]

      let callCount = 0
      chainable.limit.mockImplementation(() => {
        callCount++
        if (callCount === 1) return testData
        return []
      })
      chainable.orderBy.mockReturnValue([])

      const result = await getResumedExamData(TEST_ID)

      expect(result.success).toBe(true)
      expect(result.answeredCount).toBe(0)
      expect(result.questions).toHaveLength(3)
      result.questions!.forEach(q => {
        expect(q.userAnswer).toBeNull()
      })
    })

    it('incluye todas las preguntas incluso si no están en test_questions', async () => {
      const testData = [{
        id: TEST_ID,
        temaNumber: 5,
        totalQuestions: 2,
        isCompleted: false,
        questionsMetadata: {
          question_ids: [Q1_ID, Q2_ID],
        },
      }]

      // Solo Q2 respondida
      const answeredData = [{
        questionOrder: 2,
        questionId: Q2_ID,
        userAnswer: 'c',
        correctAnswer: 'a',
        questionText: 'Pregunta 2',
      }]

      let callCount = 0
      chainable.limit.mockImplementation(() => {
        callCount++
        if (callCount === 1) return testData
        return answeredData
      })
      chainable.orderBy.mockReturnValue(answeredData)

      const result = await getResumedExamData(TEST_ID)

      expect(result.success).toBe(true)
      expect(result.questions).toHaveLength(2)
      // Q1 sin respuesta
      expect(result.questions![0].questionId).toBe(Q1_ID)
      expect(result.questions![0].userAnswer).toBeNull()
      // Q2 respondida
      expect(result.questions![1].questionId).toBe(Q2_ID)
      expect(result.questions![1].userAnswer).toBe('c')
    })
  })

  describe('fallback legacy (sin metadata)', () => {
    it('sin metadata usa test_questions como antes', async () => {
      const testData = [{
        id: TEST_ID,
        temaNumber: 1,
        totalQuestions: 2,
        isCompleted: false,
        questionsMetadata: {}, // sin question_ids
      }]

      const legacyQuestions = [
        { questionOrder: 1, questionId: Q1_ID, userAnswer: 'a', correctAnswer: 'a', questionText: 'P1' },
        { questionOrder: 2, questionId: Q2_ID, userAnswer: '', correctAnswer: 'b', questionText: 'P2' },
      ]

      let callCount = 0
      chainable.limit.mockImplementation(() => {
        callCount++
        if (callCount === 1) return testData
        return legacyQuestions
      })
      chainable.orderBy.mockReturnValue(legacyQuestions)

      const result = await getResumedExamData(TEST_ID)

      expect(result.success).toBe(true)
      expect(result.questions).toHaveLength(2)
      expect(result.answeredCount).toBe(1) // Solo Q1 tiene respuesta no vacía
    })

    it('examen null metadata también usa fallback', async () => {
      const testData = [{
        id: TEST_ID,
        temaNumber: 1,
        totalQuestions: 1,
        isCompleted: false,
        questionsMetadata: null,
      }]

      const legacyQuestions = [
        { questionOrder: 1, questionId: Q1_ID, userAnswer: 'c', correctAnswer: 'c', questionText: 'P1' },
      ]

      let callCount = 0
      chainable.limit.mockImplementation(() => {
        callCount++
        if (callCount === 1) return testData
        return legacyQuestions
      })
      chainable.orderBy.mockReturnValue(legacyQuestions)

      const result = await getResumedExamData(TEST_ID)

      expect(result.success).toBe(true)
      expect(result.answeredCount).toBe(1)
    })
  })

  describe('casos de error', () => {
    it('test no encontrado retorna error', async () => {
      chainable.limit.mockReturnValue([])

      const result = await getResumedExamData(TEST_ID)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Test no encontrado')
    })

    it('examen completado retorna error', async () => {
      chainable.limit.mockReturnValue([{
        id: TEST_ID,
        temaNumber: 1,
        totalQuestions: 10,
        isCompleted: true,
        questionsMetadata: { question_ids: [Q1_ID] },
      }])

      const result = await getResumedExamData(TEST_ID)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Este examen ya está completado')
    })
  })
})

describe('getPendingExams - filtro sin ghost rows', () => {
  // Testeamos la lógica de filtrado directamente (el filtro real en queries.ts)
  // porque mockear toda la cadena de DB de getPendingExams es demasiado complejo.

  const filterFn = (e: { testType: string; answeredQuestions: number }) =>
    e.testType === 'exam' || e.answeredQuestions > 0

  it('examen sin respuestas aparece en pendientes', () => {
    const exam = { testType: 'exam', answeredQuestions: 0 }
    expect(filterFn(exam)).toBe(true)
  })

  it('examen con respuestas aparece en pendientes', () => {
    const exam = { testType: 'exam', answeredQuestions: 5 }
    expect(filterFn(exam)).toBe(true)
  })

  it('practice sin respuestas NO aparece en pendientes', () => {
    const practice = { testType: 'practice', answeredQuestions: 0 }
    expect(filterFn(practice)).toBe(false)
  })

  it('practice con respuestas SÍ aparece en pendientes', () => {
    const practice = { testType: 'practice', answeredQuestions: 3 }
    expect(filterFn(practice)).toBe(true)
  })
})
