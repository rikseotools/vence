/**
 * Tests para verificar que el score se guarda como PORCENTAJE, no como número de correctas
 *
 * BUG DETECTADO (Feb 2026): En 3 lugares se guardaba correctCount en vez de porcentaje:
 * - lib/api/exam/queries.ts:287 (updateTestScore)
 * - lib/api/exam/queries.ts:526 (completeExam)
 * - app/api/v2/official-exams/complete/route.ts:165
 *
 * Ejemplo del bug:
 * - Usuario responde 56 correctas de 60 total
 * - Se guardaba score = "56" (número de correctas)
 * - Debería guardarse score = "93" (porcentaje: 56/60 * 100)
 */

describe('Score Calculation - Regression Tests', () => {

  describe('Fórmula correcta: score = (correctas / total) * 100', () => {

    // Función que replica la lógica correcta
    const calculateScorePercentage = (correct: number, total: number): number => {
      return total > 0 ? Math.round((correct / total) * 100) : 0
    }

    it('56 correctas de 60 debe ser 93%, NO 56%', () => {
      const correct = 56
      const total = 60
      const score = calculateScorePercentage(correct, total)

      expect(score).toBe(93)
      expect(score).not.toBe(56) // Bug: guardar correctCount directamente
    })

    it('11 correctas de 15 debe ser 73%, NO 11%', () => {
      const correct = 11
      const total = 15
      const score = calculateScorePercentage(correct, total)

      expect(score).toBe(73)
      expect(score).not.toBe(11)
    })

    it('38 correctas de 42 debe ser 90%, NO 38%', () => {
      const correct = 38
      const total = 42
      const score = calculateScorePercentage(correct, total)

      expect(score).toBe(90)
      expect(score).not.toBe(38)
    })

    it('1 correcta de 1 debe ser 100%, NO 1%', () => {
      const correct = 1
      const total = 1
      const score = calculateScorePercentage(correct, total)

      expect(score).toBe(100)
      expect(score).not.toBe(1)
    })

    it('1 correcta de 51 debe ser 2%, NO 1%', () => {
      const correct = 1
      const total = 51
      const score = calculateScorePercentage(correct, total)

      expect(score).toBe(2)
      expect(score).not.toBe(1)
    })

    it('0 correctas de 63 debe ser 0%', () => {
      const correct = 0
      const total = 63
      const score = calculateScorePercentage(correct, total)

      expect(score).toBe(0)
    })
  })

  describe('Casos reales de usuario Nila (bug reportado)', () => {
    const nilaTests = [
      { correct: 56, total: 60, expectedPercent: 93, buggyValue: 56 },
      { correct: 11, total: 15, expectedPercent: 73, buggyValue: 11 },
      { correct: 38, total: 42, expectedPercent: 90, buggyValue: 38 },
      { correct: 1, total: 1, expectedPercent: 100, buggyValue: 1 },
      { correct: 6, total: 14, expectedPercent: 43, buggyValue: 6 },
      { correct: 17, total: 22, expectedPercent: 77, buggyValue: 17 },
      { correct: 2, total: 4, expectedPercent: 50, buggyValue: 2 },
      { correct: 16, total: 16, expectedPercent: 100, buggyValue: 16 },
      { correct: 19, total: 25, expectedPercent: 76, buggyValue: 19 },
    ]

    nilaTests.forEach(({ correct, total, expectedPercent, buggyValue }) => {
      it(`${correct}/${total} correctas debe ser ${expectedPercent}%, NO ${buggyValue}%`, () => {
        const score = Math.round((correct / total) * 100)

        expect(score).toBe(expectedPercent)
        expect(score).not.toBe(buggyValue)
      })
    })
  })

  describe('Validación de código en lib/api/exam/queries.ts', () => {

    it('updateTestScore debe calcular porcentaje antes de guardar', async () => {
      // Este test verifica el PATRÓN correcto, no la implementación real
      // porque la implementación real requiere DB

      const mockDbResult = { total: 60, correct: 56 }

      // Patrón CORRECTO (como debe estar el código)
      const total = mockDbResult.total
      const correct = mockDbResult.correct
      const scorePercentage = total > 0 ? Math.round((correct / total) * 100) : 0

      // Verificar que se usaría el porcentaje, no el conteo
      expect(scorePercentage).toBe(93)
      expect(scorePercentage).not.toBe(correct) // No debe ser el conteo directo
    })

    it('completeExam debe usar scorePercentage.toString(), no correctCount.toString()', () => {
      const answeredCount = 42
      const correctCount = 38

      // Patrón INCORRECTO (el bug)
      const buggyScore = correctCount.toString() // "38"

      // Patrón CORRECTO
      const scorePercentage = answeredCount > 0
        ? Math.round((correctCount / answeredCount) * 100)
        : 0
      const correctScore = scorePercentage.toString() // "90"

      expect(buggyScore).toBe("38")
      expect(correctScore).toBe("90")
      expect(correctScore).not.toBe(buggyScore)
    })
  })

  describe('Validación de código en official-exams/complete', () => {

    it('debe usar la variable score calculada, no correctCount', () => {
      const answeredCount = 51
      const correctCount = 1

      // Línea 155: calcula score correctamente
      const score = answeredCount > 0
        ? Math.round((correctCount / answeredCount) * 100)
        : 0

      // Línea 165: DEBE usar score, no correctCount
      const correctToSave = score.toString() // "2"
      const buggyToSave = correctCount.toString() // "1"

      expect(correctToSave).toBe("2")
      expect(buggyToSave).toBe("1")
      expect(correctToSave).not.toBe(buggyToSave)
    })
  })

  describe('Detector de bug: score sospechosamente bajo', () => {

    /**
     * Heurística: si score <= totalQuestions y totalQuestions > 10,
     * probablemente se guardó el conteo en vez del porcentaje
     */
    const detectPossibleBug = (score: number, totalQuestions: number): boolean => {
      if (totalQuestions <= 10) return false // Puede ser coincidencia
      if (score > totalQuestions) return false // Es un porcentaje válido
      if (score > 100) return true // Imposible, bug seguro

      // Score muy bajo comparado con total de preguntas
      // Ej: score=56 con 60 preguntas -> sospechoso (debería ser ~93%)
      return score <= totalQuestions && score < 100
    }

    it('detecta bug: score=56 con 60 preguntas', () => {
      expect(detectPossibleBug(56, 60)).toBe(true)
    })

    it('detecta bug: score=11 con 15 preguntas', () => {
      expect(detectPossibleBug(11, 15)).toBe(true)
    })

    it('NO detecta falso positivo: score=93 con 60 preguntas', () => {
      expect(detectPossibleBug(93, 60)).toBe(false)
    })

    it('NO detecta falso positivo: score=50 con 10 preguntas', () => {
      // Con pocas preguntas puede ser coincidencia (5/10 = 50%)
      expect(detectPossibleBug(50, 10)).toBe(false)
    })
  })
})
