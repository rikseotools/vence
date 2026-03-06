// lib/api/test-config/index.ts - Exports del módulo de configurador de tests

// Schemas y tipos
export {
  getArticlesRequestSchema,
  getArticlesResponseSchema,
  articleItemSchema,
  estimateQuestionsRequestSchema,
  estimateQuestionsResponseSchema,
  getEssentialArticlesRequestSchema,
  getEssentialArticlesResponseSchema,
  essentialArticleItemSchema,
  safeParseGetArticles,
  validateGetArticles,
  safeParseEstimateQuestions,
  validateEstimateQuestions,
  safeParseGetEssentialArticles,
  validateGetEssentialArticles,
  type GetArticlesRequest,
  type GetArticlesResponse,
  type ArticleItem,
  type EstimateQuestionsRequest,
  type EstimateQuestionsResponse,
  type GetEssentialArticlesRequest,
  type GetEssentialArticlesResponse,
  type EssentialArticleItem,
} from './schemas'

// Queries
export {
  getArticlesForLaw,
  estimateAvailableQuestions,
  getEssentialArticles,
} from './queries'
