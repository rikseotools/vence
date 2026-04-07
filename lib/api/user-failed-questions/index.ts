// lib/api/user-failed-questions/index.ts - Exports del módulo de preguntas falladas

// Schemas y tipos
export {
  getUserFailedQuestionsRequestSchema,
  getUserFailedQuestionsResponseSchema,
  failedQuestionItemSchema,
  failedByTopicItemSchema,
  safeParseGetUserFailedQuestions,
  type GetUserFailedQuestionsRequest,
  type GetUserFailedQuestionsResponse,
  type FailedQuestionItem,
  type FailedByTopicItem,
} from './schemas'

// Queries
export {
  getUserFailedQuestions,
  getFailedQuestionsByTopic,
} from './queries'
