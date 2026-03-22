// lib/api/v2/dispute/index.ts

export {
  questionTypeSchema,
  disputeTypeSchema,
  createDisputeRequestSchema,
  createDisputeResponseSchema,
  getDisputeRequestSchema,
  getDisputeResponseSchema,
  existingDisputeSchema,
  disputeErrorSchema,
  type QuestionType,
  type DisputeType,
  type CreateDisputeRequest,
  type CreateDisputeResponse,
  type GetDisputeRequest,
  type GetDisputeResponse,
  type ExistingDispute,
  type DisputeError,
} from './schemas'

export {
  getExistingDispute,
  createDispute,
} from './queries'

export {
  ALL_DISPUTE_TYPES,
  LEGISLATIVE_DISPUTE_TYPES,
  PSYCHOMETRIC_DISPUTE_TYPES,
  COMMON_DISPUTE_TYPES,
  LEGISLATIVE_ONLY_TYPES,
  PSYCHOMETRIC_ONLY_TYPES,
  DISPUTE_TYPE_LABELS,
  type LegislativeDisputeType,
  type PsychometricDisputeType,
} from './types'
