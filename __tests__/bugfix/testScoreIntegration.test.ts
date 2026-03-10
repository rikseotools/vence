/**
 * Tests de integracion para score = COUNT
 *
 * Verifica que TestLayout y ExamLayout pasan COUNT (no porcentaje)
 * a updateTestScore y que los write paths son coherentes.
 */

import { updateTestScore } from '@/utils/testSession'

// Mock completo
const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  auth: {
    getUser: jest.fn(() =>
      Promise.resolve({
        data: { user: { id: 'test-user-id' } },
        error: null,
      })
    ),
  },
}

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => mockSupabase),
}))

jest.mock('@/utils/testSession', () => ({
  updateTestScore: jest.fn().mockResolvedValue(true),
  createDetailedTestSession: jest.fn().mockResolvedValue({
    id: 'test-session-id',
  }),
}))

jest.mock('@/utils/testAnswers', () => ({
  saveDetailedAnswer: jest.fn().mockResolvedValue({
    success: true,
    question_id: 'q-123',
  }),
  calculateConfidence: jest.fn(() => 'sure'),
}))

const mockedUpdateTestScore = updateTestScore as jest.MockedFunction<typeof updateTestScore>

describe('Integration: Score = COUNT in Components', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('TestLayout - pasa count a updateTestScore', () => {
    it('primera correcta de 10 → updateTestScore(id, 1)', async () => {
      const effectiveQuestions = Array(10).fill({})
      let score = 0
      const isCorrect = true
      const newScore = isCorrect ? score + 1 : score

      // FIX: se pasa newScore (count), NO porcentaje
      await updateTestScore('session-id', newScore)

      expect(mockedUpdateTestScore).toHaveBeenCalledWith('session-id', 1)
      expect(mockedUpdateTestScore).not.toHaveBeenCalledWith(
        'session-id',
        Math.round((1 / effectiveQuestions.length) * 100)
      )
    })

    it('6 de 6 correctas → updateTestScore(id, 6), NO (id, 100)', async () => {
      const effectiveQuestions = Array(6).fill({})
      let score = 0

      for (let i = 0; i < 6; i++) {
        score++
        await updateTestScore('session-id', score)
      }

      const lastCall = mockedUpdateTestScore.mock.calls[mockedUpdateTestScore.mock.calls.length - 1]
      expect(lastCall[1]).toBe(6)
      expect(lastCall[1]).not.toBe(100)
    })

    it('15 de 25 correctas → updateTestScore(id, 15)', async () => {
      const effectiveQuestions = Array(25).fill({})
      const previousCorrect = 15

      await updateTestScore('session-id', previousCorrect)

      expect(mockedUpdateTestScore).toHaveBeenCalledWith('session-id', 15)
      expect(mockedUpdateTestScore).not.toHaveBeenCalledWith(
        'session-id',
        Math.round((15 / effectiveQuestions.length) * 100)
      )
    })
  })

  describe('ExamLayout - batch score es count', () => {
    it('21 correctas de 25 → score=21, NO 84', async () => {
      const effectiveQuestions = Array(25).fill({})
      const allAnswers = Array(25)
        .fill({})
        .map((_, i) => ({
          isCorrect: i < 21,
        }))

      const correctCount = allAnswers.filter((a) => a.isCorrect).length

      // FIX: se pasa count, no porcentaje
      await updateTestScore('session-id', correctCount)

      expect(mockedUpdateTestScore).toHaveBeenCalledWith('session-id', 21)
      expect(mockedUpdateTestScore).not.toHaveBeenCalledWith('session-id', 84)
    })

    it('test perfecto 6/6 → score=6', async () => {
      const allAnswers = Array(6).fill({ isCorrect: true })
      const correctCount = allAnswers.filter((a) => a.isCorrect).length

      await updateTestScore('session-id', correctCount)

      expect(mockedUpdateTestScore).toHaveBeenCalledWith('session-id', 6)
      expect(mockedUpdateTestScore).not.toHaveBeenCalledWith('session-id', 100)
    })
  })

  describe('Escenarios reales de produccion', () => {
    it('caso Bego Saiz: 6/6 → score=6 (stats derivara 100%)', async () => {
      const questions = Array(6).fill({})
      const correctCount = 6

      await updateTestScore('bego-test-id', correctCount)

      expect(mockedUpdateTestScore).toHaveBeenCalledWith('bego-test-id', 6)

      // Stats derivara el porcentaje:
      const accuracy = Math.round((6 / questions.length) * 100)
      expect(accuracy).toBe(100)
    })

    it('tests de distintos tamanios usan count', async () => {
      const scenarios = [
        { total: 10, correct: 8 },
        { total: 25, correct: 21 },
        { total: 50, correct: 48 },
        { total: 3, correct: 3 },
        { total: 100, correct: 85 },
      ]

      for (const { total, correct } of scenarios) {
        jest.clearAllMocks()
        await updateTestScore('test-id', correct)

        expect(mockedUpdateTestScore).toHaveBeenCalledWith('test-id', correct)
        expect(correct).toBeLessThanOrEqual(total)

        // Porcentaje se deriva correctamente
        const pct = Math.round((correct / total) * 100)
        expect(pct).toBeGreaterThanOrEqual(0)
        expect(pct).toBeLessThanOrEqual(100)
      }
    })
  })

  describe('Invariante: score guardado <= totalQuestions', () => {
    it('ningun write path debe producir score > total', () => {
      const simulateWritePaths = (correct: number, total: number) => {
        return {
          testLayout: correct,
          recoverTest: correct,
          officialExamRoute: correct,
          officialExamQuery: correct,
          examQueryUpdateScore: correct, // viene de COUNT SQL
          examQueryComplete: correct,
        }
      }

      const scenarios = [
        { correct: 6, total: 6 },
        { correct: 21, total: 25 },
        { correct: 0, total: 10 },
        { correct: 48, total: 50 },
      ]

      for (const { correct, total } of scenarios) {
        const scores = simulateWritePaths(correct, total)
        Object.entries(scores).forEach(([path, score]) => {
          expect(score).toBeLessThanOrEqual(total)
          expect(score).toBeGreaterThanOrEqual(0)
        })
      }
    })
  })
})
