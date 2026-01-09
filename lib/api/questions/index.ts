// lib/api/questions/index.ts - Exports del módulo de preguntas

// Schemas y tipos
export {
  getQuestionHistoryRequestSchema,
  getQuestionHistoryResponseSchema,
  questionHistoryItemSchema,
  getRecentQuestionsRequestSchema,
  getRecentQuestionsResponseSchema,
  getUserAnalyticsRequestSchema,
  getUserAnalyticsResponseSchema,
  analyticsResponseItemSchema,
  validateGetQuestionHistory,
  validateGetRecentQuestions,
  safeParseGetQuestionHistory,
  safeParseGetRecentQuestions,
  safeParseGetUserAnalytics,
  type GetQuestionHistoryRequest,
  type GetQuestionHistoryResponse,
  type QuestionHistoryItem,
  type GetRecentQuestionsRequest,
  type GetRecentQuestionsResponse,
  type GetUserAnalyticsRequest,
  type GetUserAnalyticsResponse,
  type AnalyticsResponseItem,
} from './schemas'

// Queries
export {
  getQuestionHistory,
  getRecentQuestions,
  getUserAnalytics,
} from './queries'
