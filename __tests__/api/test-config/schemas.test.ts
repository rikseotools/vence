/**
 * Tests para los schemas Zod del módulo test-config
 */
import {
  getArticlesRequestSchema,
  getArticlesResponseSchema,
  estimateQuestionsRequestSchema,
  estimateQuestionsResponseSchema,
  getEssentialArticlesRequestSchema,
  getEssentialArticlesResponseSchema,
  safeParseGetArticles,
  safeParseEstimateQuestions,
  safeParseGetEssentialArticles,
  validateGetArticles,
  validateEstimateQuestions,
  validateGetEssentialArticles,
} from '../../../lib/api/test-config/schemas'

describe('getArticlesRequestSchema', () => {
  test('valida request correcto con topicNumber', () => {
    const result = getArticlesRequestSchema.safeParse({
      lawShortName: 'CE',
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.lawShortName).toBe('CE')
      expect(result.data.topicNumber).toBe(1)
      expect(result.data.includeOfficialCount).toBe(false)
    }
  })

  test('valida request sin topicNumber (standalone)', () => {
    const result = getArticlesRequestSchema.safeParse({
      lawShortName: 'CE',
      topicNumber: null,
      positionType: 'auxiliar_administrativo_estado',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.topicNumber).toBeNull()
    }
  })

  test('includeOfficialCount default es false', () => {
    const result = getArticlesRequestSchema.safeParse({
      lawShortName: 'CE',
      positionType: 'auxiliar_administrativo_estado',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.includeOfficialCount).toBe(false)
    }
  })

  test('rechaza lawShortName vacio', () => {
    const result = getArticlesRequestSchema.safeParse({
      lawShortName: '',
      positionType: 'auxiliar_administrativo_estado',
    })
    expect(result.success).toBe(false)
  })

  test('rechaza positionType invalido', () => {
    const result = getArticlesRequestSchema.safeParse({
      lawShortName: 'CE',
      positionType: 'invalido_position',
    })
    expect(result.success).toBe(false)
  })
})

describe('getArticlesResponseSchema', () => {
  test('valida response exitoso', () => {
    const result = getArticlesResponseSchema.safeParse({
      success: true,
      articles: [
        { article_number: 1, title: 'Titulo Prelim.', question_count: 15 },
        { article_number: '14', title: 'Igualdad', question_count: 8, official_question_count: 3 },
      ],
    })
    expect(result.success).toBe(true)
  })

  test('valida response de error', () => {
    const result = getArticlesResponseSchema.safeParse({
      success: false,
      error: 'Ley no encontrada',
    })
    expect(result.success).toBe(true)
  })
})

describe('estimateQuestionsRequestSchema', () => {
  test('valida request minimo', () => {
    const result = estimateQuestionsRequestSchema.safeParse({
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.selectedLaws).toEqual([])
      expect(result.data.selectedArticlesByLaw).toEqual({})
      expect(result.data.onlyOfficialQuestions).toBe(false)
      expect(result.data.difficultyMode).toBe('random')
      expect(result.data.focusEssentialArticles).toBe(false)
    }
  })

  test('valida request completo', () => {
    const result = estimateQuestionsRequestSchema.safeParse({
      topicNumber: 5,
      positionType: 'tramitacion_procesal',
      selectedLaws: ['CE', 'Ley 39/2015'],
      selectedArticlesByLaw: { CE: [1, 14, 16] },
      onlyOfficialQuestions: true,
      difficultyMode: 'hard',
      focusEssentialArticles: false,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.selectedLaws).toEqual(['CE', 'Ley 39/2015'])
      expect(result.data.selectedArticlesByLaw).toEqual({ CE: [1, 14, 16] })
    }
  })

  test('rechaza difficultyMode invalido', () => {
    const result = estimateQuestionsRequestSchema.safeParse({
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
      difficultyMode: 'impossible',
    })
    expect(result.success).toBe(false)
  })
})

describe('estimateQuestionsResponseSchema', () => {
  test('valida response con byLaw', () => {
    const result = estimateQuestionsResponseSchema.safeParse({
      success: true,
      count: 42,
      byLaw: { CE: 30, 'Ley 39/2015': 12 },
    })
    expect(result.success).toBe(true)
  })
})

describe('getEssentialArticlesRequestSchema', () => {
  test('valida request correcto', () => {
    const result = getEssentialArticlesRequestSchema.safeParse({
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
    })
    expect(result.success).toBe(true)
  })

  test('rechaza sin topicNumber', () => {
    const result = getEssentialArticlesRequestSchema.safeParse({
      positionType: 'auxiliar_administrativo_estado',
    })
    expect(result.success).toBe(false)
  })
})

describe('getEssentialArticlesResponseSchema', () => {
  test('valida response completo', () => {
    const result = getEssentialArticlesResponseSchema.safeParse({
      success: true,
      essentialCount: 5,
      essentialArticles: [
        { number: 14, law: 'CE', questionsCount: 3 },
        { number: '23', law: 'CE', questionsCount: 2 },
      ],
      totalQuestions: 25,
      byDifficulty: { easy: 10, medium: 10, hard: 5 },
    })
    expect(result.success).toBe(true)
  })
})

describe('helpers safeParse*', () => {
  test('safeParseGetArticles valida correctamente', () => {
    const valid = safeParseGetArticles({
      lawShortName: 'CE',
      positionType: 'auxiliar_administrativo_estado',
    })
    expect(valid.success).toBe(true)

    const invalid = safeParseGetArticles({})
    expect(invalid.success).toBe(false)
  })

  test('safeParseEstimateQuestions valida correctamente', () => {
    const valid = safeParseEstimateQuestions({
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
    })
    expect(valid.success).toBe(true)

    const invalid = safeParseEstimateQuestions({ topicNumber: 'abc' })
    expect(invalid.success).toBe(false)
  })

  test('safeParseGetEssentialArticles valida correctamente', () => {
    const valid = safeParseGetEssentialArticles({
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
    })
    expect(valid.success).toBe(true)

    const invalid = safeParseGetEssentialArticles({})
    expect(invalid.success).toBe(false)
  })
})

describe('helpers validate*', () => {
  test('validateGetArticles lanza en datos invalidos', () => {
    expect(() => validateGetArticles({})).toThrow()
  })

  test('validateEstimateQuestions lanza en datos invalidos', () => {
    expect(() => validateEstimateQuestions({})).toThrow()
  })

  test('validateGetEssentialArticles lanza en datos invalidos', () => {
    expect(() => validateGetEssentialArticles({})).toThrow()
  })
})
