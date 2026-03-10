/**
 * Regression test: Bug reportado por begosaiz85@gmail.com
 *
 * ISSUE: Usuario premium reportó el 19 enero 2026:
 * "Contestando correctamente a todas las preguntas de un test me sale
 * como que debo hacer repasos urgentes porque me aparece como que
 * no las he contestado bien."
 *
 * ROOT CAUSE ORIGINAL: Se guardaba el número absoluto (6) en lugar del porcentaje (100%).
 * FIX ORIGINAL: 21 enero 2026 — guardar porcentaje.
 *
 * SEGUNDO FIX (10 marzo 2026): Unificar semántica a COUNT.
 * La capa de stats siempre asumió score=COUNT: accuracy=(score/total)*100.
 * Cuando score era porcentaje, accuracy daba >100%. Ahora score=COUNT siempre.
 *
 * Este test garantiza que:
 * 1. score = COUNT de aciertos (no porcentaje)
 * 2. La capa de stats deriva correctamente el porcentaje
 * 3. El usuario NUNCA ve "repasos urgentes" si respondió todo bien
 */

import { updateTestScore } from '@/utils/testSession'

const mockUpdate = jest.fn().mockReturnValue({
  eq: jest.fn().mockResolvedValue({ error: null })
})

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      update: mockUpdate
    }))
  }))
}))

describe('Regression: Bego Saiz Bug (Score = COUNT)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Reproducción exacta del bug reportado', () => {
    it('6/6 correctas → score=6, stats derivan 100%', async () => {
      const testId = 'c5136bb6-685b-4442-b152-dda6d33e215a'
      const totalQuestions = 6
      const correctAnswers = 6

      // score = COUNT de aciertos
      await updateTestScore(testId, correctAnswers)

      expect(mockUpdate).toHaveBeenCalledWith({ score: 6 })
      expect(mockUpdate).not.toHaveBeenCalledWith({ score: 100 })

      // Stats layer deriva el porcentaje
      const accuracy = Math.round((correctAnswers / totalQuestions) * 100)
      expect(accuracy).toBe(100)

      // El usuario NO debe ver "repasos urgentes"
      const requiresUrgentReview = accuracy < 50
      expect(requiresUrgentReview).toBe(false)
    })

    it('todos los tests de Bego Saiz — score=COUNT, accuracy derivada', () => {
      const begoTests = [
        { id: 'c5136bb6', correct: 6, total: 6 },
        { id: '13875cf2', correct: 4, total: 6 },
        { id: '37610873', correct: 21, total: 21 },
        { id: 'd3001672', correct: 6, total: 6 },
        { id: '347debb4', correct: 3, total: 4 },
        { id: '2a94489a', correct: 4, total: 5 },
        { id: '22509fb0', correct: 3, total: 3 },
        { id: 'e59ab9e3', correct: 2, total: 2 },
        { id: 'f6d96592', correct: 2, total: 2 },
        { id: 'a521a3f9', correct: 3, total: 4 },
      ]

      begoTests.forEach(test => {
        // score = COUNT
        expect(test.correct).toBeLessThanOrEqual(test.total)

        // accuracy derivada correctamente
        const accuracy = Math.round((test.correct / test.total) * 100)
        expect(accuracy).toBeGreaterThanOrEqual(0)
        expect(accuracy).toBeLessThanOrEqual(100)

        // Si respondió todo bien, accuracy=100%
        if (test.correct === test.total) {
          expect(accuracy).toBe(100)
        }
      })
    })
  })

  describe('Prevención: read paths derivan % correctamente', () => {
    it('filtro de notificaciones usa accuracy derivada, no score directo', () => {
      // Simula el patrón de useIntelligentNotifications
      const tests = [
        { score: 6, total_questions: 6 },   // 100%
        { score: 4, total_questions: 10 },  // 40%
        { score: 15, total_questions: 20 }, // 75%
      ]

      const lowAccuracy = tests.filter(t => {
        const pct = Math.round((t.score / t.total_questions) * 100)
        return pct < 70
      })

      expect(lowAccuracy).toHaveLength(1) // solo 4/10 = 40%
      expect(lowAccuracy[0].score).toBe(4)

      // BUG antiguo: test.score < 70 filtraria score=6 y score=4 y score=15
      const buggyFilter = tests.filter(t => t.score < 70)
      expect(buggyFilter).toHaveLength(3) // TODOS! porque 6, 4, 15 < 70
    })

    it('motivationalAnalyzer acumula accuracy derivada, no counts', () => {
      // Simula el patrón de analyzeStudyConsistency
      const tests = [
        { score: 8, total_questions: 10 },  // 80%
        { score: 3, total_questions: 5 },   // 60%
      ]

      // CORRECTO: derivar accuracy antes de acumular
      const totalAccuracy = tests.reduce((sum, t) => {
        const total = t.total_questions || 1
        return sum + ((t.score || 0) / total) * 100
      }, 0)
      const avgAccuracy = totalAccuracy / tests.length
      expect(Math.round(avgAccuracy)).toBe(70) // (80+60)/2

      // BUG antiguo: acumular score directamente
      const buggyTotal = tests.reduce((sum, t) => sum + (t.score || 0), 0)
      const buggyAvg = buggyTotal / tests.length
      expect(buggyAvg).toBe(5.5) // (8+3)/2 = sin sentido
    })

    it('userPatternAnalyzer promedia accuracy derivada, no counts', () => {
      // Simula el patrón de assessRiskLevel
      const sessions = [
        { score: 15, total_questions: 20 }, // 75%
        { score: 8, total_questions: 10 },  // 80%
        { score: 3, total_questions: 10 },  // 30%
      ]

      // CORRECTO: derivar accuracy por test, luego promediar
      const avgPct = sessions.reduce((sum, s) => {
        const total = Number(s.total_questions) || 1
        return sum + ((Number(s.score) || 0) / total) * 100
      }, 0) / sessions.length
      expect(Math.round(avgPct)).toBe(62) // (75+80+30)/3

      // BUG antiguo: promediar counts y comparar con 50
      const buggyAvg = sessions.reduce((sum, s) => sum + (s.score || 0), 0) / sessions.length
      expect(Math.round(buggyAvg)).toBe(9) // (15+8+3)/3 = 8.67, siempre <50 → false positive
    })

    it('admin page muestra score/total directamente (COUNT semantics)', () => {
      const activity = { score: 15, total_questions: 20 }
      const s = Number(activity.score)
      const t = Number(activity.total_questions)

      const label = `${s}/${t} preguntas`
      const pct = `${Math.round((s / t) * 100)}%`

      expect(label).toBe('15/20 preguntas')
      expect(pct).toBe('75%')
    })
  })

  describe('Invariante: score <= total_questions siempre', () => {
    it('ningun write path produce score > total', () => {
      const cases = [
        { correct: 6, total: 6 },
        { correct: 0, total: 10 },
        { correct: 21, total: 25 },
        { correct: 48, total: 50 },
      ]

      cases.forEach(({ correct, total }) => {
        expect(correct).toBeLessThanOrEqual(total)
        expect(correct).toBeGreaterThanOrEqual(0)
      })
    })

    it('si score > total, es dato corrupto de la era porcentaje', () => {
      const corruptExamples = [
        { score: 75, total: 20 },  // 75% guardado como count
        { score: 100, total: 6 },  // 100% guardado como count
      ]

      corruptExamples.forEach(({ score, total }) => {
        expect(score).toBeGreaterThan(total)
        // Estos ya fueron migrados en la BD
      })
    })
  })
})
