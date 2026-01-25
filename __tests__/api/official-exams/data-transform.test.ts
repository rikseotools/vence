/**
 * Tests para la transformación de datos de Official Exams
 * Verifica que los datos se transformen correctamente antes de guardar en BD
 *
 * ARQUITECTURA:
 * - Preguntas legislativas: question_id -> tabla 'questions'
 * - Preguntas psicotécnicas: psychometric_question_id -> tabla 'psychometric_questions'
 * - Ambos tipos se guardan en test_questions para estadísticas unificadas
 */

interface QuestionInput {
  id: string
  questionText?: string
  question?: string
  questionType?: 'legislative' | 'psychometric'
  difficulty?: string
  articleNumber?: string | null
  lawName?: string | null
}

interface ValidationResult {
  isCorrect: boolean
  correctAnswer: string
}

interface TransformedQuestion {
  test_id: string
  question_id: string | null
  psychometric_question_id: string | null
  question_order: number
  question_text: string
  user_answer: string
  correct_answer: string
  is_correct: boolean
  time_spent_seconds: number
  article_number: string | null
  law_name: string | null
  tema_number: null
  difficulty: string
  question_type: 'legislative' | 'psychometric'
}

// Simular la función de transformación del componente (replica la lógica de queries.ts)
function transformQuestionForSave(
  q: QuestionInput,
  index: number,
  result: ValidationResult | null,
  userAnswer: string | null,
  testId: string
): TransformedQuestion {
  const isLegislative = q.questionType === 'legislative' || !q.questionType

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
    question_type: q.questionType || 'legislative',
  }
}

function transformAllQuestions(
  questions: QuestionInput[],
  allResults: (ValidationResult | null)[],
  userAnswers: Record<number, string | null>,
  testId: string
): TransformedQuestion[] {
  return questions.map((q, index) => {
    const result = allResults[index]
    const answer = userAnswers[index] || null
    return transformQuestionForSave(q, index, result, answer, testId)
  })
}

