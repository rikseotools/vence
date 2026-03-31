/**
 * Tests para queries de test-answers
 * Verifica logica de insert con mocks de DB
 */

/** Simula la estructura real de errores Drizzle (wraps Postgres error in .cause) */
function makeDrizzleError(pgCode: string, detail?: string): Error {
  const pgError = Object.assign(new Error(detail || 'pg error'), { code: pgCode, detail })
  return Object.assign(new Error(`Failed query`), { cause: pgError })
}

// Setup mocks before any imports
jest.mock('@/db/client', () => {
  const chainable: Record<string, jest.Mock> = {}
  const methods = ['insert', 'values', 'select', 'from', 'where', 'limit']
  for (const m of methods) {
    chainable[m] = jest.fn(() => chainable)
  }
  // Default: limit() returns user profile with auxiliar oposicion
  chainable.limit.mockResolvedValue([{ targetOposicion: 'auxiliar_administrativo_estado' }])
  return {
    getDb: jest.fn(() => chainable),
    __chainable: chainable,
  }
})

jest.mock('@/db/schema', () => ({
  testQuestions: { _: 'testQuestions_table' },
  userProfiles: { targetOposicion: 'target_oposicion', id: 'id' },
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((...args: unknown[]) => ({ _type: 'eq', args })),
}))

jest.mock('@/lib/config/oposiciones', () => ({
  ALL_OPOSICION_IDS: [
    'auxiliar_administrativo_estado',
    'administrativo_estado',
    'tramitacion_procesal',
    'auxilio_judicial',
  ],
}))

jest.mock('@/lib/api/tema-resolver/queries', () => ({
  resolveTemaNumber: jest.fn(),
}))

import { insertTestAnswer } from '@/lib/api/test-answers/queries'
import { resolveTemaNumber } from '@/lib/api/tema-resolver/queries'
import type { SaveAnswerRequest } from '@/lib/api/test-answers/schemas'

const { __chainable: chainable } = jest.requireMock('@/db/client') as {
  __chainable: Record<string, jest.Mock>
}
const mockedResolveTema = resolveTemaNumber as jest.MockedFunction<typeof resolveTemaNumber>

// ============================================
// FIXTURES
// ============================================

function makeRequest(overrides: Partial<SaveAnswerRequest> = {}): SaveAnswerRequest {
  return {
    sessionId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    questionData: {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      question: 'Cual es la capital?',
      options: ['Madrid', 'Barcelona', 'Sevilla', 'Valencia'],
      questionType: 'legislative',
    },
    answerData: {
      questionIndex: 0,
      selectedAnswer: 0,
      correctAnswer: 0,
      isCorrect: true,
      timeSpent: 15,
    },
    tema: 5,
    confidenceLevel: 'sure',
    interactionCount: 1,
    questionStartTime: 1000,
    firstInteractionTime: 3000,
    interactionEvents: [],
    mouseEvents: [],
    scrollEvents: [],
    ...overrides,
  }
}

const userId = 'user-uuid-1234'

// ============================================
// TESTS
// ============================================

