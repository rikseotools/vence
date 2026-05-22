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
  // Test de repaso de fallos
  failedQuestionsOrderSchema,
  failedQuestionsScopeSchema,
  createFailedQuestionsTestRequestSchema,
  testLayoutQuestionSchema,
  createFailedQuestionsTestResponseSchema,
  testConfigSchema,
  safeParseCreateFailedQuestionsTest,
  safeParseTestLayoutQuestions,
  type FailedQuestionsOrder,
  type FailedQuestionsScope,
  type CreateFailedQuestionsTestRequest,
  type TestLayoutQuestion,
  type CreateFailedQuestionsTestResponse,
  type TestConfig,
} from './schemas'

// Queries
export {
  recoverTest,
  checkNeedsOnboarding,
  // Test de repaso de fallos (Drizzle)
  getFailedQuestionsForUser,
} from './queries'
