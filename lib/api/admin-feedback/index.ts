// lib/api/admin-feedback/index.ts - Exports del módulo admin feedback

// Schemas y tipos
export {
  feedbackStatusOptions,
  conversationStatusOptions,
  filterTypeOptions,
  getFeedbacksQuerySchema,
  adminSendMessageSchema,
  updateFeedbackStatusSchema,
  createConversationSchema,
  markMessagesReadSchema,
  safeParseGetFeedbacksQuery,
  safeParseAdminSendMessage,
  safeParseUpdateFeedbackStatus,
  safeParseCreateConversation,
  safeParseMarkMessagesRead,
  type FeedbackStatus,
  type ConversationStatus,
  type FilterType,
  type GetFeedbacksQuery,
  type AdminSendMessageRequest,
  type UpdateFeedbackStatusRequest,
  type CreateConversationRequest,
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
export {
  getAllFeedbacks,
  getConversationsWithMessages,
  getFeedbackStats,
  getUserProfiles,
  adminSendMessage,
  updateFeedbackStatus,
  createConversation,
  markMessagesAsRead,
  getPendingCounts,
} from './queries'
