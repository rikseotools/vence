// lib/api/soporte/index.ts - Exports del módulo de soporte

// Schemas y tipos
export {
  feedbackWithConversationSchema,
  soporteDataResponseSchema,
  conversationMessageSchema,
  conversationMessagesResponseSchema,
  type FeedbackWithConversation,
  type SoporteDataResponse,
  type ConversationMessage,
  type ConversationMessagesResponse,
} from './schemas'

// Queries
export {
  getUserFeedbacksWithConversations,
  getConversationMessages,
  getUserDisputes,
} from './queries'
