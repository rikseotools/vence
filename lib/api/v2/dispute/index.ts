// lib/api/v2/dispute/index.ts

export {
  questionTypeSchema,
  disputeTypeSchema,
  disputeResolutionStatusSchema,
  createDisputeRequestSchema,
  createDisputeResponseSchema,
  getDisputeRequestSchema,
  getDisputeResponseSchema,
  existingDisputeSchema,
  resolveDisputeRequestSchema,
  resolveDisputeResponseSchema,
  disputeErrorSchema,
  type QuestionType,
  type DisputeType,
  type DisputeResolutionStatus,
  type CreateDisputeRequest,
  type CreateDisputeResponse,
  type GetDisputeRequest,
  type GetDisputeResponse,
  type ExistingDispute,
  type ResolveDisputeRequest,
  type ResolveDisputeResponse,
  type DisputeError,
} from './schemas'

export {
  getExistingDispute,
  createDispute,
  resolveDispute,
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
