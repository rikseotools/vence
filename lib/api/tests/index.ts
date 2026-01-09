// lib/api/tests/index.ts - Exports del módulo de tests

// Schemas y tipos
export {
  detailedAnswerSchema,
  answeredQuestionSchema,
  pendingTestSchema,
  recoverTestRequestSchema,
  recoverTestResponseSchema,
  validateRecoverTest,
  safeParseRecoverTest,
  safeParsePendingTest,
  type DetailedAnswer,
  type AnsweredQuestion,
  type PendingTest,
  type RecoverTestRequest,
  type RecoverTestResponse,
} from './schemas'

// Queries
export {
  recoverTest,
  checkNeedsOnboarding,
} from './queries'