describe('Official Exam Data Transformation', () => {
  describe('Campos requeridos (NOT NULL en BD)', () => {
    it('question_text nunca debe ser null o undefined', () => {
      const testCases: QuestionInput[] = [
        { id: '1', questionText: 'Texto normal' },
        { id: '2', question: 'Campo alternativo' },
        { id: '3' }, // Sin ningún campo de texto
        { id: '4', questionText: undefined },
      ]

      testCases.forEach((q, index) => {
        const result = transformQuestionForSave(q, index, null, null, 'test-id')
        expect(result.question_text).toBeTruthy()
        expect(typeof result.question_text).toBe('string')
        expect(result.question_text.length).toBeGreaterThan(0)
      })
    })

    it('user_answer nunca debe ser null', () => {
      const question: QuestionInput = { id: '1', questionText: 'Test' }

      const withAnswer = transformQuestionForSave(question, 0, null, 'a', 'test-id')
      expect(withAnswer.user_answer).toBe('a')

      const withoutAnswer = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(withoutAnswer.user_answer).toBe('sin_respuesta')

      const withEmptyAnswer = transformQuestionForSave(question, 0, null, '', 'test-id')
      expect(withEmptyAnswer.user_answer).toBe('sin_respuesta')
    })

    it('correct_answer nunca debe ser null', () => {
      const question: QuestionInput = { id: '1', questionText: 'Test' }

      const withResult = transformQuestionForSave(
        question,
        0,
        { correctAnswer: 'b', isCorrect: true },
        null,
        'test-id'
      )
      expect(withResult.correct_answer).toBe('b')

      const withoutResult = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(withoutResult.correct_answer).toBe('unknown')
    })

    it('is_correct debe ser boolean', () => {
      const question: QuestionInput = { id: '1', questionText: 'Test' }

      const correct = transformQuestionForSave(
        question,
        0,
        { isCorrect: true, correctAnswer: 'a' },
        null,
        'test-id'
      )
      expect(correct.is_correct).toBe(true)

      const incorrect = transformQuestionForSave(
        question,
        0,
        { isCorrect: false, correctAnswer: 'a' },
        null,
        'test-id'
      )
      expect(incorrect.is_correct).toBe(false)

      const noResult = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(noResult.is_correct).toBe(false)
    })

    it('question_order debe ser entero positivo (1-indexed)', () => {
      const question: QuestionInput = { id: '1', questionText: 'Test' }

      for (let i = 0; i < 10; i++) {
        const result = transformQuestionForSave(question, i, null, null, 'test-id')
        expect(result.question_order).toBe(i + 1)
        expect(Number.isInteger(result.question_order)).toBe(true)
        expect(result.question_order).toBeGreaterThan(0)
      }
    })
  })

  describe('Campos opcionales (pueden ser null)', () => {
    it('article_number puede ser null para legislativas sin artículo', () => {
      const question: QuestionInput = { id: '1', questionText: 'Test', questionType: 'legislative' }
      const result = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(result.article_number).toBeNull()
    })

    it('article_number debe preservar valor para legislativas', () => {
      const question: QuestionInput = {
        id: '1',
        questionText: 'Test',
        questionType: 'legislative',
        articleNumber: '15',
      }
      const result = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(result.article_number).toBe('15')
    })

    it('law_name puede ser null para legislativas sin ley', () => {
      const question: QuestionInput = { id: '1', questionText: 'Test', questionType: 'legislative' }
      const result = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(result.law_name).toBeNull()
    })

    it('law_name debe preservar valor para legislativas', () => {
      const question: QuestionInput = {
        id: '1',
        questionText: 'Test',
        questionType: 'legislative',
        lawName: 'Constitución',
      }
      const result = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(result.law_name).toBe('Constitución')
    })
  })

  describe('Valores por defecto', () => {
    it('difficulty debe ser "medium" por defecto', () => {
      const question: QuestionInput = { id: '1', questionText: 'Test' }
      const result = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(result.difficulty).toBe('medium')
    })

    it('difficulty debe preservar valor si se proporciona', () => {
      const question: QuestionInput = { id: '1', questionText: 'Test', difficulty: 'hard' }
      const result = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(result.difficulty).toBe('hard')
    })

    it('question_type debe ser "legislative" por defecto', () => {
      const question: QuestionInput = { id: '1', questionText: 'Test' }
      const result = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(result.question_type).toBe('legislative')
    })

    it('time_spent_seconds debe ser 0', () => {
      const question: QuestionInput = { id: '1', questionText: 'Test' }
      const result = transformQuestionForSave(question, 0, null, null, 'test-id')
      expect(result.time_spent_seconds).toBe(0)
    })
  })

  describe('Separación legislativa vs psicotécnica', () => {
    it('legislativas deben tener question_id, NO psychometric_question_id', () => {
      const question: QuestionInput = {
        id: 'leg-uuid-123',
        questionText: 'Legislativa',
        questionType: 'legislative',
      }
      const result = transformQuestionForSave(question, 0, null, null, 'test-id')

      expect(result.question_id).toBe('leg-uuid-123')
      expect(result.psychometric_question_id).toBeNull()
      expect(result.question_type).toBe('legislative')
    })

    it('psicotécnicas deben tener psychometric_question_id, NO question_id', () => {
      const question: QuestionInput = {
        id: 'psy-uuid-456',
        questionText: 'Psicotécnica',
        questionType: 'psychometric',
      }
      const result = transformQuestionForSave(question, 0, null, null, 'test-id')

      expect(result.question_id).toBeNull()
      expect(result.psychometric_question_id).toBe('psy-uuid-456')
      expect(result.question_type).toBe('psychometric')
    })

    it('psicotécnicas NO deben tener article_number ni law_name (aunque estén en input)', () => {
      const question: QuestionInput = {
        id: 'psy-1',
        questionText: 'Test',
        questionType: 'psychometric',
        articleNumber: '15', // Se ignora
        lawName: 'CE', // Se ignora
      }
      const result = transformQuestionForSave(question, 0, null, null, 'test-id')

      expect(result.article_number).toBeNull()
      expect(result.law_name).toBeNull()
    })

    it('exactamente una de las dos columnas de referencia debe tener valor', () => {
      const questions: QuestionInput[] = [
        { id: 'leg-1', questionText: 'Test', questionType: 'legislative' },
        { id: 'psy-1', questionText: 'Test', questionType: 'psychometric' },
      ]
      const results = Array(2).fill({ isCorrect: true, correctAnswer: 'a' })
      const userAnswers = { 0: 'a', 1: 'a' }

      const transformed = transformAllQuestions(questions, results, userAnswers, 'test-123')

      transformed.forEach(q => {
        const hasQuestionId = q.question_id !== null
        const hasPsychometricId = q.psychometric_question_id !== null

        // Exactamente una debe ser true
        expect(hasQuestionId !== hasPsychometricId).toBe(true)
      })
    })
  })

  describe('Escenarios de examen oficial real', () => {
    it('debe transformar pregunta legislativa completa correctamente', () => {
      const question: QuestionInput = {
        id: 'uuid-1',
        questionText: '¿Cuál es el artículo 1 de la Constitución?',
        questionType: 'legislative',
        difficulty: 'medium',
        articleNumber: '1',
        lawName: 'Constitución Española',
      }
      const validationResult: ValidationResult = {
        isCorrect: true,
        correctAnswer: 'a',
      }

      const result = transformQuestionForSave(question, 0, validationResult, 'a', 'test-123')

      expect(result).toEqual({
        test_id: 'test-123',
        question_id: 'uuid-1',
        psychometric_question_id: null,
        question_order: 1,
        question_text: '¿Cuál es el artículo 1 de la Constitución?',
        user_answer: 'a',
        correct_answer: 'a',
        is_correct: true,
        time_spent_seconds: 0,
        article_number: '1',
        law_name: 'Constitución Española',
        tema_number: null,
        difficulty: 'medium',
        question_type: 'legislative',
      })
    })

    it('debe transformar pregunta psicotécnica completa correctamente', () => {
      const question: QuestionInput = {
        id: 'uuid-2',
        questionText: '¿Cuántos errores hay en la frase?',
        questionType: 'psychometric',
        difficulty: 'hard',
      }
      const validationResult: ValidationResult = {
        isCorrect: false,
        correctAnswer: 'c',
      }

      const result = transformQuestionForSave(question, 5, validationResult, 'b', 'test-456')

      expect(result).toEqual({
        test_id: 'test-456',
        question_id: null,
        psychometric_question_id: 'uuid-2',
        question_order: 6,
        question_text: '¿Cuántos errores hay en la frase?',
        user_answer: 'b',
        correct_answer: 'c',
        is_correct: false,
        time_spent_seconds: 0,
        article_number: null,
        law_name: null,
        tema_number: null,
        difficulty: 'hard',
        question_type: 'psychometric',
      })
    })

    it('debe manejar pregunta sin respuesta (en blanco)', () => {
      const question: QuestionInput = {
        id: 'uuid-3',
        questionText: 'Pregunta dejada en blanco',
        questionType: 'legislative',
      }

      const result = transformQuestionForSave(question, 10, null, null, 'test-123')

      expect(result.user_answer).toBe('sin_respuesta')
      expect(result.correct_answer).toBe('unknown')
      expect(result.is_correct).toBe(false)
    })
  })

  describe('Transformación batch (transformAllQuestions)', () => {
    it('debe transformar todas las preguntas manteniendo orden', () => {
      const questions: QuestionInput[] = [
        { id: 'psy-1', questionText: 'Psico 1', questionType: 'psychometric' },
        { id: 'leg-1', questionText: 'Legislativa 1', questionType: 'legislative' },
        { id: 'psy-2', questionText: 'Psico 2', questionType: 'psychometric' },
        { id: 'leg-2', questionText: 'Legislativa 2', questionType: 'legislative' },
      ]
      const results = Array(4).fill({ isCorrect: true, correctAnswer: 'a' })
      const userAnswers = { 0: 'a', 1: 'a', 2: 'a', 3: 'a' }

      const transformed = transformAllQuestions(questions, results, userAnswers, 'test-123')

      expect(transformed.length).toBe(4)
      expect(transformed[0].question_order).toBe(1)
      expect(transformed[1].question_order).toBe(2)
      expect(transformed[2].question_order).toBe(3)
      expect(transformed[3].question_order).toBe(4)
    })

    it('debe separar correctamente tipos en batch mixto', () => {
      const questions: QuestionInput[] = [
        { id: 'leg-1', questionText: 'Legislativa 1', questionType: 'legislative' },
        { id: 'psy-1', questionText: 'Psico 1', questionType: 'psychometric' },
        { id: 'leg-2', questionText: 'Legislativa 2', questionType: 'legislative' },
        { id: 'psy-2', questionText: 'Psico 2', questionType: 'psychometric' },
      ]
      const results = [
        { isCorrect: true, correctAnswer: 'a' },
        { isCorrect: false, correctAnswer: 'b' },
        { isCorrect: true, correctAnswer: 'c' },
        { isCorrect: false, correctAnswer: 'd' },
      ]
      const userAnswers = { 0: 'a', 1: 'a', 2: 'c', 3: 'a' }

      const transformed = transformAllQuestions(questions, results, userAnswers, 'test-123')

      const legislative = transformed.filter(q => q.question_type === 'legislative')
      const psychometric = transformed.filter(q => q.question_type === 'psychometric')

      expect(legislative.length).toBe(2)
      expect(psychometric.length).toBe(2)

      // Verificar IDs correctos
      expect(legislative.every(q => q.question_id !== null)).toBe(true)
      expect(legislative.every(q => q.psychometric_question_id === null)).toBe(true)
      expect(psychometric.every(q => q.question_id === null)).toBe(true)
      expect(psychometric.every(q => q.psychometric_question_id !== null)).toBe(true)
    })

    it('debe manejar respuestas parciales (algunas en blanco)', () => {
      const questions: QuestionInput[] = [
        { id: '1', questionText: 'Q1', questionType: 'legislative' },
        { id: '2', questionText: 'Q2', questionType: 'legislative' },
        { id: '3', questionText: 'Q3', questionType: 'legislative' },
      ]
      const results = [
        { isCorrect: true, correctAnswer: 'a' },
        null, // Sin validación
        { isCorrect: false, correctAnswer: 'c' },
      ]
      const userAnswers = { 0: 'a', 2: 'b' } // Q2 sin respuesta

      const transformed = transformAllQuestions(questions, results, userAnswers, 'test-123')

      expect(transformed[0].user_answer).toBe('a')
      expect(transformed[0].is_correct).toBe(true)

      expect(transformed[1].user_answer).toBe('sin_respuesta')
      expect(transformed[1].correct_answer).toBe('unknown')
      expect(transformed[1].is_correct).toBe(false)

      expect(transformed[2].user_answer).toBe('b')
      expect(transformed[2].is_correct).toBe(false)
    })
  })
})
