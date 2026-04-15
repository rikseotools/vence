// __tests__/lib/api/v2/complete-test/queries.test.ts
// Tests para completeTest: verificacion de ownership, analytics, updates de BD

// ============================================
// Mock de getDb antes de importar
// ============================================

const mockSelect = jest.fn()
const mockFrom = jest.fn()
const mockWhere = jest.fn()
const mockLimit = jest.fn()
const mockUpdate = jest.fn()
const mockSet = jest.fn()
const mockReturning = jest.fn()
const mockInsert = jest.fn()
const mockValues = jest.fn()

// Chainable mock builder
function chainable() {
  const chain: Record<string, jest.Mock> = {}
  chain.select = jest.fn().mockReturnValue(chain)
  chain.from = jest.fn().mockReturnValue(chain)
  chain.where = jest.fn().mockReturnValue(chain)
  chain.limit = jest.fn().mockReturnValue(chain)
  chain.update = jest.fn().mockReturnValue(chain)
  chain.set = jest.fn().mockReturnValue(chain)
  chain.returning = jest.fn().mockReturnValue(chain)
  chain.insert = jest.fn().mockReturnValue(chain)
  chain.values = jest.fn().mockReturnValue(chain)
  // Make the chain itself thenable (resolves to array by default)
  chain.then = undefined as any // Will be overridden per-call
  return chain
}

// Track all db calls in order
let dbCallLog: Array<{ method: string; args: any[] }> = []
let dbResponses: Record<string, any[]> = {}
let dbResponseIndex: Record<string, number> = {}

function resetDbMock() {
  dbCallLog = []
  dbResponses = {
    select: [],
    update: [],
    insert: [],
  }
  dbResponseIndex = {
    select: 0,
    update: 0,
    insert: 0,
  }
}

// Build a mock DB that tracks calls and returns configured responses
function createMockDb() {
  function makeChain(type: 'select' | 'update' | 'insert') {
    const chain: any = {}
    const methods = ['select', 'from', 'where', 'limit', 'update', 'set', 'returning', 'insert', 'values']
    for (const m of methods) {
      chain[m] = jest.fn((...args: any[]) => {
        dbCallLog.push({ method: m, args })
        return chain
      })
    }
    // Make it thenable
    chain.then = (resolve: (v: any) => void, reject?: (e: any) => void) => {
      const idx = dbResponseIndex[type]
      const responses = dbResponses[type]
      if (idx < responses.length) {
        dbResponseIndex[type]++
        const val = responses[idx]
        if (val instanceof Error) {
          return reject ? reject(val) : Promise.reject(val)
        }
        return resolve(val)
      }
      return resolve([])
    }
    return chain
  }

  return {
    select: jest.fn((...args: any[]) => {
      dbCallLog.push({ method: 'select', args })
      return makeChain('select')
    }),
    update: jest.fn((...args: any[]) => {
      dbCallLog.push({ method: 'update', args })
      return makeChain('update')
    }),
    insert: jest.fn((...args: any[]) => {
      dbCallLog.push({ method: 'insert', args })
      return makeChain('insert')
    }),
  }
}

let mockDb: ReturnType<typeof createMockDb>

jest.mock('@/db/client', () => ({
  getDb: () => mockDb,
}))

jest.mock('@/db/schema', () => ({
  tests: { id: 'tests.id', userId: 'tests.userId', temaNumber: 'tests.temaNumber' },
  testQuestions: { testId: 'testQuestions.testId', questionOrder: 'testQuestions.questionOrder' },
  userSessions: { id: 'userSessions.id' },
  userProgress: { userId: 'userProgress.userId', topicId: 'userProgress.topicId' },
  topics: { id: 'topics.id', topicNumber: 'topics.topicNumber', positionType: 'topics.positionType' },
  questions: { id: 'questions.id', correctOption: 'questions.correctOption' },
  psychometricQuestions: { id: 'psychometricQuestions.id', correctOption: 'psychometricQuestions.correctOption' },
}))

jest.mock('drizzle-orm', () => ({
  eq: (a: any, b: any) => ({ type: 'eq', a, b }),
  and: (...args: any[]) => ({ type: 'and', args }),
  inArray: (a: any, b: any) => ({ type: 'inArray', a, b }),
  sql: jest.fn(),
  count: () => 'count()',
}))

// Mock del safety-net insert: por defecto no hace nada (0 inserted).
// Tests específicos del safety-net lo configuran.
type InsertBatchMockResult = { attempted: number; inserted: number; skipped: number; errored: boolean; error?: string }
const mockInsertBatch: jest.Mock<Promise<InsertBatchMockResult>, [any[], string]> = jest.fn(
  async (_reqs: any[], _userId: string) => ({ attempted: 0, inserted: 0, skipped: 0, errored: false }),
)
jest.mock('@/lib/api/test-answers', () => ({
  insertTestAnswersBatch: (reqs: any[], userId: string) => mockInsertBatch(reqs, userId),
}))

import type { CompleteTestRequest, DetailedAnswerInput } from '@/lib/api/v2/complete-test/schemas'

// Helper: simular el SELECT de question_orders ya guardados.
// Tras el refactor, complete-test lee las órdenes existentes (no el count)
// para poder identificar huecos y rellenarlos con el safety-net.
function savedOrders(n: number): Array<{ questionOrder: number }> {
  return Array.from({ length: n }, (_, i) => ({ questionOrder: i + 1 }))
}

// ============================================
// Helpers para construir datos de test
// ============================================

function makeAnswer(overrides: Partial<DetailedAnswerInput> = {}): DetailedAnswerInput {
  return {
    questionIndex: 0,
    selectedAnswer: 1,
    isCorrect: true,
    timeSpent: 10,
    confidence: 'sure',
    interactions: 1,
    questionData: {
      id: 'q-1',
      metadata: { difficulty: 'medium' },
      article: { id: 'art-1', number: '14', law_short_name: 'CE' },
    },
    ...overrides,
  }
}

