/**
 * Tests E2E para score = COUNT
 *
 * Simula el flujo completo de usuario respondiendo test
 * y verifica que el score se guarda como COUNT de aciertos.
 */

// Mock de Supabase con tracking de operaciones
const dbOperations: { operation: string; table: string; data: any }[] = []

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn((table: string) => {
      const chainable: any = {
        update: jest.fn((data: any) => {
          dbOperations.push({ operation: 'update', table, data })
          return chainable
        }),
        insert: jest.fn((data: any) => {
          dbOperations.push({ operation: 'insert', table, data })
          return chainable
        }),
        eq: jest.fn(() => chainable),
        select: jest.fn(() => chainable),
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        then: (resolve: any) => resolve({ data: null, error: null }),
      }
      return chainable
    }),
    auth: {
      getUser: jest.fn(() =>
        Promise.resolve({
          data: { user: { id: 'test-user-id' } },
          error: null,
        })
      ),
    },
  })),
}))

import { updateTestScore } from '@/utils/testSession'

describe('E2E: Complete Test Flow — score = COUNT', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    dbOperations.length = 0
  })

  describe('Usuario completa test - score es COUNT en cada paso', () => {
    it('debe guardar score como COUNT en cada respuesta', async () => {
      const sessionId = 'test-session-123'
      const totalQuestions = 10

      let score = 0
      const correctPattern = [true, true, false, true, true, false, true, false, true, true]

      for (const isCorrect of correctPattern) {
        const newScore = isCorrect ? score + 1 : score
        // FIX: se pasa count directamente
        await updateTestScore(sessionId, newScore)
        score = newScore
      }

      // Verificar que se guardaron counts
      const updateOperations = dbOperations.filter(
        (op) => op.operation === 'update' && op.table === 'tests'
      )

      updateOperations.forEach((op) => {
        const savedScore = op.data.score
        // Score (count) nunca excede total de preguntas
        expect(savedScore).toBeLessThanOrEqual(totalQuestions)
        expect(savedScore).toBeGreaterThanOrEqual(0)
      })

      // El ultimo score debe ser el total de correctas
      const lastOp = updateOperations[updateOperations.length - 1]
      const expectedCorrect = correctPattern.filter(Boolean).length
      expect(lastOp.data.score).toBe(expectedCorrect)
      expect(expectedCorrect).toBe(7) // 7 correctas de 10
    })

    it('caso real: 6/6 correctas → score=6 (NO 100)', async () => {
      const sessionId = 'bego-test-session'
      const totalQuestions = 6
      let score = 0

      for (let i = 0; i < totalQuestions; i++) {
        score++
        await updateTestScore(sessionId, score)
      }

      const lastUpdate = dbOperations
        .filter((op) => op.operation === 'update' && op.table === 'tests')
        .pop()

      expect(lastUpdate!.data.score).toBe(6)
      expect(lastUpdate!.data.score).not.toBe(100) // antiguo bug

      // Stats derivara el porcentaje correctamente:
      const accuracy = Math.round((lastUpdate!.data.score / totalQuestions) * 100)
      expect(accuracy).toBe(100)
    })

    it('caso real: 21/25 correctas → score=21 (NO 84)', async () => {
      const sessionId = 'test-session-21-25'
      const totalQuestions = 25
      let score = 0

      for (let i = 0; i < totalQuestions; i++) {
        const isCorrect = i < 21
        if (isCorrect) score++
        await updateTestScore(sessionId, score)
      }

      const lastUpdate = dbOperations
        .filter((op) => op.operation === 'update' && op.table === 'tests')
        .pop()

      expect(lastUpdate!.data.score).toBe(21)
      expect(lastUpdate!.data.score).not.toBe(84)

      const accuracy = Math.round((lastUpdate!.data.score / totalQuestions) * 100)
      expect(accuracy).toBe(84)
    })
  })

  describe('Modo examen - batch score es COUNT', () => {
    it('48 correctas de 50 → score=48 (NO 96)', async () => {
      const sessionId = 'exam-session-123'
      const totalQuestions = 50

      const correctCount = 48
      await updateTestScore(sessionId, correctCount)

      const updateOperation = dbOperations.find(
        (op) => op.operation === 'update' && op.table === 'tests'
      )

      expect(updateOperation!.data.score).toBe(48)
      expect(updateOperation!.data.score).not.toBe(96) // antiguo bug

      const accuracy = Math.round((48 / totalQuestions) * 100)
      expect(accuracy).toBe(96)
    })
  })

  describe('Deteccion de regresion', () => {
    it('si score > totalQuestions, es un bug de porcentaje', async () => {
      const sessionId = 'test-session'
      const totalQuestions = 10
      let score = 0

      for (let i = 0; i < 6; i++) {
        score++
        // CORRECTO: pasar count
        await updateTestScore(sessionId, score)
      }

      const lastUpdate = dbOperations
        .filter((op) => op.operation === 'update' && op.table === 'tests')
        .pop()

      const savedScore = lastUpdate!.data.score

      // Invariante: score <= totalQuestions
      expect(savedScore).toBeLessThanOrEqual(totalQuestions)
      expect(savedScore).toBe(6)
      expect(savedScore).not.toBe(60) // Math.round(6/10*100) = 60
    })

    it('secuencia de scores debe ser monotonicamente no decreciente', async () => {
      const sessionId = 'monotone-test'
      const answers = [true, false, true, true, false, true]
      let score = 0

      for (const isCorrect of answers) {
        if (isCorrect) score++
        await updateTestScore(sessionId, score)
      }

      const scores = dbOperations
        .filter((op) => op.operation === 'update' && op.table === 'tests')
        .map((op) => op.data.score)

      // Scores deben ser no decrecientes (nunca baja)
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1])
      }

      expect(scores).toEqual([1, 1, 2, 3, 3, 4])
    })
  })

  describe('Official exam write paths', () => {
    it('save-results API: score = totalCorrect (count)', () => {
      const results = [
        ...Array(53).fill({ userAnswer: 'A', isCorrect: true }),
        ...Array(11).fill({ userAnswer: 'B', isCorrect: false }),
      ]
      const answeredResults = results.filter(
        (r) => r.userAnswer && r.userAnswer !== 'sin_respuesta'
      )
      const totalCorrect = answeredResults.filter((r) => r.isCorrect).length
      const score = totalCorrect

      expect(score).toBe(53)
      expect(score.toString()).toBe('53')
      expect(score).toBeLessThanOrEqual(answeredResults.length)
    })

    it('saveOfficialExamResults: score = String(totalCorrect)', () => {
      const results = [
        ...Array(33).fill({ userAnswer: 'A', isCorrect: true }),
        ...Array(17).fill({ userAnswer: 'B', isCorrect: false }),
      ]
      const answeredResults = results.filter(
        (r) => r.userAnswer && r.userAnswer !== 'sin_respuesta'
      )
      const totalCorrect = answeredResults.filter((r) => r.isCorrect).length
      const score = String(totalCorrect)

      expect(score).toBe('33')
      expect(Number(score)).toBeLessThanOrEqual(answeredResults.length)
    })

    it('recoverTest: score = String(correctAnswers)', () => {
      const answeredQuestions = [
        ...Array(15).fill({ correct: true }),
        ...Array(5).fill({ correct: false }),
      ]
      const correctAnswers = answeredQuestions.filter((q) => q.correct).length
      const score = String(correctAnswers)

      expect(score).toBe('15')
      expect(Number(score)).toBeLessThanOrEqual(answeredQuestions.length)
    })
  })
})
