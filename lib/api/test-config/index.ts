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
  getScopedSectionsRequestSchema,
  getScopedSectionsResponseSchema,
  scopedLawSectionSchema,
  sectionScopeMetaSchema,
  safeParseGetArticles,
  validateGetArticles,
  safeParseEstimateQuestions,
  validateEstimateQuestions,
  safeParseGetEssentialArticles,
  validateGetEssentialArticles,
  safeParseGetScopedSections,
  validateGetScopedSections,
  type GetArticlesRequest,
  type GetArticlesResponse,
  type ArticleItem,
  type EstimateQuestionsRequest,
  type EstimateQuestionsResponse,
  type GetEssentialArticlesRequest,
  type GetEssentialArticlesResponse,
  type EssentialArticleItem,
  type GetScopedSectionsRequest,
  type GetScopedSectionsResponse,
  type ScopedLawSection,
  type SectionScopeMeta,
} from './schemas'

// Queries
export {
  getArticlesForLaw,
  estimateAvailableQuestions,
  getEssentialArticles,
  getScopedLawSections,
} from './queries'