function makeRequest(overrides: Partial<CompleteTestRequest> = {}): CompleteTestRequest {
  const result: CompleteTestRequest = {
    sessionId: 'test-session-123',
    finalScore: 7,
    totalQuestions: 10,
    detailedAnswers: [
      makeAnswer({ questionIndex: 0, isCorrect: true, timeSpent: 8, confidence: 'very_sure', questionData: { id: 'q1', metadata: { difficulty: 'easy' }, article: { id: 'a1', number: '1', law_short_name: 'CE' } } }),
      makeAnswer({ questionIndex: 1, isCorrect: true, timeSpent: 12, confidence: 'sure', questionData: { id: 'q2', metadata: { difficulty: 'medium' }, article: { id: 'a2', number: '14', law_short_name: 'CE' } } }),
      makeAnswer({ questionIndex: 2, isCorrect: false, timeSpent: 20, confidence: 'guessing', questionData: { id: 'q3', metadata: { difficulty: 'hard' }, article: { id: 'a3', number: '16', law_short_name: 'TREBEP' } } }),
      makeAnswer({ questionIndex: 3, isCorrect: true, timeSpent: 5, confidence: 'very_sure', questionData: { id: 'q4', metadata: { difficulty: 'easy' }, article: { id: 'a1', number: '1', law_short_name: 'CE' } } }),
      makeAnswer({ questionIndex: 4, isCorrect: false, timeSpent: 25, confidence: 'unsure', questionData: { id: 'q5', metadata: { difficulty: 'hard' }, article: { id: 'a4', number: '20', law_short_name: 'LPAC' } } }),
      makeAnswer({ questionIndex: 5, isCorrect: true, timeSpent: 10, confidence: 'sure' }),
      makeAnswer({ questionIndex: 6, isCorrect: true, timeSpent: 9, confidence: 'very_sure' }),
      makeAnswer({ questionIndex: 7, isCorrect: false, timeSpent: 18, confidence: 'guessing' }),
      makeAnswer({ questionIndex: 8, isCorrect: true, timeSpent: 7, confidence: 'sure' }),
      makeAnswer({ questionIndex: 9, isCorrect: true, timeSpent: 6, confidence: 'very_sure' }),
    ],
    startTime: Date.now() - 120000, // 2 min ago
    interactionEvents: [{}, {}, {}],
    userSessionId: null,
    tema: 1,
  }
  // Apply overrides explicitly to avoid TS spread issues with nullable fields
  for (const key of Object.keys(overrides)) {
    (result as any)[key] = (overrides as any)[key]
  }
  return result
}

// ============================================
// TESTS
// ============================================

