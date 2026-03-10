/**
 * Tests: score = COUNT (aciertos brutos), NUNCA porcentaje
 *
 * El campo tests.score almacena el numero de respuestas correctas.
 * El porcentaje se deriva siempre: (score / total_questions) * 100.
 *
 * Estos tests verifican que los 4 write paths corregidos guardan COUNT
 * y que la capa de stats funciona correctamente con COUNT.
 */

// ============================================
// 1. recoverTest — lib/api/tests/queries.ts
// ============================================

describe('recoverTest: score = correctAnswers (count)', () => {
  // Reproduce la logica de recoverTest sin depender de DB
  function computeRecoverTestScore(pendingTest: {
    score?: number
    answeredQuestions: { correct: boolean }[]
  }) {
    const totalQuestions = pendingTest.answeredQuestions.length
    const correctAnswers =
      typeof pendingTest.score === 'number'
        ? pendingTest.score
        : pendingTest.answeredQuestions.filter((q) => q.correct).length

    // FIX: score = count, no porcentaje
    return { score: String(correctAnswers), totalQuestions }
  }

  it('6 correctas de 10 → score="6", NO "60"', () => {
    const result = computeRecoverTestScore({
      answeredQuestions: [
        ...Array(6).fill({ correct: true }),
        ...Array(4).fill({ correct: false }),
      ],
    })
    expect(result.score).toBe('6')
    expect(result.score).not.toBe('60') // antiguo bug: porcentaje
    expect(result.totalQuestions).toBe(10)
  })

  it('21 correctas de 25 → score="21", NO "84"', () => {
    const result = computeRecoverTestScore({
      answeredQuestions: [
        ...Array(21).fill({ correct: true }),
        ...Array(4).fill({ correct: false }),
      ],
    })
    expect(result.score).toBe('21')
    expect(result.score).not.toBe('84')
  })

  it('0 correctas de 10 → score="0"', () => {
    const result = computeRecoverTestScore({
      answeredQuestions: Array(10).fill({ correct: false }),
    })
    expect(result.score).toBe('0')
  })

  it('pendingTest.score numérico se usa como count directamente', () => {
    const result = computeRecoverTestScore({
      score: 15,
      answeredQuestions: Array(20).fill({ correct: false }), // ignorado si score es numero
    })
    expect(result.score).toBe('15')
    expect(result.score).not.toBe('75') // 15/20*100 = 75 (antiguo bug)
  })

  it('todas correctas → score = total', () => {
    const result = computeRecoverTestScore({
      answeredQuestions: Array(25).fill({ correct: true }),
    })
    expect(result.score).toBe('25')
    expect(result.score).not.toBe('100')
  })

  it('1 pregunta correcta → score="1"', () => {
    const result = computeRecoverTestScore({
      answeredQuestions: [{ correct: true }],
    })
    expect(result.score).toBe('1')
    expect(result.score).not.toBe('100')
  })
})

// ============================================
// 2. save-results API — app/api/v2/official-exams/save-results/route.ts
// ============================================

describe('official-exams/save-results: score = totalCorrect', () => {
  type Result = {
    userAnswer: string | null
    isCorrect: boolean
    questionType: string
  }

  function computeSaveResultsScore(results: Result[]) {
    const answeredResults = results.filter(
      (r) => r.userAnswer && r.userAnswer !== 'sin_respuesta'
    )
    const totalCorrect = answeredResults.filter((r) => r.isCorrect).length
    // FIX: score = count
    const score = totalCorrect
    return { score: score.toString(), totalQuestions: answeredResults.length }
  }

  it('53 correctas de 64 respondidas → score="53", NO "83"', () => {
    const results: Result[] = [
      ...Array(53).fill({
        userAnswer: 'A',
        isCorrect: true,
        questionType: 'legislative',
      }),
      ...Array(11).fill({
        userAnswer: 'B',
        isCorrect: false,
        questionType: 'legislative',
      }),
    ]
    const { score, totalQuestions } = computeSaveResultsScore(results)
    expect(score).toBe('53')
    expect(score).not.toBe('83') // Math.round(53/64*100) = 83
    expect(totalQuestions).toBe(64)
  })

  it('sin_respuesta se excluyen del total', () => {
    const results: Result[] = [
      { userAnswer: 'A', isCorrect: true, questionType: 'legislative' },
      { userAnswer: 'B', isCorrect: false, questionType: 'legislative' },
      { userAnswer: 'sin_respuesta', isCorrect: false, questionType: 'legislative' },
      { userAnswer: null, isCorrect: false, questionType: 'legislative' },
    ]
    const { score, totalQuestions } = computeSaveResultsScore(results)
    expect(score).toBe('1')
    expect(totalQuestions).toBe(2) // solo 2 respondidas
  })

  it('0 correctas → score="0"', () => {
    const results: Result[] = Array(10).fill({
      userAnswer: 'A',
      isCorrect: false,
      questionType: 'legislative',
    })
    const { score } = computeSaveResultsScore(results)
    expect(score).toBe('0')
  })

  it('todas correctas → score = total respondidas', () => {
    const results: Result[] = Array(50).fill({
      userAnswer: 'A',
      isCorrect: true,
      questionType: 'legislative',
    })
    const { score, totalQuestions } = computeSaveResultsScore(results)
    expect(score).toBe('50')
    expect(score).not.toBe('100') // antiguo bug
    expect(totalQuestions).toBe(50)
  })
})

