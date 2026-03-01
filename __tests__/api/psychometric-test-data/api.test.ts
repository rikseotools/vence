/**
 * Tests para los API endpoints de psychometric-test-data
 * Tests de integración ligeros: verifican la lógica de routing/validación
 * sin importar código de Next.js server (que necesita polyfills)
 */
import {
  safeParseGetPsychometricQuestionsRequest,
  getPsychometricCategoriesResponseSchema,
  getPsychometricQuestionsResponseSchema,
} from '@/lib/api/psychometric-test-data/schemas'

describe('API /api/psychometric-test-data - validación de parámetros', () => {
  describe('GET /api/psychometric-test-data/questions - validación de request', () => {
    it('debe validar request con categorías y numQuestions', () => {
      const result = safeParseGetPsychometricQuestionsRequest({
        categories: ['series-letras'],
        numQuestions: 10,
      })
      expect(result.success).toBe(true)
    })

    it('debe rechazar request sin categorías', () => {
      const result = safeParseGetPsychometricQuestionsRequest({
        numQuestions: 10,
      })
      expect(result.success).toBe(false)
    })

    it('debe rechazar categories vacías', () => {
      const result = safeParseGetPsychometricQuestionsRequest({
        categories: [],
        numQuestions: 10,
      })
      expect(result.success).toBe(false)
    })

    it('debe aceptar múltiples categorías', () => {
      const result = safeParseGetPsychometricQuestionsRequest({
        categories: ['series-letras', 'razonamiento-numerico', 'capacidad-administrativa'],
        numQuestions: 50,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.categories).toHaveLength(3)
      }
    })

    it('debe usar default numQuestions=25', () => {
      const result = safeParseGetPsychometricQuestionsRequest({
        categories: ['series-letras'],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.numQuestions).toBe(25)
      }
    })
  })

  describe('Response validation - categorías', () => {
    it('debe validar respuesta de categorías exitosa', () => {
      const response = {
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
          {
            key: 'razonamiento-numerico',
            name: 'Razonamiento numérico',
            questionCount: 150,
            sections: [
              { key: 'numeros-enteros', name: 'Números enteros', count: 30 },
              { key: 'fracciones', name: 'Fracciones', count: 25 },
            ],
          },
        ],
      }
      const result = getPsychometricCategoriesResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })

    it('debe validar respuesta de error', () => {
      const result = getPsychometricCategoriesResponseSchema.safeParse({
        success: false,
        error: 'Database unavailable',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('Response validation - preguntas (seguridad anti-scraping)', () => {
    it('debe validar respuesta con preguntas', () => {
      const response = {
        success: true,
        questions: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            categoryId: '550e8400-e29b-41d4-a716-446655440001',
            sectionId: null,
            questionSubtype: 'sequence_numeric',
            questionText: '¿Cuál es el siguiente número en la serie: 2, 4, 6, 8, ...?',
            optionA: '10',
            optionB: '12',
            optionC: '9',
            optionD: '11',
            contentData: { sequence: [2, 4, 6, 8] },
            difficulty: 'easy',
            timeLimitSeconds: 60,
            cognitiveSkills: ['numerical-reasoning'],
            isOfficialExam: false,
            examSource: null,
          },
        ],
        totalAvailable: 100,
      }
      const result = getPsychometricQuestionsResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
      if (result.success) {
        const q = result.data.questions![0]
        expect('correctOption' in q).toBe(false)
        expect('correct_option' in q).toBe(false)
      }
    })

    it('correctOption se stripea del output por Zod', () => {
      const response = {
        success: true,
        questions: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            categoryId: '550e8400-e29b-41d4-a716-446655440001',
            sectionId: null,
            questionSubtype: 'sequence_letter',
            questionText: 'Test?',
            optionA: 'A',
            optionB: 'B',
            optionC: 'C',
            optionD: 'D',
            contentData: {},
            difficulty: 'medium',
            timeLimitSeconds: 120,
            cognitiveSkills: null,
            isOfficialExam: false,
            examSource: null,
            // Intentionally added — should be stripped
            correctOption: 2,
          },
        ],
        totalAvailable: 1,
      }
      const result = getPsychometricQuestionsResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
      if (result.success) {
        const q = result.data.questions![0]
        expect('correctOption' in q).toBe(false)
      }
    })

    it('debe aceptar respuesta vacía', () => {
      const result = getPsychometricQuestionsResponseSchema.safeParse({
        success: true,
        questions: [],
        totalAvailable: 0,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.questions).toHaveLength(0)
      }
    })
  })
})
