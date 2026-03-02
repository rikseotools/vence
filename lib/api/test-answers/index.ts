// lib/api/test-answers/index.ts - Re-exports
export {
  deviceInfoSchema,
  questionDataSchema,
  answerDataSchema,
  saveAnswerRequestSchema,
  saveAnswerResponseSchema,
  safeParseSaveAnswerRequest,
  type DeviceInfo,
  type QuestionData,
  type AnswerData,
  type SaveAnswerRequest,
  type SaveAnswerResponse,
} from './schemas'

export { insertTestAnswer } from './queries'
