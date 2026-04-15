// __tests__/components/TestLayoutV2Blank.test.ts
//
// Tests de la feature "Dejar en blanco" en TestLayoutV2 (15/4/2026).
// Opción A elegida: UX-only, SIN persistencia (validateAnswer con -1 solo
// devuelve correctAnswer, no guarda en BD). Por tanto los invariantes aquí
// difieren de TestLayout clásico: no hay payload al servidor de persistencia.

describe('TestLayoutV2 - feature "Dejar en blanco" (UX-only)', () => {

  // ============================================
  // Transiciones de estado de handleBlankClick
  // ============================================
  describe('Transiciones de estado al dejar en blanco', () => {
    function applyBlankStateTransition(state: {
      selectedAnswer: number | null
      isBlank: boolean
      showResult: boolean
      verifiedCorrectAnswer: number | null
      score: number
      interactionCount: number
    }, correctOption: number) {
      return {
        selectedAnswer: null,
        isBlank: true,
        showResult: true,
        verifiedCorrectAnswer: correctOption,
        score: state.score, // score NO cambia
        interactionCount: state.interactionCount + 1,
      }
    }

    test('deja en blanco: selectedAnswer=null, isBlank=true, showResult=true', () => {
      const before = { selectedAnswer: null, isBlank: false, showResult: false, verifiedCorrectAnswer: null, score: 2, interactionCount: 0 }
      const after = applyBlankStateTransition(before, 3)
      expect(after.selectedAnswer).toBeNull()
      expect(after.isBlank).toBe(true)
      expect(after.showResult).toBe(true)
      expect(after.verifiedCorrectAnswer).toBe(3)
    })

    test('score no cambia', () => {
      const before = { selectedAnswer: null, isBlank: false, showResult: false, verifiedCorrectAnswer: null, score: 7, interactionCount: 0 }
      const after = applyBlankStateTransition(before, 1)
      expect(after.score).toBe(7)
    })

    test('interactionCount incrementa', () => {
      const before = { selectedAnswer: null, isBlank: false, showResult: false, verifiedCorrectAnswer: null, score: 0, interactionCount: 4 }
      const after = applyBlankStateTransition(before, 2)
      expect(after.interactionCount).toBe(5)
    })
  })

  // ============================================
  // answeredQuestions y detailedAnswers para blanco
  // ============================================
  describe('Registro de entry blanco en arrays locales', () => {
    function makeBlankEntry(questionIndex: number) {
      return {
        question: questionIndex,
        selectedAnswer: -1,
        correct: false,
        timestamp: new Date().toISOString(),
      }
    }

    function makeBlankDetailed(questionIndex: number, correctAnswer: number, timeSpent: number) {
      return {
        questionIndex,
        questionOrder: questionIndex + 1,
        selectedAnswer: -1,
        correctAnswer,
        isCorrect: false,
        timeSpent,
        timestamp: new Date().toISOString(),
      }
    }

    test('answeredQuestions: selectedAnswer=-1, correct=false', () => {
      const e = makeBlankEntry(3)
      expect(e.selectedAnswer).toBe(-1)
      expect(e.correct).toBe(false)
    })

    test('detailedAnswers: isCorrect=false incluso si correctAnswer coincidiera', () => {
      const d = makeBlankDetailed(5, 2, 15)
      expect(d.isCorrect).toBe(false)
      expect(d.selectedAnswer).toBe(-1)
      expect(d.correctAnswer).toBe(2)
    })

    test('% aciertos incluye blancas en denominador (sin exploit 100%)', () => {
      const entries = [
        ...Array.from({ length: 9 }, (_, i) => makeBlankEntry(i)),
        { question: 9, selectedAnswer: 2, correct: true, timestamp: '' },
      ]
      const total = entries.length
      const correct = entries.filter(e => e.correct).length
      expect((correct / total) * 100).toBe(10) // 1/10, no 100
    })
  })

  // ============================================
  // Reset al navegar a siguiente pregunta
  // ============================================
  describe('Reset de isBlank en handleNextQuestion', () => {
    function applyNextReset(state: {
      currentQuestion: number
      selectedAnswer: number | null
      isBlank: boolean
      showResult: boolean
      verifiedCorrectAnswer: number | null
    }) {
      return {
        currentQuestion: state.currentQuestion + 1,
        selectedAnswer: null,
        isBlank: false,
        showResult: false,
        verifiedCorrectAnswer: null,
      }
    }

    test('tras next, isBlank=false', () => {
      const s = { currentQuestion: 2, selectedAnswer: null, isBlank: true, showResult: true, verifiedCorrectAnswer: 1 }
      const n = applyNextReset(s)
      expect(n.isBlank).toBe(false)
      expect(n.currentQuestion).toBe(3)
      expect(n.verifiedCorrectAnswer).toBeNull()
    })

    test('reset también tras respuesta normal', () => {
      const s = { currentQuestion: 2, selectedAnswer: 1, isBlank: false, showResult: true, verifiedCorrectAnswer: 1 }
      const n = applyNextReset(s)
      expect(n.isBlank).toBe(false)
      expect(n.selectedAnswer).toBeNull()
    })
  })

  // ============================================
  // currentResult enviado a QuestionEvolution
  // ============================================
  describe('currentResult para QuestionEvolution con was_blank', () => {
    function buildCurrentResult(isBlank: boolean, selectedAnswer: number | null, verifiedCorrect: number | null, timeSpent: number) {
      return {
        is_correct: !isBlank && verifiedCorrect !== null && selectedAnswer === verifiedCorrect,
        was_blank: isBlank,
        time_spent_seconds: timeSpent,
        confidence_level: null,
      }
    }

    test('blanco: was_blank=true, is_correct=false', () => {
      const r = buildCurrentResult(true, null, 2, 10)
      expect(r.was_blank).toBe(true)
      expect(r.is_correct).toBe(false)
    })

    test('acierto: was_blank=false, is_correct=true', () => {
      const r = buildCurrentResult(false, 2, 2, 8)
      expect(r.was_blank).toBe(false)
      expect(r.is_correct).toBe(true)
    })

    test('fallo: was_blank=false, is_correct=false', () => {
      const r = buildCurrentResult(false, 1, 2, 8)
      expect(r.was_blank).toBe(false)
      expect(r.is_correct).toBe(false)
    })

    test('blanco nunca se marca como correcto aunque selectedAnswer coincida (defensa)', () => {
      const r = buildCurrentResult(true, 2, 2, 5)
      expect(r.is_correct).toBe(false)
    })
  })
})
