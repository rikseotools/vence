// lib/api/dispute/index.ts - Exports del módulo de impugnaciones

// Schemas y tipos
export {
  disputeTypeOptions,
  disputeStatusOptions,
  createDisputeRequestSchema,
  disputeDataSchema,
  createDisputeResponseSchema,
  safeParseCreateDisputeRequest,
  safeParseAppealDisputeRequest,
  validateCreateDisputeRequest,
  type DisputeType,
  type DisputeStatus,
  type CreateDisputeRequest,
  type DisputeData,
  type CreateDisputeResponse,
  type ExistingDisputeData,
  type GetExistingDisputeResponse,
  type AppealDisputeRequest,
  type AppealDisputeResponse,
} from './schemas'

// Queries
export { createDispute, getExistingDispute, handleDisputeAppeal } from './queries'
