// lib/api/topic-progress/index.ts - Exports del módulo de progreso por tema

// Schemas y tipos
export {
  weakArticleSchema,
  topicProgressSchema,
  getTopicProgressRequestSchema,
  getTopicProgressResponseSchema,
  getWeakArticlesRequestSchema,
  getWeakArticlesResponseSchema,
  safeParseGetTopicProgress,
  safeParseGetWeakArticles,
  type WeakArticle,
  type TopicProgress,
  type GetTopicProgressRequest,
  type GetTopicProgressResponse,
  type GetWeakArticlesRequest,
  type GetWeakArticlesResponse,
} from './schemas'

// Queries
export {
  getWeakArticlesForUser,
} from './queries'
