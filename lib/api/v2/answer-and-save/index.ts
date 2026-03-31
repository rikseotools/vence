// lib/api/v2/answer-and-save/index.ts
export {
  answerAndSaveRequestSchema,
  answerAndSaveResponseSchema,
  safeParseAnswerAndSaveRequest,
  type AnswerAndSaveRequest,
  type AnswerAndSaveResponse,
} from './schemas'

export {
  validateAndSaveAnswer,
  markActiveStudentIfFirst,
} from './queries'
