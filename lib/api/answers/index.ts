// lib/api/answers/index.ts - Exports del módulo de respuestas

// Schemas y tipos
export {
  validateAnswerRequestSchema,
  validateAnswerResponseSchema,
  errorResponseSchema,
  safeParseAnswerRequest,
  validateAnswerRequest,
  type ValidateAnswerRequest,
  type ValidateAnswerResponse,
  type ErrorResponse
} from './schemas'

// Queries
export {
  validateAnswer,
  getCorrectAnswer
} from './queries'