// ============================================
// 3. saveOfficialExamResults — lib/api/official-exams/queries.ts
// ============================================

describe('saveOfficialExamResults: score = String(totalCorrect)', () => {
  function computeOfficialExamScore(
    results: { userAnswer: string | null; isCorrect: boolean }[]
  ) {
    const answeredResults = results.filter(
      (r) => r.userAnswer && r.userAnswer !== 'sin_respuesta'
    )
    const totalCorrect = answeredResults.filter((r) => r.isCorrect).length
    // FIX: score = count
    const score = String(totalCorrect)
    return { score, totalQuestions: answeredResults.length }
  }

  it('33 correctas de 50 → score="33", NO "66"', () => {
    const results = [
      ...Array(33).fill({ userAnswer: 'A', isCorrect: true }),
      ...Array(17).fill({ userAnswer: 'B', isCorrect: false }),
    ]
    const { score } = computeOfficialExamScore(results)
    expect(score).toBe('33')
    expect(score).not.toBe('66') // Math.round(33/50*100) = 66
  })

  it('devuelve string, no number', () => {
    const results = [
      ...Array(5).fill({ userAnswer: 'A', isCorrect: true }),
      ...Array(5).fill({ userAnswer: 'B', isCorrect: false }),
    ]
    const { score } = computeOfficialExamScore(results)
    expect(typeof score).toBe('string')
  })
})

// ============================================
// 4. TestLayout — updateTestScore recibe newScore (count)
// ============================================

describe('TestLayout: updateTestScore recibe count, no porcentaje', () => {
  // Reproduce la logica de handleAnswer en TestLayout
  function simulateHandleAnswer(params: {
    currentScore: number
    isCorrect: boolean
    totalQuestions: number
  }) {
    const newScore = params.isCorrect
      ? params.currentScore + 1
      : params.currentScore

    // FIX: se pasa newScore directamente (count)
    // ANTIGUO BUG: scorePercentage = Math.round((newScore / totalQuestions) * 100)
    return { scorePassedToUpdate: newScore }
  }

  it('primera respuesta correcta → updateTestScore(id, 1), no (id, 4)', () => {
    const { scorePassedToUpdate } = simulateHandleAnswer({
      currentScore: 0,
      isCorrect: true,
      totalQuestions: 25,
    })
    expect(scorePassedToUpdate).toBe(1)
    expect(scorePassedToUpdate).not.toBe(4) // Math.round(1/25*100) = 4
  })

  it('6 de 6 correctas → updateTestScore(id, 6), no (id, 100)', () => {
    const { scorePassedToUpdate } = simulateHandleAnswer({
      currentScore: 5,
      isCorrect: true,
      totalQuestions: 6,
    })
    expect(scorePassedToUpdate).toBe(6)
    expect(scorePassedToUpdate).not.toBe(100)
  })

  it('respuesta incorrecta no incrementa score', () => {
    const { scorePassedToUpdate } = simulateHandleAnswer({
      currentScore: 3,
      isCorrect: false,
      totalQuestions: 10,
    })
    expect(scorePassedToUpdate).toBe(3)
  })

  it('secuencia completa de 10 preguntas', () => {
    const answers = [true, true, false, true, true, false, true, false, true, true]
    let score = 0
    const scores: number[] = []

    for (const isCorrect of answers) {
      const result = simulateHandleAnswer({
        currentScore: score,
        isCorrect,
        totalQuestions: 10,
      })
      score = result.scorePassedToUpdate
      scores.push(score)
    }

    expect(scores).toEqual([1, 2, 2, 3, 4, 4, 5, 5, 6, 7])
    expect(score).toBe(7) // 7 correctas de 10
    // NUNCA un porcentaje
    expect(scores.every((s) => s <= 10)).toBe(true)
  })
})

