/**
 * Tests para schemas Zod de psychometric-test-data
 * Verifica validación de request/response sin DB
 */
import {
  getPsychometricQuestionsRequestSchema,
  getPsychometricCategoriesResponseSchema,
  getPsychometricQuestionsResponseSchema,
  psychometricQuestionSchema,
} from '@/lib/api/psychometric-test-data/schemas'

describe('Psychometric Test Data Schemas', () => {
  describe('getPsychometricQuestionsRequestSchema', () => {
    it('debe aceptar categorías válidas con numQuestions', () => {
      const result = getPsychometricQuestionsRequestSchema.safeParse({
        categories: ['series-letras', 'razonamiento-numerico'],
        numQuestions: 25,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.categories).toHaveLength(2)
        expect(result.data.numQuestions).toBe(25)
      }
    })

    it('debe usar default de 25 para numQuestions', () => {
      const result = getPsychometricQuestionsRequestSchema.safeParse({
        categories: ['series-letras'],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.numQuestions).toBe(25)
      }
    })

    it('debe rechazar categorías vacías', () => {
      const result = getPsychometricQuestionsRequestSchema.safeParse({
        categories: [],
        numQuestions: 10,
      })
      expect(result.success).toBe(false)
    })

    it('debe rechazar numQuestions = 0', () => {
      const result = getPsychometricQuestionsRequestSchema.safeParse({
        categories: ['series-letras'],
        numQuestions: 0,
      })
      expect(result.success).toBe(false)
    })

    it('debe rechazar numQuestions > 200', () => {
      const result = getPsychometricQuestionsRequestSchema.safeParse({
        categories: ['series-letras'],
        numQuestions: 201,
      })
      expect(result.success).toBe(false)
    })

    it('debe rechazar numQuestions negativo', () => {
      const result = getPsychometricQuestionsRequestSchema.safeParse({
        categories: ['series-letras'],
        numQuestions: -5,
      })
      expect(result.success).toBe(false)
    })

    it('debe rechazar string vacío en categorías', () => {
      const result = getPsychometricQuestionsRequestSchema.safeParse({
        categories: [''],
        numQuestions: 10,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('getPsychometricCategoriesResponseSchema', () => {
    it('debe aceptar respuesta válida con categorías', () => {
      const result = getPsychometricCategoriesResponseSchema.safeParse({
        success: true,
        categories: [
          {
            key: 'series-letras',
            name: 'Series de letras',
            questionCount: 48,
            sections: [
              { key: 'series-letras-correlativas', name: 'Series correlativas', count: 48 },
            ],
          },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('debe aceptar respuesta de error', () => {
      const result = getPsychometricCategoriesResponseSchema.safeParse({
        success: false,
        error: 'Error de conexión',
      })
      expect(result.success).toBe(true)
    })

    it('debe aceptar categoría sin secciones', () => {
      const result = getPsychometricCategoriesResponseSchema.safeParse({
        success: true,
        categories: [
          {
            key: 'test',
            name: 'Test',
            questionCount: 0,
            sections: [],
          },
        ],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('psychometricQuestionSchema - seguridad', () => {
    const validQuestion = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      categoryId: '550e8400-e29b-41d4-a716-446655440001',
      sectionId: '550e8400-e29b-41d4-a716-446655440002',
      questionSubtype: 'sequence_letter',
      questionText: '¿Cuál es la siguiente letra?',
      optionA: 'A',
      optionB: 'B',
      optionC: 'C',
      optionD: 'D',
      contentData: { sequence: ['A', 'B', 'C'] },
      difficulty: 'medium',
      timeLimitSeconds: 120,
      cognitiveSkills: ['logical'],
      isOfficialExam: false,
      examSource: null,
    }

    it('debe aceptar pregunta válida sin correctOption', () => {
      const result = psychometricQuestionSchema.safeParse(validQuestion)
      expect(result.success).toBe(true)
    })

    it('NO debe incluir correctOption en el schema', () => {
      // Verificar que el schema no tiene correctOption como campo conocido
      const withCorrectOption = { ...validQuestion, correctOption: 2 }
      const result = psychometricQuestionSchema.safeParse(withCorrectOption)
      // Zod strips unknown keys by default, so it should pass but correctOption should not be in output
      expect(result.success).toBe(true)
      if (result.success) {
        expect('correctOption' in result.data).toBe(false)
      }
    })

    it('NO debe incluir correct_option en el schema', () => {
      const withCorrectOption = { ...validQuestion, correct_option: 2 }
      const result = psychometricQuestionSchema.safeParse(withCorrectOption)
      expect(result.success).toBe(true)
      if (result.success) {
        expect('correct_option' in result.data).toBe(false)
      }
    })
  })

  describe('getPsychometricQuestionsResponseSchema - seguridad', () => {
    it('debe aceptar respuesta con preguntas SIN correct_option', () => {
      const result = getPsychometricQuestionsResponseSchema.safeParse({
        success: true,
        questions: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            categoryId: '550e8400-e29b-41d4-a716-446655440001',
            sectionId: null,
            questionSubtype: 'sequence_numeric',
            questionText: '¿Cuál es el siguiente número?',
            optionA: '10',
            optionB: '12',
            optionC: '14',
            optionD: '16',
            contentData: {},
            difficulty: 'easy',
            timeLimitSeconds: 60,
            cognitiveSkills: null,
            isOfficialExam: false,
            examSource: null,
          },
        ],
        totalAvailable: 100,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.questions).toHaveLength(1)
        // Verify no correctOption leaked
        const q = result.data.questions![0]
        expect('correctOption' in q).toBe(false)
        expect('correct_option' in q).toBe(false)
      }
    })

    it('debe aceptar respuesta vacía', () => {
      const result = getPsychometricQuestionsResponseSchema.safeParse({
        success: true,
        questions: [],
        totalAvailable: 0,
      })
      expect(result.success).toBe(true)
    })
  })
})