describe('insertTestAnswer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    for (const fn of Object.values(chainable)) {
      fn.mockReturnValue(chainable)
    }
    // Default: insert succeeds
    chainable.values.mockResolvedValue(undefined)
    // Default: user profile query returns auxiliar
    chainable.limit.mockResolvedValue([{ targetOposicion: 'auxiliar_administrativo_estado' }])
    mockedResolveTema.mockResolvedValue(null)
  })

  // --- Insert exitoso ---

  it('debe retornar saved_new en insert exitoso', async () => {
    const result = await insertTestAnswer(makeRequest(), userId)
    expect(result.success).toBe(true)
    expect(result.action).toBe('saved_new')
  })

  it('debe incluir question_id en resultado', async () => {
    const result = await insertTestAnswer(makeRequest(), userId)
    expect(result.question_id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
  })

  it('debe llamar db.insert con testQuestions', async () => {
    await insertTestAnswer(makeRequest(), userId)
    expect(chainable.insert).toHaveBeenCalledWith({ _: 'testQuestions_table' })
  })

  it('debe mapear campos correctamente en values', async () => {
    const req = makeRequest()
    await insertTestAnswer(req, userId)

    expect(chainable.values).toHaveBeenCalledTimes(1)
    const insertedData = chainable.values.mock.calls[0][0]

    expect(insertedData.testId).toBe(req.sessionId)
    expect(insertedData.questionOrder).toBe(1)
    expect(insertedData.userAnswer).toBe('A')
    expect(insertedData.correctAnswer).toBe('A')
    expect(insertedData.isCorrect).toBe(true)
    expect(insertedData.confidenceLevel).toBe('sure')
    expect(insertedData.temaNumber).toBe(5)
    expect(insertedData.questionType).toBe('legislative')
  })

  // --- Constraint unico (duplicado) ---

  it('debe retornar already_saved para error 23505 directo', async () => {
    chainable.values.mockRejectedValueOnce({ code: '23505' })
    const result = await insertTestAnswer(makeRequest(), userId)
    expect(result.success).toBe(true)
    expect(result.action).toBe('already_saved')
  })

  it('debe retornar already_saved para error 23505 wrapeado por Drizzle (cause)', async () => {
    chainable.values.mockRejectedValueOnce(makeDrizzleError('23505', 'Key already exists'))
    const result = await insertTestAnswer(makeRequest(), userId)
    expect(result.success).toBe(true)
    expect(result.action).toBe('already_saved')
  })

  it('debe retornar error para otros codigos de error DB', async () => {
    chainable.values.mockRejectedValueOnce(makeDrizzleError('23503', 'FK violation'))
    const result = await insertTestAnswer(makeRequest(), userId)
    expect(result.success).toBe(false)
    expect(result.action).toBe('error')
  })

  it('debe retornar error para excepciones genericas', async () => {
    chainable.values.mockRejectedValueOnce(new Error('Connection lost'))
    const result = await insertTestAnswer(makeRequest(), userId)
    expect(result.success).toBe(false)
    expect(result.action).toBe('error')
    expect(result.error).toContain('Connection lost')
  })

  // --- Tema resolution ---

  it('debe llamar resolveTemaNumber cuando tema=0', async () => {
    const req = makeRequest({ tema: 0 })
    // questionData.tema is undefined by default, so calculated will be 0
    req.questionData.tema = 0
    await insertTestAnswer(req, userId)
    expect(mockedResolveTema).toHaveBeenCalled()
  })

  it('no debe llamar resolveTemaNumber cuando tema>0', async () => {
    await insertTestAnswer(makeRequest({ tema: 5 }), userId)
    expect(mockedResolveTema).not.toHaveBeenCalled()
  })

  it('debe usar tema resuelto si resolveTemaNumber lo devuelve', async () => {
    const req = makeRequest({ tema: 0 })
    req.questionData.tema = 0
    mockedResolveTema.mockResolvedValueOnce(7)

    await insertTestAnswer(req, userId)

    const insertedData = chainable.values.mock.calls[0][0]
    expect(insertedData.temaNumber).toBe(7)
  })

  it('debe degradar graciosamente si resolveTemaNumber lanza error', async () => {
    const req = makeRequest({ tema: 0 })
    req.questionData.tema = 0
    mockedResolveTema.mockRejectedValueOnce(new Error('Network'))

    const result = await insertTestAnswer(req, userId)
    expect(result.success).toBe(true)
    const insertedData = chainable.values.mock.calls[0][0]
    expect(insertedData.temaNumber).toBe(0)
  })

  // --- Data mapping ---

  it('debe mapear selectedAnswer -1 a letra incorrecta', async () => {
    const req = makeRequest()
    req.answerData.selectedAnswer = -1
    req.answerData.correctAnswer = 0 // A es correcta
    req.answerData.isCorrect = false

    await insertTestAnswer(req, userId)

    const insertedData = chainable.values.mock.calls[0][0]
    // (0+1) % 4 = 1 → B
    expect(insertedData.userAnswer).toBe('B')
  })

  it('debe mapear selectedAnswer 0-3 a A-D', async () => {
    for (let i = 0; i <= 3; i++) {
      jest.clearAllMocks()
      for (const fn of Object.values(chainable)) fn.mockReturnValue(chainable)
      chainable.values.mockResolvedValue(undefined)

      const req = makeRequest()
      req.answerData.selectedAnswer = i
      await insertTestAnswer(req, userId)

      const insertedData = chainable.values.mock.calls[0][0]
      expect(insertedData.userAnswer).toBe(String.fromCharCode(65 + i))
    }
  })

  it('debe usar psychometric_question_id para psychometric', async () => {
    const req = makeRequest()
    req.questionData.questionType = 'psychometric'

    await insertTestAnswer(req, userId)

    const insertedData = chainable.values.mock.calls[0][0]
    expect(insertedData.questionId).toBeNull()
    expect(insertedData.psychometricQuestionId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    expect(insertedData.questionType).toBe('psychometric')
  })

  it('debe mapear difficulty "auto" a "medium"', async () => {
    const req = makeRequest()
    req.questionData.metadata = { difficulty: 'auto' as any } // 'auto' ya no es válido en el schema, pero normalizeDifficulty lo maneja

    await insertTestAnswer(req, userId)

    const insertedData = chainable.values.mock.calls[0][0]
    expect(insertedData.difficulty).toBe('medium')
  })

  // --- JSONB fields ---

  it('debe construir fullQuestionContext correctamente', async () => {
    const req = makeRequest()
    await insertTestAnswer(req, userId)

    const insertedData = chainable.values.mock.calls[0][0]
    expect(insertedData.fullQuestionContext).toHaveProperty('options')
    expect(insertedData.fullQuestionContext).toHaveProperty('explanation')
    expect(insertedData.fullQuestionContext).toHaveProperty('generated_ids')
    expect(insertedData.fullQuestionContext.options).toEqual(req.questionData.options)
  })

  it('debe construir userBehaviorData correctamente', async () => {
    const req = makeRequest({ interactionCount: 3 })
    await insertTestAnswer(req, userId)

    const insertedData = chainable.values.mock.calls[0][0]
    expect(insertedData.userBehaviorData).toHaveProperty('interaction_events')
    expect(insertedData.userBehaviorData).toHaveProperty('mouse_activity')
    expect(insertedData.userBehaviorData.answer_changes).toBe(2) // 3-1
  })

  it('debe construir learningAnalytics correctamente', async () => {
    const req = makeRequest()
    req.answerData.isCorrect = true
    req.answerData.timeSpent = 20

    await insertTestAnswer(req, userId)

    const insertedData = chainable.values.mock.calls[0][0]
    expect(insertedData.learningAnalytics).toHaveProperty('response_pattern')
    expect(insertedData.learningAnalytics.response_pattern).toBe('correct')
    expect(insertedData.learningAnalytics.time_efficiency).toBe('fast')
  })

  // --- Resolución de oposición server-side ---

  it('debe consultar user_profiles cuando tema=0 y no hay req.oposicionId', async () => {
    const req = makeRequest({ tema: 0 })
    req.questionData.tema = 0
    // No tiene oposicionId en el request (como V2)

    await insertTestAnswer(req, userId)

    // Debe haber llamado select() para obtener el perfil
    expect(chainable.select).toHaveBeenCalled()
  })

  it('debe usar target_oposicion del usuario para resolver tema', async () => {
    const req = makeRequest({ tema: 0 })
    req.questionData.tema = 0
    // User profile devuelve administrativo_estado
    chainable.limit.mockResolvedValueOnce([{ targetOposicion: 'administrativo_estado' }])
    mockedResolveTema.mockResolvedValueOnce(601)

    await insertTestAnswer(req, userId)

    // resolveTemaNumber debe recibir 'administrativo_estado', NO auxiliar
    const lastArg = mockedResolveTema.mock.calls[0]?.[5]
    expect(lastArg).toBe('administrativo_estado')
    const insertedData = chainable.values.mock.calls[0][0]
    expect(insertedData.temaNumber).toBe(601)
  })

  it('debe usar req.oposicionId si el cliente lo envía (backward compat)', async () => {
    const req = makeRequest({ tema: 0, oposicionId: 'tramitacion_procesal' })
    req.questionData.tema = 0
    mockedResolveTema.mockResolvedValueOnce(13)

    await insertTestAnswer(req, userId)

    // resolveTemaNumber debe recibir 'tramitacion_procesal' del request
    const lastArg = mockedResolveTema.mock.calls[0]?.[5]
    expect(lastArg).toBe('tramitacion_procesal')
    const insertedData = chainable.values.mock.calls[0][0]
    expect(insertedData.temaNumber).toBe(13)
  })

  it('debe fallback a auxiliar si user_profiles no tiene target_oposicion', async () => {
    const req = makeRequest({ tema: 0 })
    req.questionData.tema = 0
    // User profile sin oposición
    chainable.limit.mockResolvedValueOnce([{ targetOposicion: null }])

    await insertTestAnswer(req, userId)

    const lastArg = mockedResolveTema.mock.calls[0]?.[5]
    expect(lastArg).toBe('auxiliar_administrativo_estado')
  })
})
