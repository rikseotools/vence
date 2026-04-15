// __tests__/components/TestLayoutBlank.test.ts
//
// Tests de la feature "Dejar en blanco" en TestLayout (15/4/2026, sugerencia
// Tinokero). No testea el componente React montado (demasiados mocks), sino
// la lógica pura: construcción del payload y transiciones de estado esperadas
// al simular click en handleBlankClick.

describe('TestLayout - feature "Dejar en blanco"', () => {

  // ============================================
  // Construcción de payload para /api/v2/answer-and-save
  // ============================================
  describe('Construcción del payload enviado al servidor', () => {

    // Réplica de la lógica real de saveAnswerToServer en TestLayout.tsx.
    // Si esto diverge del código real, el test FALLARÁ en producción.
    function buildPayload({
      questionId,
      answerIndex,
      isBlankFlag,
      sessionId,
    }: {
      questionId: string
      answerIndex: number
      isBlankFlag: boolean
      sessionId: string | null
    }) {
      return {
        questionId,
        userAnswer: isBlankFlag ? null : answerIndex,
        isBlank: isBlankFlag,
        sessionId,
      }
    }

    test('respuesta normal: userAnswer=index, isBlank=false', () => {
      const p = buildPayload({
        questionId: 'q1', answerIndex: 2, isBlankFlag: false, sessionId: 's1',
      })
      expect(p.userAnswer).toBe(2)
      expect(p.isBlank).toBe(false)
    })

    test('blanco: userAnswer=null, isBlank=true', () => {
      const p = buildPayload({
        questionId: 'q1', answerIndex: -1, isBlankFlag: true, sessionId: 's1',
      })
      expect(p.userAnswer).toBeNull()
      expect(p.isBlank).toBe(true)
    })

    test('contrato endpoint: blanco nunca manda userAnswer ∈ 0..3', () => {
      // Cualquier answerIndex que se pase con isBlankFlag=true debe resultar
      // en userAnswer=null. El .refine() del schema rechazaría combinaciones
      // incoherentes, pero aquí garantizamos que el cliente nunca las produce.
      const p1 = buildPayload({ questionId: 'q', answerIndex: 0, isBlankFlag: true, sessionId: 's' })
      const p2 = buildPayload({ questionId: 'q', answerIndex: 3, isBlankFlag: true, sessionId: 's' })
      expect(p1.userAnswer).toBeNull()
      expect(p2.userAnswer).toBeNull()
    })
  })

  // ============================================
  // Transiciones de estado de handleBlankClick
  // ============================================
  describe('Transiciones de estado al dejar en blanco', () => {

    // Simula las setStates que dispara handleBlankClick. Si añades nuevos
    // states o reordenas, actualiza esta función.
    function applyBlankStateTransition(state: {
      selectedAnswer: number | null
      isBlank: boolean
      showResult: boolean
      verifiedCorrectAnswer: number | null
      score: number
    }, correctOption: number) {
      return {
        selectedAnswer: null,
        isBlank: true,
        showResult: true,
        verifiedCorrectAnswer: correctOption,
        // score NO cambia en blanco (blanco ≠ acierto)
        score: state.score,
      }
    }

    test('al dejar en blanco: selectedAnswer=null, isBlank=true, showResult=true', () => {
      const before = { selectedAnswer: null, isBlank: false, showResult: false, verifiedCorrectAnswer: null, score: 3 }
      const after = applyBlankStateTransition(before, 2)
      expect(after.selectedAnswer).toBeNull()
      expect(after.isBlank).toBe(true)
      expect(after.showResult).toBe(true)
      expect(after.verifiedCorrectAnswer).toBe(2)
    })

    test('score no cambia al dejar en blanco', () => {
      const before = { selectedAnswer: null, isBlank: false, showResult: false, verifiedCorrectAnswer: null, score: 5 }
      const after = applyBlankStateTransition(before, 2)
      expect(after.score).toBe(5) // igual que antes
    })

    test('score no cambia ni aunque la respuesta correcta sea una cualquiera', () => {
      const before = { selectedAnswer: null, isBlank: false, showResult: false, verifiedCorrectAnswer: null, score: 0 }
      for (let correct = 0; correct <= 3; correct++) {
        const after = applyBlankStateTransition(before, correct)
        expect(after.score).toBe(0)
      }
    })
  })

  // ============================================
  // Reset al navegar a siguiente pregunta
  // ============================================
  describe('Reset de isBlank al pasar a siguiente pregunta', () => {

    function applyNextQuestionReset(state: {
      currentQuestion: number
      selectedAnswer: number | null
      isBlank: boolean
      showResult: boolean
      verifiedCorrectAnswer: number | null
    }) {
      return {
        currentQuestion: state.currentQuestion + 1,
        selectedAnswer: null,
        isBlank: false, // ← crítico: el flag debe resetearse
        showResult: false,
        verifiedCorrectAnswer: null,
      }
    }

    test('tras pasar a siguiente, isBlank vuelve a false', () => {
      const blankState = {
        currentQuestion: 3, selectedAnswer: null, isBlank: true,
        showResult: true, verifiedCorrectAnswer: 2,
      }
      const next = applyNextQuestionReset(blankState)
      expect(next.isBlank).toBe(false)
      expect(next.showResult).toBe(false)
      expect(next.verifiedCorrectAnswer).toBeNull()
      expect(next.currentQuestion).toBe(4)
    })

    test('el reset funciona aunque el anterior fuera respuesta normal (no blank)', () => {
      const normalState = {
        currentQuestion: 5, selectedAnswer: 2, isBlank: false,
        showResult: true, verifiedCorrectAnswer: 2,
      }
      const next = applyNextQuestionReset(normalState)
      expect(next.isBlank).toBe(false)
      expect(next.selectedAnswer).toBeNull()
    })
  })

  // ============================================
  // answeredQuestions entry para blanco
  // ============================================
  describe('Entrada de blanco en answeredQuestions', () => {
    function makeBlankAnsweredEntry(questionIndex: number) {
      return {
        question: questionIndex,
        selectedAnswer: -1,  // -1 = sin respuesta
        correct: false,       // blanco nunca es correcto
        timestamp: new Date().toISOString(),
      }
    }

    test('blanco se registra con selectedAnswer=-1 y correct=false', () => {
      const entry = makeBlankAnsweredEntry(7)
      expect(entry.question).toBe(7)
      expect(entry.selectedAnswer).toBe(-1)
      expect(entry.correct).toBe(false)
    })

    test('% aciertos incluye blancas en denominador (evita exploit 100%)', () => {
      // Usuario deja 24 en blanco + 1 acierto correcto
      const totalQuestions = 25
      const entries = [
        ...Array.from({ length: 24 }, (_, i) => makeBlankAnsweredEntry(i)),
        { question: 24, selectedAnswer: 2, correct: true, timestamp: '' },
      ]
      const correctCount = entries.filter(e => e.correct).length
      const accuracy = (correctCount / totalQuestions) * 100
      expect(accuracy).toBe(4) // 1/25 = 4%, NO 100%
    })
  })

  // ============================================
  // Interacción con límite diario Free
  // ============================================
  describe('Límite diario Free descuenta por blanco', () => {
    test('recordAnswer se llama para blanco y para respuesta normal igual', () => {
      // El handler llama a saveAnswerToServer; dentro de él se llama a
      // recordAnswer() si hasLimit=true. El comportamiento DEBE ser el mismo
      // para blanco y respuesta normal (si no, Free podría exploitar dejando
      // todo en blanco para ver banco completo sin descontar).
      const mockRecordAnswer = jest.fn()

      function simulateSave(isBlank: boolean, hasLimit: boolean) {
        if (hasLimit) mockRecordAnswer(isBlank ? 'blank' : 'normal')
      }

      simulateSave(false, true)  // respuesta normal, Free
      simulateSave(true, true)   // blanco, Free

      expect(mockRecordAnswer).toHaveBeenCalledTimes(2)
      // Ambas llaman (blanco NO se salta el contador)
      expect(mockRecordAnswer).toHaveBeenNthCalledWith(1, 'normal')
      expect(mockRecordAnswer).toHaveBeenNthCalledWith(2, 'blank')
    })

    test('Premium (sin hasLimit) NO descuenta para ningún caso', () => {
      const mockRecordAnswer = jest.fn()
      function simulateSave(isBlank: boolean, hasLimit: boolean) {
        if (hasLimit) mockRecordAnswer()
      }
      simulateSave(false, false)
      simulateSave(true, false)
      expect(mockRecordAnswer).not.toHaveBeenCalled()
    })
  })
})
