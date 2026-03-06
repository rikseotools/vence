// lib/api/auth/index.ts - Exports del modulo de auth callback v2

// Schemas y tipos
export {
  processCallbackRequestSchema,
  processCallbackResponseSchema,
  safeParseProcessCallbackRequest,
  validateProcessCallbackRequest,
  type ProcessCallbackRequest,
  type ProcessCallbackResponse,
} from './schemas'

// Queries
export {
  processAuthCallback,
} from './queries'
