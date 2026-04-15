// __tests__/lib/api/test-answers/wasBlankIntegration.test.ts
//
// Test de integración de la feature "Dejar en blanco". No usa BD real (sería
// flaky y lento) — usa mock del db client pero verifica que el INSERT
// contiene los campos correctos END-TO-END desde una request tipo API hasta
// la row que llega a test_questions.
//
// Cubre el pipeline completo:
//   SaveAnswerRequest (wasBlank=true, selectedAnswer=-1)
//     → buildTestAnswerRow → INSERT INTO test_questions
//
// Contrato verificado:
//   user_answer = 'BLANK' (marcador explícito)
//   is_correct = false
//   was_blank = true
//   (a diferencia de la ruta legacy -1 sin wasBlank, que pone una letra
//    incorrecta y was_blank=false)

// ============================================
// Mocks
// ============================================

// Mock del db client con factory self-contained (no puede referenciar
// variables out-of-scope por restricción de jest.mock hoisting).
jest.mock('@/db/client', () => {
  const inserted: any[] = []
  let throwDuplicate = false
  return {
    __inserted: inserted,
    __setThrowDuplicate: (v: boolean) => { throwDuplicate = v },
    __reset: () => { inserted.length = 0; throwDuplicate = false },
    getDb: () => ({
      insert: () => ({
        values: (rows: any) => {
          if (throwDuplicate) {
            throwDuplicate = false // solo aplica una vez
            return Promise.reject(Object.assign(new Error('duplicate'), { code: '23505' }))
          }
          const arr = Array.isArray(rows) ? rows : [rows]
          inserted.push(...arr)
          return Promise.resolve()
        },
      }),
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ targetOposicion: 'auxiliar_administrativo_estado' }]),
          }),
        }),
      }),
    }),
    getAdminDb: () => ({
      insert: () => ({
        values: (rows: any) => {
          const arr = Array.isArray(rows) ? rows : [rows]
          inserted.push(...arr)
          return Promise.resolve()
        },
      }),
    }),
  }
})

// Helpers para acceder al mock
const dbMock = jest.requireMock('@/db/client') as {
  __inserted: InsertedRow[]
  __setThrowDuplicate: (v: boolean) => void
  __reset: () => void
}

interface InsertedRow {
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  wasBlank: boolean
  questionOrder: number
  testId: string
  questionId?: string | null
  [key: string]: unknown
}

import { insertTestAnswer } from '@/lib/api/test-answers/queries'

describe('insertTestAnswer — feature "Dejar en blanco" end-to-end', () => {
  const USER_ID = '00000000-0000-0000-0000-0000000000aa'
  const SESSION_ID = '00000000-0000-0000-0000-0000000000bb'
  const QUESTION_ID = '00000000-0000-0000-0000-0000000000cc'

  const baseReq = {
    sessionId: SESSION_ID,
    questionData: {
      id: QUESTION_ID,
      question: '¿Cuál es la respuesta?',
      options: ['OpA', 'OpB', 'OpC', 'OpD'],
      tema: 5,
      questionType: 'legislative' as const,
      article: { number: '1', law_short_name: 'CE' },
      metadata: { difficulty: 'medium' as const },
    },
    tema: 5,
  }

  beforeEach(() => {
    dbMock.__reset()
  })

  test('respuesta NORMAL (wasBlank=false): user_answer=letra + was_blank=false', async () => {
    const res = await insertTestAnswer({
      ...baseReq,
      answerData: {
        questionIndex: 0,
        selectedAnswer: 2, // 'C'
        correctAnswer: 2,
        isCorrect: true,
        timeSpent: 5,
      },
    }, USER_ID)
    expect(res.success).toBe(true)
    expect(dbMock.__inserted).toHaveLength(1)
    const row = dbMock.__inserted[0]
    expect(row.userAnswer).toBe('C')
    expect(row.correctAnswer).toBe('C')
    expect(row.isCorrect).toBe(true)
    expect(row.wasBlank).toBe(false)
  })

  test('respuesta EN BLANCO (wasBlank=true): user_answer=BLANK + was_blank=true + is_correct=false', async () => {
    const res = await insertTestAnswer({
      ...baseReq,
      answerData: {
        questionIndex: 0,
        selectedAnswer: -1, // sin selección
        correctAnswer: 2,
        isCorrect: false, // blanco nunca es correcto
        timeSpent: 3,
        wasBlank: true,
      },
    }, USER_ID)
    expect(res.success).toBe(true)
    expect(dbMock.__inserted).toHaveLength(1)
    const row = dbMock.__inserted[0]
    expect(row.userAnswer).toBe('BLANK')
    expect(row.correctAnswer).toBe('C')
    expect(row.isCorrect).toBe(false)
    expect(row.wasBlank).toBe(true)
  })

  test('legacy: selectedAnswer=-1 SIN wasBlank (pérdida de conexión) → user_answer=letra incorrecta + was_blank=false', async () => {
    // Este es el comportamiento pre-existente para rellenar huecos cuando la
    // cola del cliente no drena a tiempo. Verificamos que NO rompemos el
    // contrato: sin wasBlank, sigue poniendo letra incorrecta como antes.
    const res = await insertTestAnswer({
      ...baseReq,
      answerData: {
        questionIndex: 0,
        selectedAnswer: -1,
        correctAnswer: 2,
        isCorrect: false,
        timeSpent: 0,
        // wasBlank NO presente (undefined)
      },
    }, USER_ID)
    expect(res.success).toBe(true)
    const row = dbMock.__inserted[0]
    // Letra incorrecta: correct=2 (C), siguiente=D
    expect(row.userAnswer).toBe('D')
    expect(row.wasBlank).toBe(false)
    expect(row.isCorrect).toBe(false)
  })

  test('respuesta incorrecta normal (wasBlank no pasado): comportamiento sin cambios', async () => {
    const res = await insertTestAnswer({
      ...baseReq,
      answerData: {
        questionIndex: 0,
        selectedAnswer: 1, // 'B'
        correctAnswer: 2, // 'C'
        isCorrect: false,
        timeSpent: 4,
      },
    }, USER_ID)
    expect(res.success).toBe(true)
    const row = dbMock.__inserted[0]
    expect(row.userAnswer).toBe('B')
    expect(row.isCorrect).toBe(false)
    expect(row.wasBlank).toBe(false)
  })

  test('idempotencia (duplicate key 23505): no rompe, devuelve already_saved', async () => {
    dbMock.__setThrowDuplicate(true)
    const res = await insertTestAnswer({
      ...baseReq,
      answerData: {
        questionIndex: 0,
        selectedAnswer: -1,
        correctAnswer: 2,
        isCorrect: false,
        timeSpent: 3,
        wasBlank: true,
      },
    }, USER_ID)
    expect(res.success).toBe(true)
    expect(res.action).toBe('already_saved')
  })
})
