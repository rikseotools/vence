// lib/api/close-inactive-feedback/index.ts
// Exportaciones del módulo de cierre de feedback inactivos

export {
  // Schemas
  closedCountsSchema,
  configSchema,
  closeInactiveFeedbackResponseSchema,
  // Types
  type ClosedCounts,
  type Config,
  type CloseInactiveFeedbackResponse,
  type ConversationToCheck,
  type LastMessage,
  // Constants
  DAYS_WAITING_USER,
  DAYS_OPEN_INACTIVE,
  DAYS_WAITING_ADMIN,
} from './schemas'

export {
  // Queries
  getWaitingUserConversations,
  getOpenInactiveConversations,
  getLastMessage,
  closeConversation,
  closeVeryOldWaitingAdmin,
  // Main function
  closeInactiveFeedback,
} from './queries'
