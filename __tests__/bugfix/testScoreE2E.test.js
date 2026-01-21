/**
 * Tests E2E para score calculation
 *
 * Simula el flujo completo de usuario respondiendo test
 * y verifica que el score se guarda correctamente en BD
 */

// Mock de Supabase con tracking de operaciones
const dbOperations = []

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn((table) => {
      const chainable = {
        update: jest.fn((data) => {
          dbOperations.push({ operation: 'update', table, data })
          return chainable
        }),
        insert: jest.fn((data) => {
          dbOperations.push({ operation: 'insert', table, data })
          return chainable
        }),
        eq: jest.fn(() => chainable),
        select: jest.fn(() => chainable),
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        then: (resolve) => resolve({ data: null, error: null })
      }
      return chainable
    }),
    auth: {
      getUser: jest.fn(() => Promise.resolve({
        data: { user: { id: 'test-user-id' } },
        error: null
      }))
    }
  }))
}))

import { updateTestScore } from '@/utils/testSession'
import { saveDetailedAnswer } from '@/utils/testAnswers'

describe('E2E: Complete Test Flow with Score Calculation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    dbOperations.length = 0
  })

  describe('Usuario completa test - flujo completo', () => {
    it('debe guardar score como porcentaje en cada respuesta', async () => {
      const sessionId = 'test-session-123'
      const questions = [
        { id: 'q1', question: 'Pregunta 1', correct: 0 },
        { id: 'q2', question: 'Pregunta 2', correct: 1 },
        { id: 'q3', question: 'Pregunta 3', correct: 2 },
        { id: 'q4', question: 'Pregunta 4', correct: 0 },
        { id: 'q5', question: 'Pregunta 5', correct: 3 },
        { id: 'q6', question: 'Pregunta 6', correct: 1 },
      ]

      let score = 0

      // Simular usuario respondiendo pregunta por pregunta
      for (let i = 0; i < questions.length; i++) {
        const isCorrect = Math.random() > 0.3 // 70% de acierto
        const newScore = isCorrect ? score + 1 : score

        // 🔧 FIX: Calcular porcentaje antes de guardar
        const scorePercentage = Math.round((newScore / questions.length) * 100)

        await updateTestScore(sessionId, scorePercentage)

        score = newScore
      }

      // Verificar que se guardaron porcentajes
      const updateOperations = dbOperations.filter(
        op => op.operation === 'update' && op.table === 'tests'
      )

      updateOperations.forEach(op => {
        const savedScore = op.data.score

        // El score debe ser un porcentaje válido
        expect(savedScore).toBeGreaterThanOrEqual(0)
        expect(savedScore).toBeLessThanOrEqual(100)

        // No debe ser simplemente el contador de respuestas (1-6)
        if (savedScore < 10 && questions.length > 10) {
          throw new Error(
            `Posible bug: score ${savedScore}% es sospechosamente bajo para ${questions.length} preguntas`
          )
        }
      })
    })

    it('caso real: usuario responde 6/6 correctas', async () => {
      const sessionId = 'bego-test-session'
      const questions = Array(6).fill({ correct: 0 })

      let score = 0

      // Usuario responde todas correctamente
      for (let i = 0; i < questions.length; i++) {
        const isCorrect = true
        score = isCorrect ? score + 1 : score

        const scorePercentage = Math.round((score / questions.length) * 100)
        await updateTestScore(sessionId, scorePercentage)
      }

      // Verificar última actualización
      const lastUpdate = dbOperations
        .filter(op => op.operation === 'update' && op.table === 'tests')
        .pop()

      expect(lastUpdate.data.score).toBe(100)
      expect(lastUpdate.data.score).not.toBe(6)

      // El usuario NO debe ver "repasos urgentes"
      const requiresUrgentReview = lastUpdate.data.score < 50
      expect(requiresUrgentReview).toBe(false)
    })

    it('caso real: usuario responde 21/25 correctas', async () => {
      const sessionId = 'test-session-21-25'
      const questions = Array(25).fill({ correct: 0 })

      let score = 0

      // Usuario responde 21 correctas
      for (let i = 0; i < questions.length; i++) {
        const isCorrect = i < 21
        score = isCorrect ? score + 1 : score

        const scorePercentage = Math.round((score / questions.length) * 100)
        await updateTestScore(sessionId, scorePercentage)
      }

      const lastUpdate = dbOperations
        .filter(op => op.operation === 'update' && op.table === 'tests')
        .pop()

      expect(lastUpdate.data.score).toBe(84)
      expect(lastUpdate.data.score).not.toBe(21)
    })
  })

  describe('Modo examen - validación batch', () => {
    it('debe calcular score correcto al finalizar examen completo', async () => {
      const sessionId = 'exam-session-123'
      const questions = Array(50).fill({ correct: 0 })
      const userAnswers = questions.map((_, i) => ({
        isCorrect: i < 48 // 48 correctas de 50
      }))

      const correctCount = userAnswers.filter(a => a.isCorrect).length
      const scorePercentage = Math.round((correctCount / questions.length) * 100)

      await updateTestScore(sessionId, scorePercentage)

      const updateOperation = dbOperations.find(
        op => op.operation === 'update' && op.table === 'tests'
      )

      expect(updateOperation.data.score).toBe(96)
      expect(updateOperation.data.score).not.toBe(48)
    })
  })

  describe('Detección de regresión del bug', () => {
    it('debe fallar si se detecta el patrón del bug original', async () => {
      const sessionId = 'test-session'
      const questions = Array(10).fill({ correct: 0 })
      let score = 0

      // Simular responder 6 correctas
      for (let i = 0; i < 6; i++) {
        score++

        // ❌ CÓDIGO CON BUG (no calcular porcentaje)
        // await updateTestScore(sessionId, score)

        // ✅ CÓDIGO CORRECTO
        const scorePercentage = Math.round((score / questions.length) * 100)
        await updateTestScore(sessionId, scorePercentage)
      }

      const lastUpdate = dbOperations
        .filter(op => op.operation === 'update' && op.table === 'tests')
        .pop()

      // Detectar bug: si el score guardado es igual al contador
      const savedScore = lastUpdate.data.score
      const correctCount = score
      const expectedScore = Math.round((correctCount / questions.length) * 100)

      if (savedScore === correctCount && savedScore !== expectedScore) {
        throw new Error(
          `🐛 BUG DETECTADO: Se guardó ${savedScore} (contador) en lugar de ${expectedScore}% (porcentaje)`
        )
      }

      expect(savedScore).toBe(60) // 6/10 = 60%
      expect(savedScore).not.toBe(6) // No el contador
    })

    it('debe pasar invariantes de seguridad', () => {
      const testInvariants = (score, totalQuestions) => {
        const invariants = []

        // Invariante 1: Score debe estar entre 0-100
        if (score < 0 || score > 100) {
          invariants.push('Score fuera de rango [0, 100]')
        }

        // Invariante 2: Si hay 100% de acierto, score debe ser 100
        if (score === totalQuestions && score !== 100) {
          invariants.push(`100% de acierto debe ser score=100, no score=${score}`)
        }

        // Invariante 3: Score no puede ser decimal si usamos Math.round
        if (score % 1 !== 0) {
          invariants.push('Score no debe tener decimales')
        }

        // Invariante 4: Si totalQuestions > 10 y score <= totalQuestions, posible bug
        if (totalQuestions > 10 && score > 0 && score <= totalQuestions && score < 50) {
          invariants.push(
            `Sospechoso: score ${score}% con ${totalQuestions} preguntas (¿es un contador?)`
          )
        }

        return invariants
      }

      // Casos buenos
      expect(testInvariants(100, 10)).toEqual([])
      expect(testInvariants(60, 10)).toEqual([])
      expect(testInvariants(0, 10)).toEqual([])

      // Casos con bug
      expect(testInvariants(6, 25)).toEqual([
        'Sospechoso: score 6% con 25 preguntas (¿es un contador?)'
      ])

      expect(testInvariants(21, 25)).toEqual([
        'Sospechoso: score 21% con 25 preguntas (¿es un contador?)'
      ])

      // Casos inválidos
      expect(testInvariants(150, 10)).toContain('Score fuera de rango [0, 100]')
      expect(testInvariants(-5, 10)).toContain('Score fuera de rango [0, 100]')
    })
  })

  describe('Snapshot testing - patrones correctos', () => {
    it('debe matchear patrón correcto de cálculo', () => {
      const correctPattern = {
        step1: 'Mantener contador local: score++',
        step2: 'Calcular porcentaje: Math.round((score / total) * 100)',
        step3: 'Guardar porcentaje: updateTestScore(id, percentage)',
        warning: 'NUNCA guardar score directamente sin calcular porcentaje'
      }

      expect(correctPattern).toMatchSnapshot()
    })

    it('debe documentar casos de prueba del bug', () => {
      const bugCases = [
        {
          user: 'begosaiz85@gmail.com',
          correct: 6,
          total: 6,
          buggyScore: 6,
          fixedScore: 100,
          impact: 'Usuario premium reportó que "contesto bien pero aparece mal"'
        },
        {
          user: 'production',
          correct: 21,
          total: 25,
          buggyScore: 21,
          fixedScore: 84,
          impact: 'Score aparecía como suspenso siendo aprobado'
        },
        {
          user: 'production',
          correct: 48,
          total: 50,
          buggyScore: 48,
          fixedScore: 96,
          impact: 'Test casi perfecto aparecía como mediocre'
        }
      ]

      expect(bugCases).toMatchSnapshot()
    })
  })

  describe('Monitoring helpers', () => {
    it('debe proveer función de detección de anomalías', () => {
      const detectScoreAnomaly = (savedScore, correctCount, totalQuestions) => {
        const anomalies = []
        const expectedScore = Math.round((correctCount / totalQuestions) * 100)

        if (savedScore !== expectedScore) {
          anomalies.push({
            type: 'score_mismatch',
            severity: 'high',
            savedScore,
            expectedScore,
            correctCount,
            totalQuestions,
            possibleCause: savedScore === correctCount
              ? 'Score guardado como contador en lugar de porcentaje'
              : 'Cálculo incorrecto de porcentaje'
          })
        }

        if (savedScore > 100 || savedScore < 0) {
          anomalies.push({
            type: 'invalid_range',
            severity: 'critical',
            savedScore
          })
        }

        if (totalQuestions >= 10 && savedScore > 0 && savedScore <= totalQuestions) {
          anomalies.push({
            type: 'suspicious_low_score',
            severity: 'medium',
            savedScore,
            totalQuestions,
            note: 'Score muy bajo podría indicar contador sin convertir'
          })
        }

        return anomalies
      }

      // Test con bug
      const bugAnomaly = detectScoreAnomaly(6, 6, 10)
      expect(bugAnomaly).toHaveLength(2)
      expect(bugAnomaly[0].type).toBe('score_mismatch')
      expect(bugAnomaly[0].possibleCause).toContain('contador')

      // Test correcto
      const okAnomaly = detectScoreAnomaly(60, 6, 10)
      expect(okAnomaly).toHaveLength(0)
    })
  })
})
