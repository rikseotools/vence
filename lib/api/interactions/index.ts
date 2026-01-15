// lib/api/interactions/index.ts - Exports del módulo de interacciones

// Schemas y tipos
export {
  eventCategories,
  trackInteractionRequestSchema,
  trackBatchInteractionsRequestSchema,
  trackInteractionResponseSchema,
  errorResponseSchema,
  safeParseInteractionRequest,
  safeParseInteractionBatchRequest,
  validateInteractionRequest,
  validateInteractionBatchRequest,
  type EventCategory,
  type TrackInteractionRequest,
  type TrackBatchInteractionsRequest,
  type TrackInteractionResponse,
  type ErrorResponse
} from './schemas'

// Queries
export {
  trackInteraction,
  trackBatchInteractions,
  getInteractionsByUser,
  getInteractionStats
} from './queries'
