/**
 * Tests para los schemas Zod de Official Exams API v2
 * Verifica validación de datos de entrada/salida
 */
import {
  getOfficialExamQuestionsRequestSchema,
  saveOfficialExamResultsRequestSchema,
  questionResultSchema,
  officialExamQuestionSchema,
  safeParseGetOfficialExamQuestions,
  safeParseSaveOfficialExamResults,
  OposicionType,
} from '@/lib/api/official-exams/schemas'

describe('Official Exams Zod Schemas', () => {
  describe('getOfficialExamQuestionsRequestSchema', () => {
    it('debe aceptar request válida con campos requeridos', () => {
      const validRequest = {
        examDate: '2024-07-09',
        oposicion: 'auxiliar-administrativo-estado',
      }

      const result = getOfficialExamQuestionsRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.examDate).toBe('2024-07-09')
        expect(result.data.oposicion).toBe('auxiliar-administrativo-estado')
        expect(result.data.includeReservas).toBe(true) // default
      }
    })

    it('debe aceptar todas las oposiciones válidas', () => {
      const oposiciones = [
        'auxiliar-administrativo-estado',
        'tramitacion-procesal',
        'auxilio-judicial',
      ]

      oposiciones.forEach(oposicion => {
        const result = getOfficialExamQuestionsRequestSchema.safeParse({
          examDate: '2024-01-01',
          oposicion,
        })
        expect(result.success).toBe(true)
      })
    })

    it('debe rechazar oposición inválida', () => {
      const invalidRequest = {
        examDate: '2024-07-09',
        oposicion: 'oposicion-invalida',
      }

      const result = getOfficialExamQuestionsRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('debe rechazar fecha con formato inválido', () => {
      const invalidDates = [
        '2024/07/09',
        '09-07-2024',
        '2024-7-9',
        '20240709',
        'invalid',
        '',
      ]

      invalidDates.forEach(examDate => {
        const result = getOfficialExamQuestionsRequestSchema.safeParse({
          examDate,
          oposicion: 'auxiliar-administrativo-estado',
        })
        expect(result.success).toBe(false)
      })
    })

    it('debe aceptar parte opcional', () => {
      const withParte = {
        examDate: '2024-07-09',
        oposicion: 'tramitacion-procesal',
        parte: 'primera',
      }

      const result = getOfficialExamQuestionsRequestSchema.safeParse(withParte)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.parte).toBe('primera')
      }
    })

    it('debe rechazar parte inválida', () => {
      const invalidParte = {
        examDate: '2024-07-09',
        oposicion: 'tramitacion-procesal',
        parte: 'tercera',
      }

      const result = getOfficialExamQuestionsRequestSchema.safeParse(invalidParte)
      expect(result.success).toBe(false)
    })

    it('debe aplicar default includeReservas = true', () => {
      const withoutReservas = {
        examDate: '2024-07-09',
        oposicion: 'auxiliar-administrativo-estado',
      }

      const result = getOfficialExamQuestionsRequestSchema.safeParse(withoutReservas)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.includeReservas).toBe(true)
      }
    })

    it('debe permitir includeReservas = false', () => {
      const withoutReservas = {
        examDate: '2024-07-09',
        oposicion: 'auxiliar-administrativo-estado',
        includeReservas: false,
      }

      const result = getOfficialExamQuestionsRequestSchema.safeParse(withoutReservas)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.includeReservas).toBe(false)
      }
    })
  })

  describe('questionResultSchema', () => {
    const validQuestionResult = {
      questionId: '550e8400-e29b-41d4-a716-446655440000',
      questionType: 'legislative' as const,
      userAnswer: 'a',
      correctAnswer: 'b',
      isCorrect: false,
      questionText: '¿Cuál es el artículo 1 de la CE?',
      difficulty: 'medium',
    }

    it('debe aceptar resultado de pregunta válido', () => {
      const result = questionResultSchema.safeParse(validQuestionResult)
      expect(result.success).toBe(true)
    })

    it('debe rechazar questionId no UUID', () => {
      const invalid = { ...validQuestionResult, questionId: 'not-a-uuid' }
      const result = questionResultSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('debe rechazar questionType inválido', () => {
      const invalid = { ...validQuestionResult, questionType: 'invalid' }
      const result = questionResultSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('debe aceptar ambos tipos de pregunta', () => {
      const legislative = { ...validQuestionResult, questionType: 'legislative' }
      const psychometric = { ...validQuestionResult, questionType: 'psychometric' }

      expect(questionResultSchema.safeParse(legislative).success).toBe(true)
      expect(questionResultSchema.safeParse(psychometric).success).toBe(true)
    })

    it('debe aplicar default difficulty = medium', () => {
      const withoutDifficulty = { ...validQuestionResult }
      delete (withoutDifficulty as any).difficulty

      const result = questionResultSchema.safeParse(withoutDifficulty)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.difficulty).toBe('medium')
      }
    })

    it('debe aceptar articleNumber y lawName opcionales', () => {
      const withArticle = {
        ...validQuestionResult,
        articleNumber: '15',
        lawName: 'Constitución Española',
      }

      const result = questionResultSchema.safeParse(withArticle)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.articleNumber).toBe('15')
        expect(result.data.lawName).toBe('Constitución Española')
      }
    })

    it('debe aceptar articleNumber y lawName como null', () => {
      const withNullArticle = {
        ...validQuestionResult,
        articleNumber: null,
        lawName: null,
      }

      const result = questionResultSchema.safeParse(withNullArticle)
      expect(result.success).toBe(true)
    })
  })

  describe('saveOfficialExamResultsRequestSchema', () => {
    const validSaveRequest = {
      examDate: '2024-07-09',
      oposicion: 'auxiliar-administrativo-estado',
      results: [
        {
          questionId: '550e8400-e29b-41d4-a716-446655440000',
          questionType: 'legislative' as const,
          userAnswer: 'a',
          correctAnswer: 'a',
          isCorrect: true,
          questionText: 'Pregunta de test',
          difficulty: 'medium',
        },
      ],
      totalTimeSeconds: 3600,
    }

    it('debe aceptar request válida', () => {
      const result = saveOfficialExamResultsRequestSchema.safeParse(validSaveRequest)
      expect(result.success).toBe(true)
    })

    it('debe rechazar array de resultados vacío', () => {
      const invalid = { ...validSaveRequest, results: [] }
      const result = saveOfficialExamResultsRequestSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('al menos un resultado')
      }
    })

    it('debe rechazar totalTimeSeconds negativo', () => {
      const invalid = { ...validSaveRequest, totalTimeSeconds: -1 }
      const result = saveOfficialExamResultsRequestSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('debe rechazar totalTimeSeconds decimal', () => {
      const invalid = { ...validSaveRequest, totalTimeSeconds: 3600.5 }
      const result = saveOfficialExamResultsRequestSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('debe aceptar metadata opcional', () => {
      const withMetadata = {
        ...validSaveRequest,
        metadata: {
          legislativeCount: 80,
          psychometricCount: 20,
          reservaCount: 5,
        },
      }

      const result = saveOfficialExamResultsRequestSchema.safeParse(withMetadata)
      expect(result.success).toBe(true)
    })

    it('debe rechazar metadata con counts negativos', () => {
      const invalidMetadata = {
        ...validSaveRequest,
        metadata: {
          legislativeCount: -1,
          psychometricCount: 20,
        },
      }

      const result = saveOfficialExamResultsRequestSchema.safeParse(invalidMetadata)
      expect(result.success).toBe(false)
    })

    it('debe aceptar múltiples resultados de diferentes tipos', () => {
      const multipleResults = {
        ...validSaveRequest,
        results: [
          {
            questionId: '550e8400-e29b-41d4-a716-446655440001',
            questionType: 'legislative' as const,
            userAnswer: 'a',
            correctAnswer: 'a',
            isCorrect: true,
            questionText: 'Pregunta legislativa',
          },
          {
            questionId: '550e8400-e29b-41d4-a716-446655440002',
            questionType: 'psychometric' as const,
            userAnswer: 'b',
            correctAnswer: 'c',
            isCorrect: false,
            questionText: 'Pregunta psicotécnica',
          },
        ],
      }

      const result = saveOfficialExamResultsRequestSchema.safeParse(multipleResults)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.results.length).toBe(2)
        expect(result.data.results[0].questionType).toBe('legislative')
        expect(result.data.results[1].questionType).toBe('psychometric')
      }
    })
  })

  describe('officialExamQuestionSchema', () => {
    const validQuestion = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      questionText: '¿Cuál es el artículo 1?',
      optionA: 'Opción A',
      optionB: 'Opción B',
      optionC: 'Opción C',
      optionD: 'Opción D',
      explanation: 'Explicación de la respuesta',
      difficulty: 'medium',
      questionType: 'legislative' as const,
      questionSubtype: null,
      examSource: 'Examen 2024',
      isReserva: false,
      contentData: null,
      timeLimitSeconds: null,
      articleNumber: '1',
      lawName: 'Constitución Española',
    }

    it('debe aceptar pregunta legislativa válida', () => {
      const result = officialExamQuestionSchema.safeParse(validQuestion)
      expect(result.success).toBe(true)
    })

    it('debe aceptar pregunta psicotécnica con contentData', () => {
      const psychometric = {
        ...validQuestion,
        questionType: 'psychometric',
        questionSubtype: 'pie_chart',
        contentData: { series: [10, 20, 30], labels: ['A', 'B', 'C'] },
        timeLimitSeconds: 60,
        articleNumber: null,
        lawName: null,
      }

      const result = officialExamQuestionSchema.safeParse(psychometric)
      expect(result.success).toBe(true)
    })

    it('debe rechazar id no UUID', () => {
      const invalid = { ...validQuestion, id: 'not-a-uuid' }
      const result = officialExamQuestionSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('debe requerir todas las opciones', () => {
      const withoutOptionD = { ...validQuestion }
      delete (withoutOptionD as any).optionD

      const result = officialExamQuestionSchema.safeParse(withoutOptionD)
      expect(result.success).toBe(false)
    })
  })

  describe('Safe parse helper functions', () => {
    it('safeParseGetOfficialExamQuestions debe retornar success con datos válidos', () => {
      const result = safeParseGetOfficialExamQuestions({
        examDate: '2024-07-09',
        oposicion: 'auxiliar-administrativo-estado',
      })
      expect(result.success).toBe(true)
    })

    it('safeParseGetOfficialExamQuestions debe retornar error con datos inválidos', () => {
      const result = safeParseGetOfficialExamQuestions({
        examDate: 'invalid',
        oposicion: 'invalid',
      })
      expect(result.success).toBe(false)
    })

    it('safeParseSaveOfficialExamResults debe retornar success con datos válidos', () => {
      const result = safeParseSaveOfficialExamResults({
        examDate: '2024-07-09',
        oposicion: 'tramitacion-procesal',
        results: [
          {
            questionId: '550e8400-e29b-41d4-a716-446655440000',
            questionType: 'legislative',
            userAnswer: 'a',
            correctAnswer: 'a',
            isCorrect: true,
            questionText: 'Test',
          },
        ],
        totalTimeSeconds: 1000,
      })
      expect(result.success).toBe(true)
    })

    it('safeParseSaveOfficialExamResults debe retornar error sin resultados', () => {
      const result = safeParseSaveOfficialExamResults({
        examDate: '2024-07-09',
        oposicion: 'tramitacion-procesal',
        results: [],
        totalTimeSeconds: 1000,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('OposicionType enum', () => {
    it('debe tener los valores correctos', () => {
      expect(OposicionType.AUXILIAR_ADMINISTRATIVO_ESTADO).toBe('auxiliar-administrativo-estado')
      expect(OposicionType.TRAMITACION_PROCESAL).toBe('tramitacion-procesal')
      expect(OposicionType.AUXILIO_JUDICIAL).toBe('auxilio-judicial')
    })
  })
})
