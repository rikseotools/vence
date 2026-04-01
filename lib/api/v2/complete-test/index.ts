// lib/api/v2/complete-test/index.ts
export {
  completeTestRequestSchema,
  completeTestResponseSchema,
  safeParseCompleteTestRequest,
  type CompleteTestRequest,
  type CompleteTestResponse,
  type DetailedAnswerInput,
} from './schemas'

export {
  completeTest,
} from './queries'
