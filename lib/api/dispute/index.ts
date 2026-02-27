// lib/api/dispute/index.ts - Exports del módulo de impugnaciones

// Schemas y tipos
export {
  disputeTypeOptions,
  disputeStatusOptions,
  createDisputeRequestSchema,
  disputeDataSchema,
  createDisputeResponseSchema,
  safeParseCreateDisputeRequest,
  validateCreateDisputeRequest,
  type DisputeType,
  type DisputeStatus,
  type CreateDisputeRequest,
  type DisputeData,
  type CreateDisputeResponse,
} from './schemas'

// Queries
export { createDispute } from './queries'
