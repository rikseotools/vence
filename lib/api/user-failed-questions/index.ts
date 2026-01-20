// lib/api/user-failed-questions/index.ts - Exports del módulo de preguntas falladas

// Schemas y tipos
export {
  getUserFailedQuestionsRequestSchema,
  getUserFailedQuestionsResponseSchema,
  failedQuestionItemSchema,
  safeParseGetUserFailedQuestions,
  type GetUserFailedQuestionsRequest,
  type GetUserFailedQuestionsResponse,
  type FailedQuestionItem,
} from './schemas'

// Queries
export {
  getUserFailedQuestions,
} from './queries'
