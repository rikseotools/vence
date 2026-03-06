/**
 * Tests para el barrel export de lib/api/test-config/index.ts
 * Verifica que todos los exports necesarios estan disponibles
 */
import * as testConfigModule from '../../../lib/api/test-config'

describe('lib/api/test-config barrel exports', () => {
  describe('schemas', () => {
    test('getArticlesRequestSchema esta exportado', () => {
      expect(testConfigModule.getArticlesRequestSchema).toBeDefined()
      expect(typeof testConfigModule.getArticlesRequestSchema.safeParse).toBe('function')
    })

    test('getArticlesResponseSchema esta exportado', () => {
      expect(testConfigModule.getArticlesResponseSchema).toBeDefined()
      expect(typeof testConfigModule.getArticlesResponseSchema.safeParse).toBe('function')
    })

    test('articleItemSchema esta exportado', () => {
      expect(testConfigModule.articleItemSchema).toBeDefined()
    })

    test('estimateQuestionsRequestSchema esta exportado', () => {
      expect(testConfigModule.estimateQuestionsRequestSchema).toBeDefined()
      expect(typeof testConfigModule.estimateQuestionsRequestSchema.safeParse).toBe('function')
    })

    test('estimateQuestionsResponseSchema esta exportado', () => {
      expect(testConfigModule.estimateQuestionsResponseSchema).toBeDefined()
    })

    test('getEssentialArticlesRequestSchema esta exportado', () => {
      expect(testConfigModule.getEssentialArticlesRequestSchema).toBeDefined()
    })

    test('getEssentialArticlesResponseSchema esta exportado', () => {
      expect(testConfigModule.getEssentialArticlesResponseSchema).toBeDefined()
    })

    test('essentialArticleItemSchema esta exportado', () => {
      expect(testConfigModule.essentialArticleItemSchema).toBeDefined()
    })
  })

  describe('helpers', () => {
    test('safeParseGetArticles esta exportado', () => {
      expect(typeof testConfigModule.safeParseGetArticles).toBe('function')
    })

    test('validateGetArticles esta exportado', () => {
      expect(typeof testConfigModule.validateGetArticles).toBe('function')
    })

    test('safeParseEstimateQuestions esta exportado', () => {
      expect(typeof testConfigModule.safeParseEstimateQuestions).toBe('function')
    })

    test('validateEstimateQuestions esta exportado', () => {
      expect(typeof testConfigModule.validateEstimateQuestions).toBe('function')
    })

    test('safeParseGetEssentialArticles esta exportado', () => {
      expect(typeof testConfigModule.safeParseGetEssentialArticles).toBe('function')
    })

    test('validateGetEssentialArticles esta exportado', () => {
      expect(typeof testConfigModule.validateGetEssentialArticles).toBe('function')
    })
  })

  describe('queries', () => {
    test('getArticlesForLaw esta exportado', () => {
      expect(typeof testConfigModule.getArticlesForLaw).toBe('function')
    })

    test('estimateAvailableQuestions esta exportado', () => {
      expect(typeof testConfigModule.estimateAvailableQuestions).toBe('function')
    })

    test('getEssentialArticles esta exportado', () => {
      expect(typeof testConfigModule.getEssentialArticles).toBe('function')
    })
  })

  describe('funcionalidad via barrel import', () => {
    test('safeParse funciona para getArticles', () => {
      const valid = testConfigModule.safeParseGetArticles({
        lawShortName: 'CE',
        positionType: 'auxiliar_administrativo',
      })
      expect(valid.success).toBe(true)

      const invalid = testConfigModule.safeParseGetArticles({})
      expect(invalid.success).toBe(false)
    })

    test('safeParse funciona para estimateQuestions', () => {
      const valid = testConfigModule.safeParseEstimateQuestions({
        topicNumber: 1,
        positionType: 'auxiliar_administrativo',
      })
      expect(valid.success).toBe(true)
    })

    test('safeParse funciona para getEssentialArticles', () => {
      const valid = testConfigModule.safeParseGetEssentialArticles({
        topicNumber: 1,
        positionType: 'auxiliar_administrativo',
      })
      expect(valid.success).toBe(true)
    })
  })
})