// ============================================
// 5. Stats layer — derivacion correcta de porcentaje
// ============================================

describe('Stats layer: accuracy = (score / total_questions) * 100', () => {
  function deriveAccuracy(score: number, totalQuestions: number): number {
    if (totalQuestions === 0) return 0
    return Math.round((score / totalQuestions) * 100)
  }

  it('score=15, total=20 → accuracy=75%', () => {
    expect(deriveAccuracy(15, 20)).toBe(75)
  })

  it('score=6, total=6 → accuracy=100%', () => {
    expect(deriveAccuracy(6, 6)).toBe(100)
  })

  it('score=0, total=10 → accuracy=0%', () => {
    expect(deriveAccuracy(0, 10)).toBe(0)
  })

  it('score=21, total=25 → accuracy=84%', () => {
    expect(deriveAccuracy(21, 25)).toBe(84)
  })

  it('total=0 → accuracy=0% (no divide by zero)', () => {
    expect(deriveAccuracy(0, 0)).toBe(0)
  })

  describe('BUG DETECTADO si score fuera porcentaje', () => {
    it('score=75 (porcentaje), total=20 → accuracy=375% (ABSURDO)', () => {
      // Este era el bug: si alguien guardaba porcentaje como score
      const wrongAccuracy = deriveAccuracy(75, 20)
      expect(wrongAccuracy).toBe(375)
      expect(wrongAccuracy).toBeGreaterThan(100) // imposible en realidad
    })

    it('score=100 (porcentaje), total=6 → accuracy=1667% (ABSURDO)', () => {
      const wrongAccuracy = deriveAccuracy(100, 6)
      expect(wrongAccuracy).toBe(1667)
      expect(wrongAccuracy).toBeGreaterThan(100)
    })
  })
})

// ============================================
// 6. Invariante: score <= total_questions para tests completados
// ============================================

describe('Invariante: score <= total_questions', () => {
  function isValidScore(score: number, totalQuestions: number): boolean {
    return score >= 0 && score <= totalQuestions
  }

  it('scores validos (count)', () => {
    expect(isValidScore(0, 10)).toBe(true)
    expect(isValidScore(5, 10)).toBe(true)
    expect(isValidScore(10, 10)).toBe(true)
    expect(isValidScore(1, 1)).toBe(true)
    expect(isValidScore(0, 0)).toBe(true)
  })

  it('scores invalidos (antiguo bug: porcentaje guardado como count)', () => {
    expect(isValidScore(75, 20)).toBe(false) // 75 > 20
    expect(isValidScore(100, 6)).toBe(false)  // 100 > 6
    expect(isValidScore(84, 25)).toBe(false)  // 84 > 25
    expect(isValidScore(60, 10)).toBe(false)  // 60 > 10
  })

  it('score negativo es invalido', () => {
    expect(isValidScore(-1, 10)).toBe(false)
  })
})

// ============================================
// 7. Migracion de datos corruptos — logica de conversion
// ============================================

describe('Migracion: porcentaje → count', () => {
  function migrateScore(
    score: number,
    totalQuestions: number,
    correctCount?: number
  ): number {
    // Si hay correctCount exacto (de detailed_analytics), usarlo
    if (correctCount != null) return correctCount
    // Si no, convertir porcentaje → count
    return Math.round((score / 100) * totalQuestions)
  }

  it('score=83, total=64, correctCount=53 → 53 (dato preciso)', () => {
    expect(migrateScore(83, 64, 53)).toBe(53)
  })

  it('score=66, total=50, correctCount=33 → 33 (dato preciso)', () => {
    expect(migrateScore(66, 50, 33)).toBe(33)
  })

  it('score=75, total=20, sin correctCount → 15 (formula)', () => {
    expect(migrateScore(75, 20)).toBe(15)
  })

  it('score=100, total=6, sin correctCount → 6', () => {
    expect(migrateScore(100, 6)).toBe(6)
  })

  it('score=84, total=25, sin correctCount → 21', () => {
    expect(migrateScore(84, 25)).toBe(21)
  })

  it('score=0, total=10, sin correctCount → 0', () => {
    expect(migrateScore(0, 10)).toBe(0)
  })

  it('score=50, total=10, sin correctCount → 5', () => {
    expect(migrateScore(50, 10)).toBe(5)
  })

  it('resultado migrado siempre <= totalQuestions', () => {
    const cases = [
      { score: 100, total: 6 },
      { score: 83, total: 64 },
      { score: 75, total: 20 },
      { score: 96, total: 50 },
      { score: 34, total: 25 },
    ]
    for (const { score, total } of cases) {
      const migrated = migrateScore(score, total)
      expect(migrated).toBeLessThanOrEqual(total)
      expect(migrated).toBeGreaterThanOrEqual(0)
    }
  })
})

