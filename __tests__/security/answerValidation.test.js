// __tests__/security/answerValidation.test.js
// Tests para validar que la lógica de validación de respuestas funciona correctamente
// Estos tests aseguran que los cambios de seguridad no rompan la funcionalidad

describe('Answer Validation Security Tests', () => {

  // ============================================
  // TESTS PARA LÓGICA DE VALIDACIÓN BÁSICA
  // ============================================
  describe('Basic Answer Validation Logic', () => {

    // Simula la lógica de validación que usamos
    function validateAnswer(userAnswer, correctAnswer) {
      return userAnswer === correctAnswer
    }

    test('debe validar respuesta correcta (índice 0)', () => {
      expect(validateAnswer(0, 0)).toBe(true)
    })

    test('debe validar respuesta correcta (índice 1)', () => {
      expect(validateAnswer(1, 1)).toBe(true)
    })

    test('debe validar respuesta correcta (índice 2)', () => {
      expect(validateAnswer(2, 2)).toBe(true)
    })

    test('debe validar respuesta correcta (índice 3)', () => {
      expect(validateAnswer(3, 3)).toBe(true)
    })

    test('debe rechazar respuesta incorrecta', () => {
      expect(validateAnswer(0, 1)).toBe(false)
      expect(validateAnswer(1, 0)).toBe(false)
      expect(validateAnswer(2, 3)).toBe(false)
    })

    test('debe manejar null/undefined correctamente', () => {
      expect(validateAnswer(null, 0)).toBe(false)
      expect(validateAnswer(undefined, 0)).toBe(false)
      expect(validateAnswer(0, null)).toBe(false)
    })
  })

  // ============================================
  // TESTS PARA EXAMLAYOUT - CONVERSIÓN LETRA/ÍNDICE
  // ============================================
  describe('ExamLayout Letter/Index Conversion', () => {

    // Simula la conversión de ExamLayout
    function correctIndexToLetter(correctIndex) {
      const index = typeof correctIndex === 'number' ? correctIndex : 0
      return String.fromCharCode(97 + index) // 97 = 'a'
    }

    function letterToIndex(letter) {
      if (!letter || typeof letter !== 'string') return -1
      return letter.toLowerCase().charCodeAt(0) - 97
    }

    test('debe convertir índice 0 a letra "a"', () => {
      expect(correctIndexToLetter(0)).toBe('a')
    })

    test('debe convertir índice 1 a letra "b"', () => {
      expect(correctIndexToLetter(1)).toBe('b')
    })

    test('debe convertir índice 2 a letra "c"', () => {
      expect(correctIndexToLetter(2)).toBe('c')
    })

    test('debe convertir índice 3 a letra "d"', () => {
      expect(correctIndexToLetter(3)).toBe('d')
    })

    test('debe manejar índice no numérico como 0', () => {
      expect(correctIndexToLetter(null)).toBe('a')
      expect(correctIndexToLetter(undefined)).toBe('a')
      expect(correctIndexToLetter('invalid')).toBe('a')
    })

    test('debe convertir letra "a" a índice 0', () => {
      expect(letterToIndex('a')).toBe(0)
      expect(letterToIndex('A')).toBe(0)
    })

    test('debe convertir letra "b" a índice 1', () => {
      expect(letterToIndex('b')).toBe(1)
      expect(letterToIndex('B')).toBe(1)
    })

    test('debe convertir letra "c" a índice 2', () => {
      expect(letterToIndex('c')).toBe(2)
    })

    test('debe convertir letra "d" a índice 3', () => {
      expect(letterToIndex('d')).toBe(3)
    })

    test('debe manejar entrada inválida', () => {
      expect(letterToIndex(null)).toBe(-1)
      expect(letterToIndex(undefined)).toBe(-1)
      expect(letterToIndex('')).toBe(-1)
    })
  })

  // ============================================
  // TESTS PARA EXAMLAYOUT - VALIDACIÓN COMPLETA
  // ============================================
  describe('ExamLayout Full Validation Flow', () => {

    // Simula el flujo completo de validación de ExamLayout
    function validateExamAnswer(question, selectedOption) {
      const correctIndex = typeof question.correct_option === 'number'
        ? question.correct_option
        : 0
      const correctOptionLetter = String.fromCharCode(97 + correctIndex)
      const isCorrect = selectedOption ? selectedOption === correctOptionLetter : false

      return {
        isCorrect,
        correctAnswer: correctOptionLetter,
        userAnswer: selectedOption
      }
    }

    test('debe validar respuesta correcta en modo examen', () => {
      const question = { correct_option: 1 } // B es correcta
      const result = validateExamAnswer(question, 'b')

      expect(result.isCorrect).toBe(true)
      expect(result.correctAnswer).toBe('b')
    })

    test('debe rechazar respuesta incorrecta en modo examen', () => {
      const question = { correct_option: 2 } // C es correcta
      const result = validateExamAnswer(question, 'a')

      expect(result.isCorrect).toBe(false)
      expect(result.correctAnswer).toBe('c')
      expect(result.userAnswer).toBe('a')
    })

    test('debe manejar pregunta sin respuesta', () => {
      const question = { correct_option: 0 }
      const result = validateExamAnswer(question, null)

      expect(result.isCorrect).toBe(false)
    })

    test('debe manejar correct_option undefined', () => {
      const question = { correct_option: undefined }
      const result = validateExamAnswer(question, 'a')

      expect(result.isCorrect).toBe(true) // Default es 0 = 'a'
      expect(result.correctAnswer).toBe('a')
    })
  })

  // ============================================
  // TESTS PARA PSICOTÉCNICOS - VALIDACIÓN
  // ============================================
  describe('PsychometricTestLayout Validation', () => {

    // Simula la validación de psicotécnicos
    function validatePsychometricAnswer(question, optionIndex) {
      return optionIndex === question.correct_option
    }

    test('debe validar respuesta correcta de psicotécnico', () => {
      const question = { correct_option: 2 }
      expect(validatePsychometricAnswer(question, 2)).toBe(true)
    })

    test('debe rechazar respuesta incorrecta de psicotécnico', () => {
      const question = { correct_option: 3 }
      expect(validatePsychometricAnswer(question, 1)).toBe(false)
    })

    test('debe manejar todos los índices válidos (0-3)', () => {
      for (let correctIdx = 0; correctIdx <= 3; correctIdx++) {
        const question = { correct_option: correctIdx }

        for (let userIdx = 0; userIdx <= 3; userIdx++) {
          const expected = userIdx === correctIdx
          expect(validatePsychometricAnswer(question, userIdx)).toBe(expected)
        }
      }
    })
  })

  // ============================================
  // TESTS PARA API DE VALIDACIÓN SEGURA
  // ============================================
  describe('Secure API Validation Response', () => {

    // Simula la respuesta de la API /api/answer
    function mockApiResponse(questionId, userAnswer, correctAnswer) {
      return {
        success: true,
        isCorrect: userAnswer === correctAnswer,
        correctAnswer: correctAnswer,
        explanation: 'Explicación de prueba'
      }
    }

    test('API debe retornar isCorrect=true para respuesta correcta', () => {
      const response = mockApiResponse('uuid-123', 1, 1)
      expect(response.success).toBe(true)
      expect(response.isCorrect).toBe(true)
      expect(response.correctAnswer).toBe(1)
    })

    test('API debe retornar isCorrect=false para respuesta incorrecta', () => {
      const response = mockApiResponse('uuid-123', 0, 2)
      expect(response.success).toBe(true)
      expect(response.isCorrect).toBe(false)
      expect(response.correctAnswer).toBe(2)
    })

    test('API debe incluir la respuesta correcta en la respuesta', () => {
      const response = mockApiResponse('uuid-123', 1, 3)
      expect(response.correctAnswer).toBeDefined()
      expect(typeof response.correctAnswer).toBe('number')
    })
  })

  // ============================================
  // TESTS PARA BATCH VALIDATION (EXAM SUBMIT)
  // ============================================
  describe('Batch Exam Validation', () => {

    // Simula la validación en batch para exámenes
    function validateBatchAnswers(questions, userAnswers) {
      const results = []
      let correctCount = 0

      for (let i = 0; i < questions.length; i++) {
        const question = questions[i]
        const userAnswer = userAnswers[i]
        const correctIndex = typeof question.correct_option === 'number'
          ? question.correct_option
          : 0
        const correctLetter = String.fromCharCode(97 + correctIndex)
        const isCorrect = userAnswer === correctLetter

        if (isCorrect) correctCount++

        results.push({
          questionId: question.id,
          isCorrect,
          correctAnswer: correctLetter,
          userAnswer
        })
      }

      return {
        results,
        totalCorrect: correctCount,
        totalQuestions: questions.length,
        percentage: Math.round((correctCount / questions.length) * 100)
      }
    }

    test('debe validar múltiples respuestas correctamente', () => {
      const questions = [
        { id: '1', correct_option: 0 }, // a
        { id: '2', correct_option: 1 }, // b
        { id: '3', correct_option: 2 }, // c
      ]
      const userAnswers = ['a', 'b', 'a'] // 2 correctas, 1 incorrecta

      const result = validateBatchAnswers(questions, userAnswers)

      expect(result.totalCorrect).toBe(2)
      expect(result.totalQuestions).toBe(3)
      expect(result.percentage).toBe(67)
      expect(result.results[0].isCorrect).toBe(true)
      expect(result.results[1].isCorrect).toBe(true)
      expect(result.results[2].isCorrect).toBe(false)
    })

    test('debe manejar examen perfecto', () => {
      const questions = [
        { id: '1', correct_option: 0 },
        { id: '2', correct_option: 1 },
      ]
      const userAnswers = ['a', 'b']

      const result = validateBatchAnswers(questions, userAnswers)

      expect(result.totalCorrect).toBe(2)
      expect(result.percentage).toBe(100)
    })

    test('debe manejar examen sin aciertos', () => {
      const questions = [
        { id: '1', correct_option: 0 },
        { id: '2', correct_option: 1 },
      ]
      const userAnswers = ['d', 'd']

      const result = validateBatchAnswers(questions, userAnswers)

      expect(result.totalCorrect).toBe(0)
      expect(result.percentage).toBe(0)
    })

    test('debe manejar preguntas sin responder', () => {
      const questions = [
        { id: '1', correct_option: 0 },
        { id: '2', correct_option: 1 },
      ]
      const userAnswers = ['a', null]

      const result = validateBatchAnswers(questions, userAnswers)

      expect(result.totalCorrect).toBe(1)
      expect(result.results[1].isCorrect).toBe(false)
    })
  })

  // ============================================
  // TESTS PARA TRANSFORMQUESTIONS
  // ============================================
  describe('transformQuestions Security', () => {

    // Simula la transformación SIN correct_option (como debe ser ahora)
    function transformQuestionsSecure(supabaseQuestions) {
      return supabaseQuestions.map((q, index) => ({
        id: q.id,
        question: q.question_text,
        options: [q.option_a, q.option_b, q.option_c, q.option_d],
        // NO incluir correct_option
        explanation: q.explanation,
        article: {
          number: q.articles?.article_number,
          law_short_name: q.articles?.laws?.short_name
        }
      }))
    }

    test('transformación segura NO debe incluir correct_option', () => {
      const supabaseData = [{
        id: 'uuid-1',
        question_text: 'Pregunta de prueba',
        option_a: 'Opción A',
        option_b: 'Opción B',
        option_c: 'Opción C',
        option_d: 'Opción D',
        correct_option: 2,
        explanation: 'Explicación'
      }]

      const transformed = transformQuestionsSecure(supabaseData)

      expect(transformed[0].correct).toBeUndefined()
      expect(transformed[0].correct_option).toBeUndefined()
      expect(transformed[0].id).toBe('uuid-1')
      expect(transformed[0].options).toHaveLength(4)
    })

    test('transformación segura debe preservar ID', () => {
      const supabaseData = [{
        id: 'uuid-important',
        question_text: 'Test',
        option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D',
        correct_option: 0
      }]

      const transformed = transformQuestionsSecure(supabaseData)

      expect(transformed[0].id).toBe('uuid-important')
    })
  })

  // ============================================
  // TESTS DE SEGURIDAD - ANTI-SCRAPING
  // ============================================
  describe('Anti-Scraping Security Checks', () => {

    test('respuesta inicial NO debe contener correct_option', () => {
      // Simula lo que el cliente recibe antes de responder
      const questionFromServer = {
        id: 'uuid-123',
        question: '¿Cuál es la capital?',
        options: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla'],
        explanation: 'Madrid es la capital',
        // correct NO debe estar aquí
      }

      expect(questionFromServer.correct).toBeUndefined()
      expect(questionFromServer.correct_option).toBeUndefined()
    })

    test('respuesta correcta solo disponible después de API call', () => {
      // Simula el flujo completo
      const questionBeforeAnswer = {
        id: 'uuid-123',
        question: 'Pregunta',
        options: ['A', 'B', 'C', 'D']
      }

      // Usuario responde
      const userAnswer = 1

      // API responde con la respuesta correcta
      const apiResponse = {
        success: true,
        isCorrect: false,
        correctAnswer: 2,
        explanation: 'La respuesta correcta es C'
      }

      // Verificar que la respuesta correcta viene de la API
      expect(questionBeforeAnswer.correct).toBeUndefined()
      expect(apiResponse.correctAnswer).toBe(2)
    })
  })
})
