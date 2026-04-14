// lib/api/admin-feedback/index.ts - Exports del módulo admin feedback

// Schemas y tipos
export {
  feedbackStatusOptions,
  conversationStatusOptions,
  filterTypeOptions,
  getFeedbacksQuerySchema,
  updateFeedbackStatusSchema,
  markMessagesReadSchema,
  safeParseGetFeedbacksQuery,
  safeParseUpdateFeedbackStatus,
  safeParseMarkMessagesRead,
  type FeedbackStatus,
  type ConversationStatus,
  type FilterType,
  type GetFeedbacksQuery,
  type UpdateFeedbackStatusRequest,
  type MarkMessagesReadRequest,
  type FeedbackWithDetails,
  type ConversationWithMessages,
  type MessageWithSender,
  type UserProfile,
  type FeedbackStats,
  type AdminFeedbackResponse,
  type PaginatedResponse,
} from './schemas'

// Queries
// NOTA post-14/04/2026: adminSendMessage() y createConversation() fueron
// eliminadas. El envío de respuestas admin pasa por /api/v2/feedback/respond
// (patrón resolveDispute/respondFeedback). La creación de conversation se
// hace inline en el admin UI (antes de llamar al endpoint).
export {
  getAllFeedbacks,
  getConversationsWithMessages,
  getFeedbackStats,
  getUserProfiles,
  updateFeedbackStatus,
  markMessagesAsRead,
  getPendingCounts,
} from './queries'
