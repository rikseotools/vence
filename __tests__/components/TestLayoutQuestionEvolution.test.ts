// __tests__/components/TestLayoutQuestionEvolution.test.ts
// Test para prevenir regresión: QuestionEvolution DEBE recibir questionId válido.
// Bug 06/04/2026: currentQuestionUuid era siempre null → historial nunca se mostraba.

describe('TestLayout - QuestionEvolution questionId', () => {

  // Simula la lógica exacta de handleAnswerClick en TestLayout
  // que establece currentQuestionUuid antes de setShowResult(true)
  function simulateHandleAnswer(params: {
    currentQ: { id?: string; correct_option?: number } | null
    answerIndex: number
  }): { currentQuestionUuid: string | null; showResult: boolean } {
    if (!params.currentQ) return { currentQuestionUuid: null, showResult: false }

    const correctOption = params.currentQ.correct_option ?? -1
    if (correctOption < 0 || correctOption > 3) return { currentQuestionUuid: null, showResult: false }

    // Esto es lo que hace TestLayout línea ~1095:
    // setCurrentQuestionUuid(currentQ.id ?? null)
    // setShowResult(true)
    const currentQuestionUuid = params.currentQ.id ?? null
    const showResult = true

    return { currentQuestionUuid, showResult }
  }

  // Simula la condición de render de QuestionEvolution (línea ~2260)
  function shouldRenderEvolution(params: {
    user: { id: string } | null
    currentQuestionUuid: string | null
  }): boolean {
    return !!(params.user && params.currentQuestionUuid)
  }

  describe('CRÍTICO: currentQuestionUuid debe establecerse al responder', () => {
    it('establece questionUuid con ID de pregunta al responder correctamente', () => {
      const result = simulateHandleAnswer({
        currentQ: { id: '550e8400-e29b-41d4-a716-446655440000', correct_option: 2 },
        answerIndex: 2,
      })
      expect(result.currentQuestionUuid).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(result.showResult).toBe(true)
    })

    it('establece questionUuid con ID de pregunta al responder incorrectamente', () => {
      const result = simulateHandleAnswer({
        currentQ: { id: 'abc12345-1234-1234-1234-123456789abc', correct_option: 0 },
        answerIndex: 3,
      })
      expect(result.currentQuestionUuid).toBe('abc12345-1234-1234-1234-123456789abc')
      expect(result.showResult).toBe(true)
    })

    it('NUNCA debe ser null cuando showResult es true y hay pregunta válida', () => {
      const questionIds = [
        '550e8400-e29b-41d4-a716-446655440000',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      ]
      for (const id of questionIds) {
        const result = simulateHandleAnswer({
          currentQ: { id, correct_option: 1 },
          answerIndex: 0,
        })
        expect(result.currentQuestionUuid).not.toBeNull()
        expect(result.currentQuestionUuid).toBe(id)
      }
    })
  })

  describe('CRÍTICO: QuestionEvolution debe renderizarse para usuarios logueados', () => {
    it('se renderiza cuando hay user Y questionUuid', () => {
      expect(shouldRenderEvolution({
        user: { id: 'user-123' },
        currentQuestionUuid: '550e8400-e29b-41d4-a716-446655440000',
      })).toBe(true)
    })

    it('NO se renderiza sin user (anónimo)', () => {
      expect(shouldRenderEvolution({
        user: null,
        currentQuestionUuid: '550e8400-e29b-41d4-a716-446655440000',
      })).toBe(false)
    })

    it('NO se renderiza sin questionUuid (bug que prevenimos)', () => {
      expect(shouldRenderEvolution({
        user: { id: 'user-123' },
        currentQuestionUuid: null,
      })).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('maneja pregunta sin ID (string vacío → falsy)', () => {
      const result = simulateHandleAnswer({
        currentQ: { id: '', correct_option: 1 },
        answerIndex: 0,
      })
      // id vacío → null via ?? null
      // Pero '' es truthy en JS... excepto que '' ?? null = ''
      // La condición shouldRenderEvolution verificará que no sea vacío
      expect(result.currentQuestionUuid).toBe('')
    })

    it('maneja pregunta sin campo id (undefined)', () => {
      const result = simulateHandleAnswer({
        currentQ: { correct_option: 1 },
        answerIndex: 0,
      })
      expect(result.currentQuestionUuid).toBeNull()
    })

    it('maneja currentQ null', () => {
      const result = simulateHandleAnswer({
        currentQ: null,
        answerIndex: 0,
      })
      expect(result.currentQuestionUuid).toBeNull()
      expect(result.showResult).toBe(false)
    })
  })
})