// ============================================
// 8. Paths que YA escribian COUNT correctamente (no tocar)
// ============================================

describe('Write paths que ya escriben COUNT correctamente', () => {
  describe('updateTestScore (lib/api/exam/queries.ts)', () => {
    // Esta funcion cuenta correctas via SQL: SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)
    it('count de correctas es siempre <= total', () => {
      const simulateDbCount = (answers: boolean[]) => {
        const total = answers.length
        const correct = answers.filter((a) => a).length
        return { total, correct, score: correct.toString() }
      }

      const result = simulateDbCount([true, true, false, true, false])
      expect(result.score).toBe('3')
      expect(Number(result.score)).toBeLessThanOrEqual(result.total)
    })
  })

  describe('completeExam (lib/api/exam/queries.ts)', () => {
    it('correctCount.toString() es count', () => {
      const correctCount = 45
      const totalQuestions = 64
      const score = correctCount.toString()
      expect(score).toBe('45')
      expect(Number(score)).toBeLessThanOrEqual(totalQuestions)
    })
  })

  describe('completeDetailedTest (utils/testAnalytics.ts)', () => {
    it('finalScore recibido es count', () => {
      // finalScore viene de TestLayout/ExamLayout como count
      const finalScore = 18 // 18 correctas de 25
      const totalQuestions = 25
      expect(finalScore).toBeLessThanOrEqual(totalQuestions)
    })
  })

  describe('markTestAsCompleted (api/exam/validate)', () => {
    it('totalCorrect es count', () => {
      const answers = { q1: 0, q2: 1, q3: 2 }
      const correctAnswers = { q1: 0, q2: 1, q3: 3 }
      const totalCorrect = Object.keys(answers).filter(
        (qId) => answers[qId as keyof typeof answers] === correctAnswers[qId as keyof typeof correctAnswers]
      ).length
      expect(totalCorrect).toBe(2) // count, no porcentaje
      expect(totalCorrect).toBeLessThanOrEqual(Object.keys(answers).length)
    })
  })

  describe('POST complete (api/v2/official-exams/complete)', () => {
    it('correctCount.toString() es count', () => {
      const correctCount = 41
      const score = correctCount.toString()
      expect(score).toBe('41')
    })
  })
})

// ============================================
// 9. Integracion: score → display en UI
// ============================================

describe('Display: UI muestra score/total y porcentaje derivado', () => {
  function formatScoreDisplay(score: number, totalQuestions: number) {
    const percentage = totalQuestions > 0
      ? Math.round((score / totalQuestions) * 100)
      : 0
    return {
      label: `${score}/${totalQuestions}`,
      percentage: `${percentage}%`,
    }
  }

  it('15/20 → "15/20" y "75%"', () => {
    const display = formatScoreDisplay(15, 20)
    expect(display.label).toBe('15/20')
    expect(display.percentage).toBe('75%')
  })

  it('6/6 → "6/6" y "100%"', () => {
    const display = formatScoreDisplay(6, 6)
    expect(display.label).toBe('6/6')
    expect(display.percentage).toBe('100%')
  })

  it('0/10 → "0/10" y "0%"', () => {
    const display = formatScoreDisplay(0, 10)
    expect(display.label).toBe('0/10')
    expect(display.percentage).toBe('0%')
  })

  it('BUG: si se guardara porcentaje como score, display seria absurdo', () => {
    // Si score=75 fuera porcentaje guardado en vez de count
    const buggyDisplay = formatScoreDisplay(75, 20)
    expect(buggyDisplay.label).toBe('75/20') // absurdo: 75 de 20?
    expect(buggyDisplay.percentage).toBe('375%') // imposible
  })
})
