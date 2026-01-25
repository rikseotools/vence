/**
 * Tests para la transformación de datos de OfficialExamLayout
 * Previene bugs como:
 * - Campos null en test_questions (NOT NULL constraints)
 * - Referencias incorrectas entre tablas (legislativas vs psicotécnicas)
 *
 * ARQUITECTURA:
 * - Preguntas legislativas: question_id -> tabla 'questions'
 * - Preguntas psicotécnicas: psychometric_question_id -> tabla 'psychometric_questions'
 * - Ambos tipos se guardan en test_questions para estadísticas unificadas
 */

describe('OfficialExamLayout - Transformación de datos para test_questions', () => {
  // Simular la función de transformación del componente (TODAS las preguntas)
  const transformQuestionForSave = (q, index, result, userAnswer, testId) => {
    const isLegislative = q.questionType === 'legislative'

    return {
      test_id: testId,
      question_id: isLegislative ? q.id : null,
      psychometric_question_id: isLegislative ? null : q.id,
      question_order: index + 1,
      question_text: q.questionText || q.question || 'Pregunta sin texto',
      user_answer: userAnswer || 'sin_respuesta',
      correct_answer: result?.correctAnswer || 'unknown',
      is_correct: result?.isCorrect || false,
      time_spent_seconds: 0,
      article_number: isLegislative ? (q.articleNumber || null) : null,
      law_name: isLegislative ? (q.lawName || null) : null,
      tema_number: null,
      difficulty: q.difficulty || 'medium',
      question_type: q.questionType || 'legislative'
    }
  }

  // Simular la transformación que hace el componente (TODAS las preguntas)
  const transformAllQuestions = (questions, allResults, userAnswers, testId) => {
    return questions.map((q, index) => {
      const result = allResults[index]
      const answer = userAnswers[index] || null
      return transformQuestionForSave(q, index, result, answer, testId)
    })
  }

  describe('Campos requeridos (NOT NULL en BD)', () => {
    it('question_text nunca debe ser null o undefined', () => {
      const testCases = [
        { id: '1', questionText: 'Texto normal' },
        { id: '2', question: 'Campo alternativo' },
        { id: '3' }, // Sin ningún campo de texto
        { id: '4', questionText: null },
        { id: '5', questionText: '', question: '' },
      ]

      testCases.forEach((q, index) => {
        const result = transformQuestionForSave(q, index, null, null, 'test-id')
        expect(result.question_text).toBeTruthy()
        expect(typeof result.question_text).toBe('string')
        expect(result.question_text.length).toBeGreaterThan(0)
      })
    })

    it('user_answer nunca debe ser null', () => {
      const question = { id: '1', questionText: 'Test' }

      const withAnswer = transformQuestionForSave(question, 0, null, 'a', 'test-id')
      expect(withAnswer.user_answer).toBe('a')

      const withoutAnswer = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(withoutAnswer.user_answer).toBe('sin_respuesta')

      const withEmptyAnswer = transformQuestionForSave(question, 0, null, '', 'test-id')
      expect(withEmptyAnswer.user_answer).toBe('sin_respuesta')
    })

    it('correct_answer nunca debe ser null', () => {
      const question = { id: '1', questionText: 'Test' }

      const withResult = transformQuestionForSave(question, 0, { correctAnswer: 'b' }, null, 'test-id')
      expect(withResult.correct_answer).toBe('b')

      const withoutResult = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(withoutResult.correct_answer).toBe('unknown')

      const withEmptyResult = transformQuestionForSave(question, 0, {}, null, 'test-id')
      expect(withEmptyResult.correct_answer).toBe('unknown')
    })

    it('is_correct debe ser boolean', () => {
      const question = { id: '1', questionText: 'Test' }

      const correct = transformQuestionForSave(question, 0, { isCorrect: true }, null, 'test-id')
      expect(correct.is_correct).toBe(true)

      const incorrect = transformQuestionForSave(question, 0, { isCorrect: false }, null, 'test-id')
      expect(incorrect.is_correct).toBe(false)

      const noResult = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(noResult.is_correct).toBe(false)
    })

    it('question_order debe ser entero positivo', () => {
      const question = { id: '1', questionText: 'Test' }

      for (let i = 0; i < 10; i++) {
        const result = transformQuestionForSave(question, i, null, null, 'test-id')
        expect(result.question_order).toBe(i + 1)
        expect(Number.isInteger(result.question_order)).toBe(true)
        expect(result.question_order).toBeGreaterThan(0)
      }
    })
  })

  describe('Campos opcionales (pueden ser null)', () => {
    it('article_number puede ser null para legislativas', () => {
      const question = { id: '1', questionText: 'Test', questionType: 'legislative' }
      const result = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(result.article_number).toBeNull()

      const questionWithArticle = { id: '1', questionText: 'Test', questionType: 'legislative', articleNumber: '15' }
      const resultWithArticle = transformQuestionForSave(questionWithArticle, 0, null, null, 'test-id')
      expect(resultWithArticle.article_number).toBe('15')
    })

    it('law_name puede ser null para legislativas', () => {
      const question = { id: '1', questionText: 'Test', questionType: 'legislative' }
      const result = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(result.law_name).toBeNull()

      const questionWithLaw = { id: '1', questionText: 'Test', questionType: 'legislative', lawName: 'Constitución' }
      const resultWithLaw = transformQuestionForSave(questionWithLaw, 0, null, null, 'test-id')
      expect(resultWithLaw.law_name).toBe('Constitución')
    })
  })

  describe('Valores por defecto', () => {
    it('difficulty debe ser "medium" por defecto', () => {
      const question = { id: '1', questionText: 'Test' }
      const result = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(result.difficulty).toBe('medium')

      const questionWithDifficulty = { id: '1', questionText: 'Test', difficulty: 'hard' }
      const resultWithDifficulty = transformQuestionForSave(questionWithDifficulty, 0, null, null, 'test-id')
      expect(resultWithDifficulty.difficulty).toBe('hard')
    })

    it('question_type debe reflejar el tipo real de la pregunta', () => {
      // Guardamos TODAS las preguntas, cada una con su tipo real
      const question = { id: '1', questionText: 'Test' }
      const result = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(result.question_type).toBe('legislative') // Default si no se especifica

      const questionPsychometric = { id: '1', questionText: 'Test', questionType: 'psychometric' }
      const resultPsychometric = transformQuestionForSave(questionPsychometric, 0, null, null, 'test-id')
      expect(resultPsychometric.question_type).toBe('psychometric')

      const questionLegislative = { id: '1', questionText: 'Test', questionType: 'legislative' }
      const resultLegislative = transformQuestionForSave(questionLegislative, 0, null, null, 'test-id')
      expect(resultLegislative.question_type).toBe('legislative')
    })

    it('time_spent_seconds debe ser 0', () => {
      const question = { id: '1', questionText: 'Test' }
      const result = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(result.time_spent_seconds).toBe(0)
    })
  })

  describe('Escenarios de examen oficial real', () => {
    it('debe transformar pregunta legislativa correctamente', () => {
      const question = {
        id: 'uuid-1',
        questionText: '¿Cuál es el artículo 1 de la Constitución?',
        questionType: 'legislative',
        difficulty: 'medium',
        articleNumber: '1',
        lawName: 'Constitución Española'
      }
      const validationResult = {
        isCorrect: true,
        correctAnswer: 'a'
      }

      const result = transformQuestionForSave(question, 0, validationResult, 'a', 'test-123')

      expect(result.test_id).toBe('test-123')
      expect(result.question_id).toBe('uuid-1')
      expect(result.question_order).toBe(1)
      expect(result.question_text).toBe('¿Cuál es el artículo 1 de la Constitución?')
      expect(result.user_answer).toBe('a')
      expect(result.correct_answer).toBe('a')
      expect(result.is_correct).toBe(true)
      expect(result.article_number).toBe('1')
      expect(result.law_name).toBe('Constitución Española')
      expect(result.question_type).toBe('legislative')
    })

    it('preguntas psicotécnicas SE GUARDAN con psychometric_question_id', () => {
      // ARQUITECTURA: Las psicotécnicas se guardan con psychometric_question_id
      // para mantener referencia a su tabla correcta
      const questions = [
        {
          id: 'uuid-2',
          questionText: '¿Cuántos errores hay en la frase?',
          questionType: 'psychometric',
          difficulty: 'hard'
        }
      ]
      const allResults = [{ isCorrect: false, correctAnswer: 'c' }]
      const userAnswers = { 0: 'b' }

      const transformed = transformAllQuestions(questions, allResults, userAnswers, 'test-123')

      // Las psicotécnicas SÍ se guardan
      expect(transformed.length).toBe(1)
      expect(transformed[0].psychometric_question_id).toBe('uuid-2')
      expect(transformed[0].question_id).toBeNull()
      expect(transformed[0].question_type).toBe('psychometric')
    })

    it('debe manejar pregunta sin respuesta (en blanco)', () => {
      const question = {
        id: 'uuid-3',
        questionText: 'Pregunta dejada en blanco',
        questionType: 'legislative'
      }

      const result = transformQuestionForSave(question, 10, null, null, 'test-123')

      expect(result.user_answer).toBe('sin_respuesta')
      expect(result.correct_answer).toBe('unknown')
      expect(result.is_correct).toBe(false)
    })
  })

  describe('Guardado de TODAS las preguntas (legislativas y psicotécnicas)', () => {
    /**
     * ARQUITECTURA PROFESIONAL:
     * - Todas las preguntas se guardan en test_questions para estadísticas unificadas
     * - Legislativas: question_id apunta a tabla 'questions'
     * - Psicotécnicas: psychometric_question_id apunta a tabla 'psychometric_questions'
     * - El trigger detecta qué tipo es y procesa solo legislativas para dificultad
     */

    it('debe guardar TODAS las preguntas (legislativas y psicotécnicas)', () => {
      const questions = [
        { id: 'leg-1', questionText: 'Pregunta legislativa 1', questionType: 'legislative' },
        { id: 'psy-1', questionText: 'Pregunta psicotécnica 1', questionType: 'psychometric' },
        { id: 'leg-2', questionText: 'Pregunta legislativa 2', questionType: 'legislative' },
        { id: 'psy-2', questionText: 'Pregunta psicotécnica 2', questionType: 'psychometric' },
      ]
      const allResults = [
        { isCorrect: true, correctAnswer: 'a' },
        { isCorrect: false, correctAnswer: 'b' },
        { isCorrect: true, correctAnswer: 'c' },
        { isCorrect: false, correctAnswer: 'd' },
      ]
      const userAnswers = { 0: 'a', 1: 'a', 2: 'c', 3: 'a' }

      const transformed = transformAllQuestions(questions, allResults, userAnswers, 'test-123')

      // Debe haber 4 preguntas (TODAS)
      expect(transformed.length).toBe(4)

      // Verificar que cada tipo tiene la referencia correcta
      const legislative = transformed.filter(q => q.question_type === 'legislative')
      const psychometric = transformed.filter(q => q.question_type === 'psychometric')

      expect(legislative.length).toBe(2)
      expect(psychometric.length).toBe(2)
    })

    it('legislativas deben tener question_id, NO psychometric_question_id', () => {
      const questions = [
        { id: 'leg-1', questionText: 'Legislativa', questionType: 'legislative' },
      ]
      const allResults = [{ isCorrect: true, correctAnswer: 'a' }]
      const userAnswers = { 0: 'a' }

      const transformed = transformAllQuestions(questions, allResults, userAnswers, 'test-123')

      expect(transformed[0].question_id).toBe('leg-1')
      expect(transformed[0].psychometric_question_id).toBeNull()
      expect(transformed[0].question_type).toBe('legislative')
    })

    it('psicotécnicas deben tener psychometric_question_id, NO question_id', () => {
      const questions = [
        { id: 'psy-1', questionText: 'Psicotécnica', questionType: 'psychometric' },
      ]
      const allResults = [{ isCorrect: true, correctAnswer: 'a' }]
      const userAnswers = { 0: 'a' }

      const transformed = transformAllQuestions(questions, allResults, userAnswers, 'test-123')

      expect(transformed[0].question_id).toBeNull()
      expect(transformed[0].psychometric_question_id).toBe('psy-1')
      expect(transformed[0].question_type).toBe('psychometric')
    })

    it('debe mantener el orden correcto para todas las preguntas', () => {
      const questions = [
        { id: 'psy-1', questionText: 'Psico 1', questionType: 'psychometric' },
        { id: 'leg-1', questionText: 'Legislativa 1', questionType: 'legislative' },
        { id: 'psy-2', questionText: 'Psico 2', questionType: 'psychometric' },
        { id: 'leg-2', questionText: 'Legislativa 2', questionType: 'legislative' },
      ]
      const allResults = Array(4).fill({ isCorrect: true, correctAnswer: 'a' })
      const userAnswers = { 0: 'a', 1: 'a', 2: 'a', 3: 'a' }

      const transformed = transformAllQuestions(questions, allResults, userAnswers, 'test-123')

      // Verificar que question_order es secuencial (1, 2, 3, 4)
      expect(transformed[0].question_order).toBe(1)
      expect(transformed[1].question_order).toBe(2)
      expect(transformed[2].question_order).toBe(3)
      expect(transformed[3].question_order).toBe(4)
    })

    it('exactamente una de las dos columnas de referencia debe tener valor', () => {
      const questions = [
        { id: 'leg-1', questionText: 'Test', questionType: 'legislative' },
        { id: 'psy-1', questionText: 'Test', questionType: 'psychometric' },
      ]
      const allResults = Array(2).fill({ isCorrect: true, correctAnswer: 'a' })
      const userAnswers = { 0: 'a', 1: 'a' }

      const transformed = transformAllQuestions(questions, allResults, userAnswers, 'test-123')

      transformed.forEach(q => {
        // Exactamente una debe ser no-null
        const hasQuestionId = q.question_id !== null
        const hasPsychometricId = q.psychometric_question_id !== null

        expect(hasQuestionId || hasPsychometricId).toBe(true) // Al menos una
        expect(hasQuestionId && hasPsychometricId).toBe(false) // No ambas
      })
    })

    it('psicotécnicas no deben tener article_number ni law_name', () => {
      const questions = [
        { id: 'psy-1', questionText: 'Test', questionType: 'psychometric', articleNumber: '15', lawName: 'CE' },
      ]
      const allResults = [{ isCorrect: true, correctAnswer: 'a' }]
      const userAnswers = { 0: 'a' }

      const transformed = transformAllQuestions(questions, allResults, userAnswers, 'test-123')

      // Aunque la pregunta tenga esos campos, se ignoran para psicotécnicas
      expect(transformed[0].article_number).toBeNull()
      expect(transformed[0].law_name).toBeNull()
    })
  })
})
