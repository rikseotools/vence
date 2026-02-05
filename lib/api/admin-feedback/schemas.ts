// lib/api/admin-feedback/schemas.ts - Schemas de validación para admin feedback
// Usar zod/v3 para compatibilidad con Zod 4
import { z } from 'zod/v3'

// ============================================
// VALORES PERMITIDOS
// ============================================

export const feedbackStatusOptions = ['pending', 'in_review', 'in_progress', 'resolved', 'dismissed'] as const
export const conversationStatusOptions = ['waiting_admin', 'waiting_user', 'open', 'closed', 'resolved', 'dismissed'] as const
export const filterTypeOptions = ['all', 'pending', 'resolved', 'dismissed', 'in_progress'] as const

export type FeedbackStatus = typeof feedbackStatusOptions[number]
export type ConversationStatus = typeof conversationStatusOptions[number]
export type FilterType = typeof filterTypeOptions[number]

// ============================================
// REQUEST: GET FEEDBACKS (Query params)
// ============================================

export const getFeedbacksQuerySchema = z.object({
  filter: z.enum(filterTypeOptions).default('all'),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

export type GetFeedbacksQuery = z.infer<typeof getFeedbacksQuerySchema>

// ============================================
// REQUEST: ADMIN SEND MESSAGE
// ============================================

export const adminSendMessageSchema = z.object({
  conversationId: z.string().uuid('ID de conversación inválido'),
  message: z.string().min(1, 'El mensaje no puede estar vacío').max(10000, 'Mensaje demasiado largo'),
  adminUserId: z.string().uuid('ID de admin inválido'),
})

export type AdminSendMessageRequest = z.infer<typeof adminSendMessageSchema>

// ============================================
// REQUEST: UPDATE FEEDBACK STATUS
// ============================================

export const updateFeedbackStatusSchema = z.object({
  feedbackId: z.string().uuid('ID de feedback inválido'),
  status: z.enum(feedbackStatusOptions),
  adminUserId: z.string().uuid('ID de admin inválido'),
  adminResponse: z.string().max(10000).optional(),
})

export type UpdateFeedbackStatusRequest = z.infer<typeof updateFeedbackStatusSchema>

// ============================================
// REQUEST: CREATE CONVERSATION
// ============================================

export const createConversationSchema = z.object({
  feedbackId: z.string().uuid('ID de feedback inválido'),
  adminUserId: z.string().uuid('ID de admin inválido'),
})

export type CreateConversationRequest = z.infer<typeof createConversationSchema>

// ============================================
// REQUEST: MARK MESSAGES AS READ
// ============================================

export const markMessagesReadSchema = z.object({
  conversationId: z.string().uuid('ID de conversación inválido'),
  adminUserId: z.string().uuid('ID de admin inválido'),
})

export type MarkMessagesReadRequest = z.infer<typeof markMessagesReadSchema>

// ============================================
// RESPONSE TYPES
// ============================================

export interface FeedbackWithDetails {
  id: string
  userId: string | null
  email: string | null
  type: string
  message: string
  url: string
  userAgent: string | null
  viewport: string | null
  referrer: string | null
  screenshotUrl: string | null
  status: string | null
  priority: string | null
  adminResponse: string | null
  adminUserId: string | null
  wantsResponse: boolean | null
  createdAt: string | null
  updatedAt: string | null
  resolvedAt: string | null
  questionId: string | null
}

export interface ConversationWithMessages {
  id: string
  feedbackId: string | null
  userId: string | null
  adminUserId: string | null
  status: string | null
  lastMessageAt: string | null
  createdAt: string | null
  adminViewedAt: string | null
  messages: MessageWithSender[]
  feedback?: FeedbackWithDetails | null
}

export interface MessageWithSender {
  id: string
  conversationId: string | null
  senderId: string | null
  isAdmin: boolean | null
  message: string
  createdAt: string | null
  readAt: string | null
  sender?: {
    fullName: string | null
    email: string | null
  } | null
}

export interface UserProfile {
  id: string
  email: string | null
  fullName: string | null
  nickname: string | null
  planType: string | null
  targetOposicion: string | null
  registrationDate: string | null
  createdAt: string | null
  ciudad: string | null
  isActiveStudent: boolean | null
}

export interface FeedbackStats {
  total: number
  pending: number
  inProgress: number
  resolved: number
  dismissed: number
}

// ============================================
// API RESPONSE WRAPPERS
// ============================================

export interface AdminFeedbackResponse<T> {
  success: boolean
  data?: T
  error?: string
  stats?: FeedbackStats
}

export interface PaginatedResponse<T> {
  success: boolean
  data?: T[]
  total?: number
  offset?: number
  limit?: number
  error?: string
}

// ============================================
// VALIDATORS
// ============================================

export function safeParseGetFeedbacksQuery(data: unknown) {
  return getFeedbacksQuerySchema.safeParse(data)
}

export function safeParseAdminSendMessage(data: unknown) {
  return adminSendMessageSchema.safeParse(data)
}

export function safeParseUpdateFeedbackStatus(data: unknown) {
  return updateFeedbackStatusSchema.safeParse(data)
}

export function safeParseCreateConversation(data: unknown) {
  return createConversationSchema.safeParse(data)
}

export function safeParseMarkMessagesRead(data: unknown) {
  return markMessagesReadSchema.safeParse(data)
}
