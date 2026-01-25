/**
 * Tests para la transformación de datos de OfficialExamLayout
 * Previene bugs como:
 * - Campos null en test_questions (NOT NULL constraints)
 * - FK errors por mezclar preguntas legislativas y psicotécnicas
 *   (el trigger en test_questions usa FK a tabla 'questions', no 'psychometric_questions')
 */

describe('OfficialExamLayout - Transformación de datos para test_questions', () => {
  // Simular la función de transformación del componente (solo legislativas)
  const transformQuestionForSave = (q, index, result, userAnswer, testId) => {
    return {
      test_id: testId,
      question_id: q.id,
      question_order: index + 1,
      question_text: q.questionText || q.question || 'Pregunta sin texto',
      user_answer: userAnswer || 'sin_respuesta',
      correct_answer: result?.correctAnswer || 'unknown',
      is_correct: result?.isCorrect || false,
      time_spent_seconds: 0,
      article_number: q.articleNumber || null,
      law_name: q.lawName || null,
      tema_number: null,
      difficulty: q.difficulty || 'medium',
      question_type: 'legislative'
    }
  }

  // Simular el filtrado que hace el componente
  const filterAndTransformQuestions = (questions, allResults, userAnswers, testId) => {
    return questions
      .filter(q => q.questionType === 'legislative')
      .map((q, idx) => {
        const originalIndex = questions.findIndex(orig => orig.id === q.id)
        const result = allResults[originalIndex]
        const answer = userAnswers[originalIndex] || null
        return transformQuestionForSave(q, originalIndex, result, answer, testId)
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
    it('article_number puede ser null', () => {
      const question = { id: '1', questionText: 'Test' }
      const result = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(result.article_number).toBeNull()

      const questionWithArticle = { id: '1', questionText: 'Test', articleNumber: '15' }
      const resultWithArticle = transformQuestionForSave(questionWithArticle, 0, null, null, 'test-id')
      expect(resultWithArticle.article_number).toBe('15')
    })

    it('law_name puede ser null', () => {
      const question = { id: '1', questionText: 'Test' }
      const result = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(result.law_name).toBeNull()

      const questionWithLaw = { id: '1', questionText: 'Test', lawName: 'Constitución' }
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

    it('question_type siempre debe ser "legislative" (solo guardamos legislativas)', () => {
      // Después del fix del bug FK, solo guardamos preguntas legislativas
      const question = { id: '1', questionText: 'Test' }
      const result = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(result.question_type).toBe('legislative')

      // Aunque la pregunta sea psicotécnica, si llega a transformarse (no debería), sería legislative
      // Pero en la práctica, filterAndTransformQuestions las filtra antes
      const questionPsychometric = { id: '1', questionText: 'Test', questionType: 'psychometric' }
      const resultPsychometric = transformQuestionForSave(questionPsychometric, 0, null, null, 'test-id')
      expect(resultPsychometric.question_type).toBe('legislative')
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

    it('preguntas psicotécnicas se filtran (no se guardan en test_questions)', () => {
      // NOTA: Desde el fix del bug FK, las preguntas psicotécnicas se FILTRAN
      // y NO se guardan en test_questions porque el trigger tiene FK a 'questions'
      // y las psicotécnicas están en 'psychometric_questions'
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

      const filtered = filterAndTransformQuestions(questions, allResults, userAnswers, 'test-123')

      // Las psicotécnicas se filtran - no hay nada que guardar
      expect(filtered.length).toBe(0)
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

  describe('Filtrado de preguntas psicotécnicas (BUG PREVENTION)', () => {
    /**
     * BUG DETECTADO: El trigger law_question_difficulty_update_trigger en test_questions
     * intenta insertar en law_question_first_attempts que tiene FK a tabla 'questions'.
     * Si insertamos preguntas psicotécnicas (que están en 'psychometric_questions'),
     * el FK falla porque el question_id no existe en la tabla 'questions'.
     *
     * SOLUCIÓN: Solo insertar preguntas legislativas en test_questions.
     */

    it('debe filtrar preguntas psicotécnicas y solo guardar legislativas', () => {
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

      const filtered = filterAndTransformQuestions(questions, allResults, userAnswers, 'test-123')

      // Solo debe haber 2 preguntas (las legislativas)
      expect(filtered.length).toBe(2)

      // Todas deben ser legislativas
      filtered.forEach(q => {
        expect(q.question_type).toBe('legislative')
      })

      // Verificar que los IDs son de preguntas legislativas
      expect(filtered[0].question_id).toBe('leg-1')
      expect(filtered[1].question_id).toBe('leg-2')
    })

    it('NO debe incluir preguntas psicotécnicas (causarían FK error)', () => {
      const questions = [
        { id: 'psy-1', questionText: 'Solo psicotécnica', questionType: 'psychometric' },
      ]
      const allResults = [{ isCorrect: true, correctAnswer: 'a' }]
      const userAnswers = { 0: 'a' }

      const filtered = filterAndTransformQuestions(questions, allResults, userAnswers, 'test-123')

      // No debe haber ninguna pregunta
      expect(filtered.length).toBe(0)
    })

    it('debe mantener el orden correcto (question_order basado en índice original)', () => {
      const questions = [
        { id: 'psy-1', questionText: 'Psico 1', questionType: 'psychometric' },
        { id: 'leg-1', questionText: 'Legislativa 1', questionType: 'legislative' },
        { id: 'psy-2', questionText: 'Psico 2', questionType: 'psychometric' },
        { id: 'leg-2', questionText: 'Legislativa 2', questionType: 'legislative' },
      ]
      const allResults = Array(4).fill({ isCorrect: true, correctAnswer: 'a' })
      const userAnswers = { 0: 'a', 1: 'a', 2: 'a', 3: 'a' }

      const filtered = filterAndTransformQuestions(questions, allResults, userAnswers, 'test-123')

      // Verificar que question_order refleja la posición ORIGINAL en el examen
      expect(filtered[0].question_order).toBe(2) // leg-1 estaba en índice 1 -> order 2
      expect(filtered[1].question_order).toBe(4) // leg-2 estaba en índice 3 -> order 4
    })

    it('todos los question_id deben ser válidos (no null) para evitar trigger error', () => {
      const questions = [
        { id: 'valid-uuid-1', questionText: 'Test', questionType: 'legislative' },
        { id: 'valid-uuid-2', questionText: 'Test', questionType: 'legislative' },
      ]
      const allResults = Array(2).fill({ isCorrect: true, correctAnswer: 'a' })
      const userAnswers = { 0: 'a', 1: 'a' }

      const filtered = filterAndTransformQuestions(questions, allResults, userAnswers, 'test-123')

      filtered.forEach(q => {
        expect(q.question_id).not.toBeNull()
        expect(q.question_id).toBeDefined()
        expect(typeof q.question_id).toBe('string')
        expect(q.question_id.length).toBeGreaterThan(0)
      })
    })
  })
})
