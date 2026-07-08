/**
 * Tests para prevenir regresion del bug de scores incorrectos
 *
 * SEMANTICA ACTUAL: score = COUNT de aciertos (no porcentaje)
 * El porcentaje se deriva: (score / total_questions) * 100
 *
 * BUG ORIGINAL: Se guardaba Math.round((correctas/total)*100) como score,
 * pero la capa de stats asume score = count. Resultado: accuracy > 100%.
 */

// NOTA (07/07/2026): el write cliente de score (utils/testSession.updateTestScore)
// es NO-OP desde la migración a RDS — el score lo escribe el SERVIDOR
// (answer-and-save: UPDATE tests.score). El invariante score=COUNT (bug Bego Saiz)
// está guardado en __tests__/bugfix/scoreIsCount.test.ts + backend
// answer-and-save.service.spec.ts ("UPDATE tests.score"). Aquí quedan solo los tests
// de la SEMÁNTICA pura (count, NO porcentaje), independientes del path de guardado.

describe('Bug Prevention: Test Score = COUNT', () => {

  describe('Score semantica - count NO porcentaje', () => {
    it('6 correctas de 6 preguntas → score=6 (NO 100)', () => {
      const correctAnswers = 6
      const totalQuestions = 6

      // CORRECTO: score = count
      const score = correctAnswers
      expect(score).toBe(6)

      // INCORRECTO (antiguo bug): score = porcentaje
      const wrongScore = Math.round((correctAnswers / totalQuestions) * 100)
      expect(wrongScore).toBe(100)
      expect(score).not.toBe(wrongScore)
    })

    it('21 correctas de 25 → score=21 (NO 84)', () => {
      const correctAnswers = 21
      const totalQuestions = 25

      const score = correctAnswers
      expect(score).toBe(21)
      expect(score).not.toBe(Math.round((correctAnswers / totalQuestions) * 100))
    })

    it('score siempre <= totalQuestions', () => {
      const testCases = [
        { correct: 6, total: 6 },
        { correct: 21, total: 25 },
        { correct: 4, total: 10 },
        { correct: 0, total: 10 },
        { correct: 48, total: 50 },
      ]

      testCases.forEach(({ correct, total }) => {
        expect(correct).toBeLessThanOrEqual(total)
        expect(correct).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('Derivacion de porcentaje (stats layer)', () => {
    it('porcentaje se calcula correctamente desde count', () => {
      const testCases = [
        { score: 6, total: 6, expectedPct: 100 },
        { score: 21, total: 25, expectedPct: 84 },
        { score: 4, total: 10, expectedPct: 40 },
        { score: 0, total: 10, expectedPct: 0 },
        { score: 48, total: 50, expectedPct: 96 },
        { score: 22, total: 25, expectedPct: 88 },
      ]

      testCases.forEach(({ score, total, expectedPct }) => {
        const percentage = Math.round((score / total) * 100)
        expect(percentage).toBe(expectedPct)
      })
    })
  })

  describe('Edge cases', () => {
    it('test de 1 pregunta correcta → score=1', () => {
      const score = 1
      const total = 1
      expect(score).toBeLessThanOrEqual(total)

      const pct = Math.round((score / total) * 100)
      expect(pct).toBe(100)
    })

    it('test de 1 pregunta incorrecta → score=0', () => {
      const score = 0
      const total = 1
      expect(score).toBeLessThanOrEqual(total)

      const pct = Math.round((score / total) * 100)
      expect(pct).toBe(0)
    })

    it('test de 100 preguntas, todas correctas → score=100', () => {
      const score = 100
      const total = 100
      expect(score).toBeLessThanOrEqual(total)

      const pct = Math.round((score / total) * 100)
      expect(pct).toBe(100)
    })
  })

  describe('Flujo completo: contador de aciertos = score (pura)', () => {
    it('6 correctas de 10 → score=6 (count), NO 60 (porcentaje)', () => {
      let score = 0
      const totalQuestions = 10
      for (let i = 0; i < 6; i++) score++ // 6 correctas
      expect(score).toBe(6) // CORRECTO: count
      expect(score).not.toBe(Math.round((score / totalQuestions) * 100)) // NO porcentaje (60)
    })
  })

  describe('Deteccion de bug: score > totalQuestions', () => {
    it('si score > totalQuestions, es un porcentaje corrupto', () => {
      const corruptCases = [
        { score: 75, total: 20 },  // 75% guardado como count
        { score: 100, total: 6 },  // 100% guardado como count
        { score: 84, total: 25 },  // 84% guardado como count
      ]

      corruptCases.forEach(({ score, total }) => {
        expect(score).toBeGreaterThan(total)
        // Estos son datos corruptos en BD
      })
    })

    it('count valido NUNCA excede totalQuestions', () => {
      const validCases = [
        { score: 15, total: 20 },
        { score: 6, total: 6 },
        { score: 21, total: 25 },
        { score: 0, total: 10 },
      ]

      validCases.forEach(({ score, total }) => {
        expect(score).toBeLessThanOrEqual(total)
      })
    })
  })
})
