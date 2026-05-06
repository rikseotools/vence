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

// Queries (uncached versions — para code paths que necesitan datos frescos)
export {
  getArticlesForLaw,
  estimateAvailableQuestions,
  getEssentialArticles,
  getScopedLawSections,
} from './queries'

// Queries cached (Fase 4 — tag 'test-config'). Las routes públicas usan
// estas; los hits llegan a unstable_cache con TTL 1-24h. Para invalidar:
// lib/cache/test-config.ts:invalidateTestConfigCache.
export {
  getArticlesForLawCached,
  getEssentialArticlesCached,
  getScopedLawSectionsCached,
  estimateAvailableQuestionsCached,
} from './queries'
