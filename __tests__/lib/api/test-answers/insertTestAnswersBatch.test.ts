// __tests__/lib/api/test-answers/insertTestAnswersBatch.test.ts
// Tests para insertTestAnswersBatch: inserción batch idempotente contra test_questions.
//
// Cubre:
//  - Empty input
//  - Batch insert con ON CONFLICT DO NOTHING
//  - Reporte correcto de {attempted, inserted, skipped}
//  - Fallos del INSERT
//  - Caché compartida de oposicionId para evitar N queries a userProfiles

// ============================================
// Mocks
// ============================================

type InsertCall = {
  table: string
  values: any[]
  onConflictTarget?: any
  returningCalled: boolean
}

const insertCalls: InsertCall[] = []
// El resultado del `.returning()` simulando qué filas quedaron tras ON CONFLICT.
// Se configura por test.
let mockReturningRows: Array<{ id: string }> = []
let shouldThrowOnInsert = false

function makeMockDb() {
  return {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn(async () => [{ targetOposicion: 'auxiliar_administrativo_estado' }]),
        })),
      })),
    })),
    insert: jest.fn(() => {
      const call: InsertCall = { table: 'testQuestions', values: [], returningCalled: false }
      insertCalls.push(call)
      const chain: any = {
        values: (rows: any) => {
          call.values = Array.isArray(rows) ? rows : [rows]
          return chain
        },
        onConflictDoNothing: (args?: any) => {
          call.onConflictTarget = args?.target
          return chain
        },
        returning: () => {
          call.returningCalled = true
          if (shouldThrowOnInsert) {
            return Promise.reject(new Error('simulated insert error'))
          }
          return Promise.resolve(mockReturningRows)
        },
        // Si la función se usa sin .returning() hace el await directo
        then: (resolve: (v: any) => void) => {
          if (shouldThrowOnInsert) throw new Error('simulated insert error')
          resolve(undefined)
        },
      }
      return chain
    }),
  }
}

let mockDb = makeMockDb()

jest.mock('@/db/client', () => ({
  getDb: () => mockDb,
}))

jest.mock('@/db/schema', () => ({
  testQuestions: {
    testId: 'testQuestions.testId',
    questionOrder: 'testQuestions.questionOrder',
  },
  userProfiles: {
    id: 'userProfiles.id',
    targetOposicion: 'userProfiles.targetOposicion',
  },
}))

jest.mock('drizzle-orm', () => ({
  eq: (a: any, b: any) => ({ type: 'eq', a, b }),
}))

// No resolver tema por red; devolver null → el caller usa el tema del request.
jest.mock('@/lib/api/tema-resolver/queries', () => ({
  resolveTemaNumber: jest.fn(async () => null),
}))

jest.mock('@/lib/config/oposiciones', () => ({
  ALL_OPOSICION_IDS: ['auxiliar_administrativo_estado', 'tramitacion_procesal', 'auxilio_judicial'],
}))

jest.mock('@/lib/api/shared/difficulty', () => ({
  normalizeDifficulty: (d: any) => d ?? null,
  VALID_DIFFICULTIES: ['easy', 'medium', 'hard', 'extreme'] as const,
}))

import { insertTestAnswersBatch } from '@/lib/api/test-answers/queries'
import type { SaveAnswerRequest } from '@/lib/api/test-answers'

// ============================================
// Helpers
// ============================================

function makeSaveRequest(overrides: Partial<SaveAnswerRequest> = {}): SaveAnswerRequest {
  return {
    sessionId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    questionData: {
      id: 'q-1',
      question: 'Pregunta?',
      options: ['A', 'B', 'C', 'D'],
      tema: 5,
      questionType: 'legislative',
      article: { id: 'art-1', number: '14', law_short_name: 'CE' },
      metadata: { difficulty: 'medium' },
      explanation: 'Porque sí',
    },
    answerData: {
      questionIndex: 0,
      selectedAnswer: 1,
      correctAnswer: 1,
      isCorrect: true,
      timeSpent: 10,
    },
    tema: 5,
    confidenceLevel: 'sure',
    interactionCount: 1,
    questionStartTime: 1000,
    firstInteractionTime: 1500,
    interactionEvents: [],
    mouseEvents: [],
    scrollEvents: [],
    deviceInfo: {
      userAgent: 'jest',
      screenResolution: '1920x1080',
      deviceType: 'desktop',
      browserLanguage: 'es',
      timezone: 'Europe/Madrid',
    },
    oposicionId: 'auxiliar_administrativo_estado',
    ...overrides,
  }
}

// ============================================
// Tests
// ============================================

