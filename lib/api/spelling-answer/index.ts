// lib/api/spelling-answer/index.ts
export {
  validateSpellingAnswerRequestSchema,
  validateSpellingAnswerResponseSchema,
  createSpellingSessionRequestSchema,
  saveSpellingAnswerRequestSchema,
  completeSpellingSessionRequestSchema,
  safeParseSpellingAnswerRequest,
  type ValidateSpellingAnswerRequest,
  type ValidateSpellingAnswerResponse,
  type CreateSpellingSessionRequest,
  type CreateSpellingSessionResponse,
  type SaveSpellingAnswerRequest,
  type CompleteSpellingSessionRequest,
} from './schemas'

export {
  validateSpellingAnswer,
  createSpellingSession,
  saveSpellingAnswer,
  completeSpellingSession,
} from './queries'