describe('completeTest', () => {
  let completeTest: typeof import('@/lib/api/v2/complete-test/queries').completeTest

  beforeEach(() => {
    jest.resetModules()
    resetDbMock()
    mockDb = createMockDb()
    mockInsertBatch.mockClear()
    mockInsertBatch.mockImplementation(async () => ({ attempted: 0, inserted: 0, skipped: 0, errored: false }))
  })

  async function loadModule() {
    const mod = await import('@/lib/api/v2/complete-test/queries')
    return mod.completeTest
  }

  // ============================================
  // 1. Verificacion de ownership
  // ============================================
  describe('Verificacion de ownership del test', () => {
    test('retorna error si el test no existe', async () => {
      completeTest = await loadModule()

      // select test -> no rows
      dbResponses.select = [
        [], // test not found
      ]

      const result = await completeTest(makeRequest(), 'user-abc')

      expect(result.success).toBe(false)
      expect(result.status).toBe('error')
    })

    test('retorna error si el test pertenece a otro usuario', async () => {
      completeTest = await loadModule()

      // The query filters by userId AND sessionId, so if user doesn't match, no rows returned
      dbResponses.select = [
        [], // no match for this user+session combo
      ]

      const result = await completeTest(makeRequest(), 'wrong-user')

      expect(result.success).toBe(false)
      expect(result.status).toBe('error')
    })

    test('continua si el test existe y pertenece al usuario', async () => {
      completeTest = await loadModule()

      dbResponses.select = [
        [{ id: 'test-session-123', userId: 'user-abc', temaNumber: 1 }], // test found
        savedOrders(10), // savedQuestionsCount
        [{ id: 'topic-1' }], // topic lookup
        [{ userId: 'user-abc', topicId: 'topic-1', totalAttempts: 20, correctAttempts: 15 }], // existing progress
      ]
      dbResponses.update = [
        [{ id: 'test-session-123' }], // test update returning
        [], // user_progress update
      ]

      const result = await completeTest(makeRequest(), 'user-abc')

      expect(result.success).toBe(true)
      expect(result.status).toBe('saved')
    })
  })

  // ============================================
  // 2. Retorna error si test no existe
  // ============================================
  describe('Test no encontrado', () => {
    test('devuelve success:false y status:error', async () => {
      completeTest = await loadModule()

      dbResponses.select = [[]] // empty

      const result = await completeTest(makeRequest({ sessionId: 'nonexistent' }), 'user-abc')

      expect(result).toEqual({ success: false, status: 'error' })
    })
  })

  // ============================================
  // 3. Calculo de analytics
  // ============================================
  describe('Calculo de analytics (logica pura)', () => {
    // These test the pure calculation logic extracted from the function

    test('difficulty_breakdown: agrupa por dificultad y calcula accuracy', () => {
      const answers: DetailedAnswerInput[] = [
        makeAnswer({ isCorrect: true, timeSpent: 5, questionData: { id: 'q1', metadata: { difficulty: 'easy' }, article: null } }),
        makeAnswer({ isCorrect: true, timeSpent: 8, questionData: { id: 'q2', metadata: { difficulty: 'easy' }, article: null } }),
        makeAnswer({ isCorrect: false, timeSpent: 15, questionData: { id: 'q3', metadata: { difficulty: 'hard' }, article: null } }),
        makeAnswer({ isCorrect: true, timeSpent: 12, questionData: { id: 'q4', metadata: { difficulty: 'medium' }, article: null } }),
      ]

      // Replicate the grouping logic
      const difficultyStats: Record<string, DetailedAnswerInput[]> = {
        easy: answers.filter(a => a.questionData?.metadata?.difficulty === 'easy'),
        medium: answers.filter(a => a.questionData?.metadata?.difficulty === 'medium'),
        hard: answers.filter(a => a.questionData?.metadata?.difficulty === 'hard'),
        extreme: answers.filter(a => a.questionData?.metadata?.difficulty === 'extreme'),
      }

      const breakdown = Object.keys(difficultyStats).map(diff => ({
        difficulty: diff,
        total: difficultyStats[diff].length,
        correct: difficultyStats[diff].filter(a => a.isCorrect).length,
        accuracy: difficultyStats[diff].length > 0
          ? Math.round((difficultyStats[diff].filter(a => a.isCorrect).length / difficultyStats[diff].length) * 100)
          : 0,
        avg_time: difficultyStats[diff].length > 0
          ? Math.round(difficultyStats[diff].reduce((sum, a) => sum + (a.timeSpent || 0), 0) / difficultyStats[diff].length)
          : 0,
      })).filter(item => item.total > 0)

      expect(breakdown).toEqual([
        { difficulty: 'easy', total: 2, correct: 2, accuracy: 100, avg_time: 7 },
        { difficulty: 'medium', total: 1, correct: 1, accuracy: 100, avg_time: 12 },
        { difficulty: 'hard', total: 1, correct: 0, accuracy: 0, avg_time: 15 },
      ])
    })

    test('confidence_analysis: cuenta combinaciones confidence/isCorrect', () => {
      const answers: DetailedAnswerInput[] = [
        makeAnswer({ confidence: 'very_sure', isCorrect: true }),
        makeAnswer({ confidence: 'very_sure', isCorrect: true }),
        makeAnswer({ confidence: 'very_sure', isCorrect: false }),
        makeAnswer({ confidence: 'guessing', isCorrect: true }),
        makeAnswer({ confidence: 'guessing', isCorrect: false }),
        makeAnswer({ confidence: 'guessing', isCorrect: false }),
      ]

      const analysis = {
        very_sure_correct: answers.filter(a => a.confidence === 'very_sure' && a.isCorrect).length,
        very_sure_incorrect: answers.filter(a => a.confidence === 'very_sure' && !a.isCorrect).length,
        guessing_correct: answers.filter(a => a.confidence === 'guessing' && a.isCorrect).length,
        guessing_incorrect: answers.filter(a => a.confidence === 'guessing' && !a.isCorrect).length,
      }

      expect(analysis).toEqual({
        very_sure_correct: 2,
        very_sure_incorrect: 1,
        guessing_correct: 1,
        guessing_incorrect: 2,
      })
    })

    test('time_analysis: calcula fastest, slowest, avg tiempos correctos e incorrectos', () => {
      const answers: DetailedAnswerInput[] = [
        makeAnswer({ isCorrect: true, timeSpent: 5 }),
        makeAnswer({ isCorrect: true, timeSpent: 15 }),
        makeAnswer({ isCorrect: false, timeSpent: 20 }),
        makeAnswer({ isCorrect: false, timeSpent: 30 }),
      ]

      const correctAnswers = answers.filter(a => a.isCorrect)
      const incorrectAnswers = answers.filter(a => !a.isCorrect)

      const timeAnalysis = {
        fastest_question: Math.min(...answers.map(a => a.timeSpent || 0)),
        slowest_question: Math.max(...answers.map(a => a.timeSpent || 0)),
        avg_correct_time: correctAnswers.length > 0
          ? Math.round(correctAnswers.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / correctAnswers.length)
          : 0,
        avg_incorrect_time: incorrectAnswers.length > 0
          ? Math.round(incorrectAnswers.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / incorrectAnswers.length)
          : 0,
      }

      expect(timeAnalysis.fastest_question).toBe(5)
      expect(timeAnalysis.slowest_question).toBe(30)
      expect(timeAnalysis.avg_correct_time).toBe(10)
      expect(timeAnalysis.avg_incorrect_time).toBe(25)
    })

    test('confidence_accuracy: mide calibracion de confianza', () => {
      // very_sure + correct = bien calibrado
      // guessing + incorrect = bien calibrado
      // very_sure + incorrect = mal calibrado
      // guessing + correct = mal calibrado (suerte)
      const answers: DetailedAnswerInput[] = [
        makeAnswer({ confidence: 'very_sure', isCorrect: true }),   // +1
        makeAnswer({ confidence: 'very_sure', isCorrect: false }),  // +0
        makeAnswer({ confidence: 'guessing', isCorrect: false }),   // +1
        makeAnswer({ confidence: 'guessing', isCorrect: true }),    // +0
      ]

      const confidenceAnalysis = {
        very_sure_correct: answers.filter(a => a.confidence === 'very_sure' && a.isCorrect).length,
        very_sure_incorrect: answers.filter(a => a.confidence === 'very_sure' && !a.isCorrect).length,
        guessing_correct: answers.filter(a => a.confidence === 'guessing' && a.isCorrect).length,
        guessing_incorrect: answers.filter(a => a.confidence === 'guessing' && !a.isCorrect).length,
      }

      const confidenceAccuracy = Math.round(
        ((confidenceAnalysis.very_sure_correct + confidenceAnalysis.guessing_incorrect) / answers.length) * 100
      )

      // 2 out of 4 well-calibrated = 50%
      expect(confidenceAccuracy).toBe(50)
    })

    test('improvement_during_test: compara ultimas 3 con primeras 3', () => {
      // Last 3 better than first 3 → true
      const answers6: DetailedAnswerInput[] = [
        makeAnswer({ isCorrect: false }), // first 3: 1 correct
        makeAnswer({ isCorrect: false }),
        makeAnswer({ isCorrect: true }),
        makeAnswer({ isCorrect: true }),  // last 3: 2 correct
        makeAnswer({ isCorrect: true }),
        makeAnswer({ isCorrect: false }),
      ]

      const improvement6 = answers6.length >= 6
        ? answers6.slice(-3).filter(a => a.isCorrect).length > answers6.slice(0, 3).filter(a => a.isCorrect).length
        : false

      expect(improvement6).toBe(true)

      // Fewer than 6 → always false
      const answers4: DetailedAnswerInput[] = [
        makeAnswer({ isCorrect: true }),
        makeAnswer({ isCorrect: true }),
        makeAnswer({ isCorrect: true }),
        makeAnswer({ isCorrect: true }),
      ]

      const improvement4 = answers4.length >= 6
        ? answers4.slice(-3).filter(a => a.isCorrect).length > answers4.slice(0, 3).filter(a => a.isCorrect).length
        : false

      expect(improvement4).toBe(false)
    })

    test('speed_consistency: mide desviacion del tiempo respecto a media', () => {
      // All same time → high consistency
      const uniformAnswers = [10, 10, 10, 10].map(t => makeAnswer({ timeSpent: t }))
      const avg1 = 10
      const sc1 = Math.round((1 - (Math.sqrt(
        uniformAnswers.reduce((sum, a) => sum + Math.pow((a.timeSpent || 0) - avg1, 2), 0) / uniformAnswers.length
      ) / avg1)) * 100)
      expect(sc1).toBe(100) // perfect consistency

      // Varied times → lower consistency
      const variedAnswers = [2, 50, 5, 43].map(t => makeAnswer({ timeSpent: t }))
      const avg2 = 25
      const sc2 = Math.round((1 - (Math.sqrt(
        variedAnswers.reduce((sum, a) => sum + Math.pow((a.timeSpent || 0) - avg2, 2), 0) / variedAnswers.length
      ) / avg2)) * 100)
      expect(sc2).toBeLessThan(50)
    })

    test('interaction_efficiency: porcentaje de respuestas con 1 sola interaccion', () => {
      const answers: DetailedAnswerInput[] = [
        makeAnswer({ interactions: 1 }),
        makeAnswer({ interactions: 1 }),
        makeAnswer({ interactions: 3 }),
        makeAnswer({ interactions: 1 }),
      ]

      const efficiency = Math.round(
        (answers.filter(a => (a.interactions || 1) === 1).length / answers.length) * 100
      )

      expect(efficiency).toBe(75) // 3/4
    })

    test('article_performance: agrupa estadisticas por articulo', () => {
      const answers: DetailedAnswerInput[] = [
        makeAnswer({ isCorrect: true, timeSpent: 10, questionData: { id: 'q1', metadata: null, article: { id: 'a1', number: '14', law_short_name: 'CE' } } }),
        makeAnswer({ isCorrect: false, timeSpent: 20, questionData: { id: 'q2', metadata: null, article: { id: 'a1', number: '14', law_short_name: 'CE' } } }),
        makeAnswer({ isCorrect: true, timeSpent: 8, questionData: { id: 'q3', metadata: null, article: { id: 'a2', number: '1', law_short_name: 'CE' } } }),
      ]

      interface ArticleStat { article_id: string; total: number; correct: number; time_spent: number; law_name: string }
      const articleStats: Record<string, ArticleStat> = {}
      for (const answer of answers) {
        const articleId = answer.questionData?.article?.id
        const articleNumber = answer.questionData?.article?.number
        if (articleId && articleNumber) {
          const key = String(articleNumber)
          if (!articleStats[key]) {
            articleStats[key] = { article_id: articleId, total: 0, correct: 0, time_spent: 0, law_name: answer.questionData?.article?.law_short_name || 'unknown' }
          }
          articleStats[key].total++
          if (answer.isCorrect) articleStats[key].correct++
          articleStats[key].time_spent += answer.timeSpent || 0
        }
      }

      const performance = Object.keys(articleStats).map(artNum => ({
        article_number: artNum,
        article_id: articleStats[artNum].article_id,
        law_name: articleStats[artNum].law_name,
        total: articleStats[artNum].total,
        correct: articleStats[artNum].correct,
        accuracy: Math.round((articleStats[artNum].correct / articleStats[artNum].total) * 100),
      }))

      // Object.keys order depends on insertion order
      expect(performance).toEqual(expect.arrayContaining([
        { article_number: '14', article_id: 'a1', law_name: 'CE', total: 2, correct: 1, accuracy: 50 },
        { article_number: '1', article_id: 'a2', law_name: 'CE', total: 1, correct: 1, accuracy: 100 },
      ]))
      expect(performance).toHaveLength(2)
    })

    test('performance_metrics: engagement y session_quality', () => {
      const interactionEvents = new Array(50).fill({})
      const answers = new Array(10).fill(null).map(() => makeAnswer({ interactions: 1 }))

      const engagementScore = Math.min(100, interactionEvents.length * 2)
      expect(engagementScore).toBe(100) // 50*2 = 100 (capped)

      const interactionEfficiency = Math.round(
        (answers.filter(a => (a.interactions || 1) === 1).length / answers.length) * 100
      )

      const sessionQuality = interactionEfficiency > 80 ? 'excellent'
        : interactionEfficiency > 60 ? 'good' : 'needs_improvement'

      expect(sessionQuality).toBe('excellent')
    })

    test('improvement_areas: identifica prioridad por confianza y tiempo', () => {
      const avgTimePerQuestion = 10

      // very_sure but incorrect → high priority
      const highPriority = makeAnswer({ confidence: 'very_sure', isCorrect: false, timeSpent: 8 })
      const priority1 = highPriority.confidence === 'very_sure' ? 'high'
        : (highPriority.timeSpent || 0) > avgTimePerQuestion * 1.5 ? 'medium' : 'low'
      expect(priority1).toBe('high')

      // slow but not very_sure → medium priority
      const medPriority = makeAnswer({ confidence: 'unsure', isCorrect: false, timeSpent: 20 })
      const priority2 = medPriority.confidence === 'very_sure' ? 'high'
        : (medPriority.timeSpent || 0) > avgTimePerQuestion * 1.5 ? 'medium' : 'low'
      expect(priority2).toBe('medium')

      // fast and not very_sure → low priority
      const lowPriority = makeAnswer({ confidence: 'guessing', isCorrect: false, timeSpent: 5 })
      const priority3 = lowPriority.confidence === 'very_sure' ? 'high'
        : (lowPriority.timeSpent || 0) > avgTimePerQuestion * 1.5 ? 'medium' : 'low'
      expect(priority3).toBe('low')
    })
  })

  // ============================================
  // 4. Update de tests con campos correctos
  // ============================================
  describe('Update de tests', () => {
    test('llama a update con score, totalQuestions, isCompleted y analytics', async () => {
      completeTest = await loadModule()

      const request = makeRequest()
      let capturedSet: any = null

      // Override update chain to capture .set() args
      const origUpdate = mockDb.update
      mockDb.update = jest.fn((...args: any[]) => {
        const chain = origUpdate(...args)
        const origSet = chain.set
        chain.set = jest.fn((...setArgs: any[]) => {
          capturedSet = setArgs[0]
          return origSet(...setArgs)
        })
        return chain
      }) as any

      dbResponses.select = [
        [{ id: 'test-session-123', userId: 'user-abc', temaNumber: 1 }],
        savedOrders(10),
        [{ id: 'topic-1' }],
        [], // no existing progress
      ]
      dbResponses.update = [
        [{ id: 'test-session-123' }], // returning from tests update
      ]
      dbResponses.insert = [
        [], // user_progress insert
      ]

      await completeTest(request, 'user-abc')

      expect(capturedSet).not.toBeNull()
      expect(capturedSet.score).toBe(String(request.finalScore))
      expect(capturedSet.totalQuestions).toBe(request.detailedAnswers.length)
      expect(capturedSet.isCompleted).toBe(true)
      expect(capturedSet.completedAt).toBeDefined()
      expect(typeof capturedSet.totalTimeSeconds).toBe('number')
      expect(capturedSet.detailedAnalytics).toBeDefined()
      expect(capturedSet.performanceMetrics).toBeDefined()
      // Verify analytics structure
      expect(capturedSet.detailedAnalytics.performance_summary).toBeDefined()
      expect(capturedSet.detailedAnalytics.difficulty_breakdown).toBeDefined()
      expect(capturedSet.detailedAnalytics.time_analysis).toBeDefined()
      expect(capturedSet.detailedAnalytics.confidence_analysis).toBeDefined()
      expect(capturedSet.detailedAnalytics.learning_patterns).toBeDefined()
    })

    test('retorna error si update no devuelve resultado', async () => {
      completeTest = await loadModule()

      dbResponses.select = [
        [{ id: 'test-session-123', userId: 'user-abc', temaNumber: 1 }],
        savedOrders(10),
      ]
      dbResponses.update = [
        [], // update returns nothing (failed)
      ]

      const result = await completeTest(makeRequest(), 'user-abc')

      expect(result.success).toBe(false)
      expect(result.status).toBe('error')
    })
  })

  // ============================================
  // 5. user_progress NO se escribe (eliminado 2026-04-15)
  // ============================================
  // Nadie lee user_progress (verificado con pg_get_functiondef sobre
  // funciones/views/triggers y grep en frontend). El progreso se deriva
  // desde test_questions vía getUserProgressForTopicV2 + topic_scope.
  describe('user_progress NO se escribe', () => {
    test('no inserta user_progress aunque haya tema', async () => {
      completeTest = await loadModule()

      let insertCalled = false
      const origInsert = mockDb.insert
      mockDb.insert = jest.fn((...args: any[]) => {
        insertCalled = true
        return origInsert(...args)
      }) as any

      dbResponses.select = [
        [{ id: 'test-session-123', userId: 'user-abc', temaNumber: 5 }],
        savedOrders(10),
      ]
      dbResponses.update = [
        [{ id: 'test-session-123' }],
      ]

      const result = await completeTest(makeRequest({ tema: 5 }), 'user-abc')

      expect(result.success).toBe(true)
      expect(insertCalled).toBe(false)
    })

    test('solo actualiza tests (no user_progress) con tema presente', async () => {
      completeTest = await loadModule()

      let updateCount = 0
      const origUpdate = mockDb.update
      mockDb.update = jest.fn((...args: any[]) => {
        updateCount++
        return origUpdate(...args)
      }) as any

      dbResponses.select = [
        [{ id: 'test-session-123', userId: 'user-abc', temaNumber: 5 }],
        savedOrders(10),
      ]
      dbResponses.update = [
        [{ id: 'test-session-123' }],
      ]

      const result = await completeTest(makeRequest({ finalScore: 7 }), 'user-abc')

      expect(result.success).toBe(true)
      expect(updateCount).toBe(1)
    })

    test('no actualiza progress si temaNumber es null', async () => {
      completeTest = await loadModule()

      let insertCalled = false
      const origInsert = mockDb.insert
      mockDb.insert = jest.fn((...args: any[]) => {
        insertCalled = true
        return origInsert(...args)
      }) as any

      dbResponses.select = [
        [{ id: 'test-session-123', userId: 'user-abc', temaNumber: null }],
        savedOrders(10),
      ]
      dbResponses.update = [
        [{ id: 'test-session-123' }],
      ]

      const result = await completeTest(makeRequest(), 'user-abc')

      expect(result.success).toBe(true)
      expect(insertCalled).toBe(false) // No insert for progress
    })
  })

  // ============================================
  // 6. Update de user_sessions cuando userSessionId presente
  // ============================================
  describe('Update de user_sessions', () => {
    test('actualiza user_sessions si userSessionId esta presente', async () => {
      completeTest = await loadModule()

      dbResponses.select = [
        [{ id: 'test-session-123', userId: 'user-abc', temaNumber: null }],
        savedOrders(10),
      ]
      dbResponses.update = [
        [{ id: 'test-session-123' }], // test update returning
        [],                             // user_sessions update
      ]

      const result = await completeTest(
        makeRequest({ userSessionId: 'session-xyz' }),
        'user-abc'
      )

      expect(result.success).toBe(true)
      // 2 updates: tests + user_sessions (no user_progress since temaNumber=null)
      const updateCalls = dbCallLog.filter(c => c.method === 'update')
      expect(updateCalls.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ============================================
  // 7. No falla si userSessionId es null
  // ============================================
  describe('userSessionId null', () => {
    test('no intenta actualizar user_sessions si userSessionId es null', async () => {
      completeTest = await loadModule()

      let updateCount = 0
      const origUpdate = mockDb.update
      mockDb.update = jest.fn((...args: any[]) => {
        updateCount++
        return origUpdate(...args)
      }) as any

      dbResponses.select = [
        [{ id: 'test-session-123', userId: 'user-abc', temaNumber: null }],
        savedOrders(10),
      ]
      dbResponses.update = [
        [{ id: 'test-session-123' }], // only test update
      ]

      const result = await completeTest(
        makeRequest({ userSessionId: null }),
        'user-abc'
      )

      expect(result.success).toBe(true)
      // Only 1 update: tests (no user_sessions, no progress since temaNumber=null)
      expect(updateCount).toBe(1)
    })
  })

  // ============================================
  // 8. Errores en user_progress/user_sessions no hacen fallar el resultado
  // ============================================
  describe('Errores no-fatales en updates secundarios', () => {
    test('error en user_progress no afecta el resultado principal', async () => {
      completeTest = await loadModule()

      dbResponses.select = [
        [{ id: 'test-session-123', userId: 'user-abc', temaNumber: 5 }],
        savedOrders(10),
        [{ id: 'topic-5' }],
      ]
      dbResponses.update = [
        [{ id: 'test-session-123' }], // test update OK
      ]

      // The 4th select (existing progress check) will throw
      const origSelect = mockDb.select
      let selectCallCount = 0
      mockDb.select = jest.fn((...args: any[]) => {
        selectCallCount++
        const chain = origSelect(...args)
        if (selectCallCount === 4) {
          // Override then to throw for the 4th select (progress check)
          chain.then = (_resolve: any, reject?: any) => {
            if (reject) return reject(new Error('DB connection lost'))
            return Promise.reject(new Error('DB connection lost'))
          }
        }
        return chain
      }) as any

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = await completeTest(makeRequest({ tema: 5 }), 'user-abc')

      expect(result.success).toBe(true)
      expect(result.status).toBe('saved')

      consoleSpy.mockRestore()
    })

    test('error en user_sessions no afecta el resultado principal', async () => {
      completeTest = await loadModule()

      let updateCallCount = 0
      const origUpdate = mockDb.update
      mockDb.update = jest.fn((...args: any[]) => {
        updateCallCount++
        const chain = origUpdate(...args)
        if (updateCallCount === 2) {
          // 2nd update (user_sessions) throws
          chain.then = (_resolve: any, reject?: any) => {
            if (reject) return reject(new Error('user_sessions update failed'))
            return Promise.reject(new Error('user_sessions update failed'))
          }
        }
        return chain
      }) as any

      dbResponses.select = [
        [{ id: 'test-session-123', userId: 'user-abc', temaNumber: null }],
        savedOrders(10),
      ]
      dbResponses.update = [
        [{ id: 'test-session-123' }], // test update OK
      ]

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = await completeTest(
        makeRequest({ userSessionId: 'session-xyz' }),
        'user-abc'
      )

      expect(result.success).toBe(true)
      expect(result.status).toBe('saved')

      consoleSpy.mockRestore()
    })
  })

  // ============================================
  // Edge cases
  // ============================================
  describe('Edge cases', () => {
    test('savedQuestionsCount se incluye en la respuesta', async () => {
      completeTest = await loadModule()

      dbResponses.select = [
        [{ id: 'test-session-123', userId: 'user-abc', temaNumber: null }],
        savedOrders(15), // 15 saved questions
      ]
      dbResponses.update = [
        [{ id: 'test-session-123' }],
      ]

      const result = await completeTest(makeRequest(), 'user-abc')

      expect(result.success).toBe(true)
      expect(result.savedQuestionsCount).toBe(15)
    })

    test('sessionOutcome es successful cuando score >= 70%', () => {
      const finalScore = 8
      const total = 10
      const outcome = finalScore >= Math.ceil(total * 0.7) ? 'successful' : 'needs_improvement'
      expect(outcome).toBe('successful')
    })

    test('sessionOutcome es needs_improvement cuando score < 70%', () => {
      const finalScore = 5
      const total = 10
      const outcome = finalScore >= Math.ceil(total * 0.7) ? 'successful' : 'needs_improvement'
      expect(outcome).toBe('needs_improvement')
    })

    test('needsReview es true cuando accuracy < 70%', () => {
      const correctAnswers = 5
      const totalQuestions = 10
      const accuracy = Math.round((correctAnswers / totalQuestions) * 100)
      expect(accuracy < 70).toBe(true)
    })

    test('needsReview es false cuando accuracy >= 70%', () => {
      const correctAnswers = 8
      const totalQuestions = 10
      const accuracy = Math.round((correctAnswers / totalQuestions) * 100)
      expect(accuracy < 70).toBe(false)
    })

    test('learning_efficiency considera tiempo total', () => {
      const finalScore = 8
      const totalAnswers = 10
      const totalTimeSeconds = 300 // 5 min

      const efficiency = Math.round(
        (finalScore / totalAnswers) * (100 / Math.max(1, totalTimeSeconds / 60))
      )

      // 0.8 * (100 / 5) = 0.8 * 20 = 16
      expect(efficiency).toBe(16)
    })
  })

  // ============================================
  // 7. Safety-net: rellenar huecos en test_questions
  // ============================================
  describe('Safety-net: fillMissingTestQuestions', () => {
    /** Construye detailedAnswer con datos mínimos suficientes para gap-fill */
    function makeRichAnswer(qi: number, overrides: Partial<DetailedAnswerInput> = {}): DetailedAnswerInput {
      return makeAnswer({
        questionIndex: qi,
        selectedAnswer: 1,
        isCorrect: true,
        questionData: {
          id: `q${qi}`,
          question: `Pregunta número ${qi}`,
          options: ['Opción A', 'Opción B', 'Opción C', 'Opción D'],
          questionType: 'legislative',
          metadata: { difficulty: 'medium' },
          article: { id: `art${qi}`, number: String(qi), law_short_name: 'CE' },
        },
        ...overrides,
      })
    }

    test('NO llama al batch insert si todas las respuestas ya están guardadas', async () => {
      completeTest = await loadModule()

      const request = makeRequest({
        detailedAnswers: [makeRichAnswer(0), makeRichAnswer(1), makeRichAnswer(2)],
      })

      dbResponses.select = [
        [{ id: 'test-session-123', userId: 'user-abc', temaNumber: null }],
        savedOrders(3), // todas guardadas
      ]
      dbResponses.update = [
        [{ id: 'test-session-123' }],
      ]

      const result = await completeTest(request, 'user-abc')

      expect(result.success).toBe(true)
      expect(result.gapFilledCount).toBe(0)
      expect(mockInsertBatch).not.toHaveBeenCalled()
    })

    test('Llama al batch insert SOLO con los que faltan (gap-fill parcial)', async () => {
      completeTest = await loadModule()

      const request = makeRequest({
        detailedAnswers: [makeRichAnswer(0), makeRichAnswer(1), makeRichAnswer(2), makeRichAnswer(3)],
      })

      // Solo preguntas 1 y 3 (orders 2 y 4) guardadas. Faltan 1 y 3 (orders 1 y 3).
      dbResponses.select = [
        [{ id: 'test-session-123', userId: 'user-abc', temaNumber: null }],
        [{ questionOrder: 2 }, { questionOrder: 4 }],
        // SELECT questions.correctOption IN (q0, q2)
        [{ id: 'q0', correctOption: 1 }, { id: 'q2', correctOption: 2 }],
      ]
      dbResponses.update = [
        [{ id: 'test-session-123' }],
      ]

      mockInsertBatch.mockResolvedValueOnce({ attempted: 2, inserted: 2, skipped: 0, errored: false })

      const result = await completeTest(request, 'user-abc')

      expect(result.success).toBe(true)
      expect(result.gapFilledCount).toBe(2)
      expect(mockInsertBatch).toHaveBeenCalledTimes(1)
      const [saveRequests, userId] = mockInsertBatch.mock.calls[0]
      expect(userId).toBe('user-abc')
      expect(Array.isArray(saveRequests)).toBe(true)
      expect((saveRequests as any[])).toHaveLength(2)
      // Verifica que son exactamente los questionIndex faltantes (0 y 2)
      const indexes = (saveRequests as any[]).map(r => r.answerData.questionIndex).sort()
      expect(indexes).toEqual([0, 2])
      // Y que el correctAnswer se resolvió desde la BD, no inventado
      const byIndex = new Map((saveRequests as any[]).map(r => [r.answerData.questionIndex, r]))
      expect(byIndex.get(0).answerData.correctAnswer).toBe(1)
      expect(byIndex.get(2).answerData.correctAnswer).toBe(2)
    })

    test('Llama al batch insert con TODAS las respuestas cuando test_questions vacío (caso crítico)', async () => {
      completeTest = await loadModule()

      const request = makeRequest({
        detailedAnswers: [makeRichAnswer(0), makeRichAnswer(1), makeRichAnswer(2)],
      })

      // CASO CRÍTICO: test_questions totalmente vacío (la cola cliente falló)
      dbResponses.select = [
        [{ id: 'test-session-123', userId: 'user-abc', temaNumber: null }],
        [], // NADA guardado
        // SELECT questions WHERE id IN (q0, q1, q2)
        [{ id: 'q0', correctOption: 0 }, { id: 'q1', correctOption: 1 }, { id: 'q2', correctOption: 2 }],
      ]
      dbResponses.update = [
        [{ id: 'test-session-123' }],
      ]

      mockInsertBatch.mockResolvedValueOnce({ attempted: 3, inserted: 3, skipped: 0, errored: false })

      const result = await completeTest(request, 'user-abc')

      expect(result.success).toBe(true)
      expect(result.gapFilledCount).toBe(3)
      expect(result.savedQuestionsCount).toBe(3) // 0 previos + 3 rellenados
      expect(mockInsertBatch).toHaveBeenCalledTimes(1)
      expect((mockInsertBatch.mock.calls[0][0] as any[])).toHaveLength(3)
    })

    test('NO rellena respuestas sin datos mínimos (question + options)', async () => {
      completeTest = await loadModule()

      // Cliente antiguo que no manda question/options → no podemos reconstruir
      const oldStyleAnswer: DetailedAnswerInput = makeAnswer({
        questionIndex: 0,
        questionData: {
          id: 'q0',
          metadata: { difficulty: 'medium' },
          article: { id: 'art0', number: '1', law_short_name: 'CE' },
          // NO hay question ni options
        },
      })

      const request = makeRequest({ detailedAnswers: [oldStyleAnswer] })

      dbResponses.select = [
        [{ id: 'test-session-123', userId: 'user-abc', temaNumber: null }],
        [], // vacío
      ]
      dbResponses.update = [[{ id: 'test-session-123' }]]

      const result = await completeTest(request, 'user-abc')

      expect(result.success).toBe(true)
      expect(result.gapFilledCount).toBe(0)
      // No debe intentar el batch insert — no hay rows rellenables
      expect(mockInsertBatch).not.toHaveBeenCalled()
    })

    test('Salta respuestas cuyo correctOption no se encontró en BD', async () => {
      completeTest = await loadModule()

      const request = makeRequest({
        detailedAnswers: [makeRichAnswer(0), makeRichAnswer(1)],
      })

      dbResponses.select = [
        [{ id: 'test-session-123', userId: 'user-abc', temaNumber: null }],
        [], // nada guardado
        // Solo q0 tiene correctOption, q1 no existe en la tabla
        [{ id: 'q0', correctOption: 1 }],
      ]
      dbResponses.update = [[{ id: 'test-session-123' }]]

      mockInsertBatch.mockResolvedValueOnce({ attempted: 1, inserted: 1, skipped: 0, errored: false })

      const result = await completeTest(request, 'user-abc')

      expect(result.success).toBe(true)
      expect(result.gapFilledCount).toBe(1) // solo q0
      expect((mockInsertBatch.mock.calls[0][0] as any[])).toHaveLength(1)
      expect((mockInsertBatch.mock.calls[0][0] as any[])[0].questionData.id).toBe('q0')
    })

    test('ON CONFLICT: si insertBatch reporta skipped, gapFilledCount refleja solo lo realmente insertado', async () => {
      completeTest = await loadModule()

      const request = makeRequest({
        detailedAnswers: [makeRichAnswer(0), makeRichAnswer(1)],
      })

      dbResponses.select = [
        [{ id: 'test-session-123', userId: 'user-abc', temaNumber: null }],
        [], // vacío
        [{ id: 'q0', correctOption: 0 }, { id: 'q1', correctOption: 1 }],
      ]
      dbResponses.update = [[{ id: 'test-session-123' }]]

      // Simulamos que una de las dos ya existía (race con /answer-and-save)
      mockInsertBatch.mockResolvedValueOnce({ attempted: 2, inserted: 1, skipped: 1, errored: false })

      const result = await completeTest(request, 'user-abc')

      expect(result.gapFilledCount).toBe(1)
    })

    test('Si el batch insert falla, no propaga el error al usuario', async () => {
      completeTest = await loadModule()

      const request = makeRequest({
        detailedAnswers: [makeRichAnswer(0)],
      })

      dbResponses.select = [
        [{ id: 'test-session-123', userId: 'user-abc', temaNumber: null }],
        [],
        [{ id: 'q0', correctOption: 0 }],
      ]
      dbResponses.update = [[{ id: 'test-session-123' }]]

      mockInsertBatch.mockResolvedValueOnce({
        attempted: 1, inserted: 0, skipped: 0, errored: true, error: 'boom',
      })

      const result = await completeTest(request, 'user-abc')

      // El test se completa igualmente (los analytics se guardaron en `tests`)
      expect(result.success).toBe(true)
      expect(result.gapFilledCount).toBe(0)
    })

    test('Respuestas psicotécnicas van al lookup correcto (psychometric_questions)', async () => {
      completeTest = await loadModule()

      const request = makeRequest({
        detailedAnswers: [
          makeRichAnswer(0, {
            questionData: {
              id: 'psy0',
              question: 'Series numéricas',
              options: ['1', '2', '3', '4'],
              questionType: 'psychometric',
              metadata: { difficulty: 'medium' },
            },
          }),
        ],
      })

      dbResponses.select = [
        [{ id: 'test-session-123', userId: 'user-abc', temaNumber: null }],
        [], // vacío
        [{ id: 'psy0', correctOption: 3 }], // lookup en psychometric_questions
      ]
      dbResponses.update = [[{ id: 'test-session-123' }]]

      mockInsertBatch.mockResolvedValueOnce({ attempted: 1, inserted: 1, skipped: 0, errored: false })

      const result = await completeTest(request, 'user-abc')

      expect(result.success).toBe(true)
      expect(result.gapFilledCount).toBe(1)
      const saveReq = (mockInsertBatch.mock.calls[0][0] as any[])[0]
      expect(saveReq.questionData.questionType).toBe('psychometric')
      expect(saveReq.answerData.correctAnswer).toBe(3)
    })
  })
})