describe('insertTestAnswersBatch', () => {
  beforeEach(() => {
    insertCalls.length = 0
    mockReturningRows = []
    shouldThrowOnInsert = false
    mockDb = makeMockDb()
  })

  it('devuelve 0/0/0 cuando el array está vacío sin tocar la BD', async () => {
    const result = await insertTestAnswersBatch([], 'user-1')

    expect(result).toEqual({ attempted: 0, inserted: 0, skipped: 0, errored: false })
    expect(insertCalls).toHaveLength(0)
  })

  it('devuelve 0/0/0 cuando requests es null/undefined', async () => {
    const result = await insertTestAnswersBatch(null as any, 'user-1')
    expect(result.attempted).toBe(0)
    expect(insertCalls).toHaveLength(0)
  })

  it('hace UN solo INSERT con todas las rows', async () => {
    const reqs = [
      makeSaveRequest({
        answerData: { questionIndex: 0, selectedAnswer: 1, correctAnswer: 1, isCorrect: true, timeSpent: 10 },
      }),
      makeSaveRequest({
        answerData: { questionIndex: 1, selectedAnswer: 2, correctAnswer: 2, isCorrect: true, timeSpent: 12 },
      }),
      makeSaveRequest({
        answerData: { questionIndex: 2, selectedAnswer: 0, correctAnswer: 3, isCorrect: false, timeSpent: 20 },
      }),
    ]

    mockReturningRows = [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }]

    const result = await insertTestAnswersBatch(reqs, 'user-1')

    // Una única llamada a insert
    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0].values).toHaveLength(3)

    // ON CONFLICT configurado con target correcto
    expect(insertCalls[0].onConflictTarget).toBeDefined()

    // returning() se llamó (para contar inserted)
    expect(insertCalls[0].returningCalled).toBe(true)

    // Resultado coherente
    expect(result.attempted).toBe(3)
    expect(result.inserted).toBe(3)
    expect(result.skipped).toBe(0)
    expect(result.errored).toBe(false)
  })

  it('skipped refleja filas absorbidas por ON CONFLICT DO NOTHING', async () => {
    const reqs = [
      makeSaveRequest({
        answerData: { questionIndex: 0, selectedAnswer: 1, correctAnswer: 1, isCorrect: true, timeSpent: 10 },
      }),
      makeSaveRequest({
        answerData: { questionIndex: 1, selectedAnswer: 2, correctAnswer: 2, isCorrect: true, timeSpent: 12 },
      }),
      makeSaveRequest({
        answerData: { questionIndex: 2, selectedAnswer: 0, correctAnswer: 3, isCorrect: false, timeSpent: 20 },
      }),
    ]

    // Solo 1 de 3 realmente insertada (las otras 2 ya existían vía /answer-and-save)
    mockReturningRows = [{ id: 'r1' }]

    const result = await insertTestAnswersBatch(reqs, 'user-1')

    expect(result.attempted).toBe(3)
    expect(result.inserted).toBe(1)
    expect(result.skipped).toBe(2)
    expect(result.errored).toBe(false)
  })

  it('construye rows con las columnas clave correctas', async () => {
    const reqs = [
      makeSaveRequest({
        sessionId: 'session-xyz',
        answerData: { questionIndex: 5, selectedAnswer: 2, correctAnswer: 1, isCorrect: false, timeSpent: 15 },
        confidenceLevel: 'very_sure',
      }),
    ]
    mockReturningRows = [{ id: 'r1' }]

    await insertTestAnswersBatch(reqs, 'user-1')

    const row = insertCalls[0].values[0]
    expect(row.testId).toBe('session-xyz')
    expect(row.questionOrder).toBe(6) // questionIndex + 1
    expect(row.userAnswer).toBe('C') // index 2 → C
    expect(row.correctAnswer).toBe('B') // index 1 → B
    expect(row.isCorrect).toBe(false)
    expect(row.confidenceLevel).toBe('very_sure')
    expect(row.timeSpentSeconds).toBe(15)
    expect(row.questionType).toBe('legislative')
  })

  it('detecta psychometric y pone los IDs en el campo correcto', async () => {
    const reqs = [
      makeSaveRequest({
        questionData: {
          id: 'psy-123',
          question: 'Series numericas',
          options: ['1', '2', '3', '4'],
          tema: 0,
          questionType: 'psychometric',
          metadata: { difficulty: 'medium' },
          article: null,
          explanation: null,
        },
      }),
    ]
    mockReturningRows = [{ id: 'r1' }]

    await insertTestAnswersBatch(reqs, 'user-1')

    const row = insertCalls[0].values[0]
    expect(row.questionType).toBe('psychometric')
    expect(row.psychometricQuestionId).toBe('psy-123')
    expect(row.questionId).toBeNull()
  })

  it('marca errored=true si el INSERT entero falla', async () => {
    shouldThrowOnInsert = true

    const reqs = [makeSaveRequest()]
    const result = await insertTestAnswersBatch(reqs, 'user-1')

    expect(result.errored).toBe(true)
    expect(result.inserted).toBe(0)
    expect(result.error).toContain('simulated insert error')
  })

  it('no rompe si una row individual falla el build — la salta', async () => {
    // Primer request con datos OK, segundo con questionData=null que hará
    // crash al leer .id en buildTestAnswerRow. El batch debe continuar con
    // la row válida.
    const reqs = [
      makeSaveRequest(),
      { ...makeSaveRequest(), questionData: null as any },
    ]
    mockReturningRows = [{ id: 'r1' }]

    const result = await insertTestAnswersBatch(reqs, 'user-1')

    // Solo la row válida se insertó — la malformada se descartó silenciosamente
    expect(result.attempted).toBe(1)
    expect(result.inserted).toBe(1)
    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0].values).toHaveLength(1)
  })
})
