/**
 * Types for Admin Feedback Module
 *
 * Nota: Supabase retorna datos con snake_case (column names).
 * Drizzle usa camelCase internamente pero los schemas validan la estructura.
 *
 * Este archivo proporciona:
 * - Schemas Zod derivados de Drizzle (validación)
 * - Tipos compatibles con respuestas de Supabase (snake_case)
 * - Configuración UI y helpers
 */

import { createSelectSchema, createInsertSchema } from 'drizzle-zod'
import { z } from 'zod'
import {
  userFeedback,
  feedbackConversations,
  feedbackMessages,
  userProfiles
} from '@/db/schema'

// ============================================
// ZOD SCHEMAS (derivados de Drizzle)
// Para validación de datos
// ============================================

export const userFeedbackDrizzleSchema = createSelectSchema(userFeedback)
export const feedbackConversationDrizzleSchema = createSelectSchema(feedbackConversations)
export const feedbackMessageDrizzleSchema = createSelectSchema(feedbackMessages)
export const userProfileDrizzleSchema = createSelectSchema(userProfiles)

// Schemas de inserción
export const userFeedbackInsertSchema = createInsertSchema(userFeedback)
export const feedbackConversationInsertSchema = createInsertSchema(feedbackConversations)
export const feedbackMessageInsertSchema = createInsertSchema(feedbackMessages)

// ============================================
// TIPOS PARA RESPUESTAS SUPABASE (snake_case)
// Estos coinciden con lo que Supabase realmente retorna
// ============================================

export interface UserProfileResponse {
  id: string
  email: string
  full_name?: string | null
  nickname?: string | null
  plan_type?: string | null
  target_oposicion?: string | null
  registration_date?: string | null
  created_at?: string | null
  ciudad?: string | null
  is_active_student?: boolean | null
  // Campos agregados desde user_sessions (no en tabla original)
  browserName?: string | null
  operatingSystem?: string | null
  deviceModel?: string | null
  // Campo agregado desde cancellation_feedback
  cancellationType?: string | null
}

export interface FeedbackMessageResponse {
  id: string
  conversation_id: string
  sender_id: string
  is_admin: boolean
  message: string
  created_at: string
  read_at?: string | null
  // Join con user_profiles - puede ser objeto o array (Supabase behavior)
  sender?: {
    full_name?: string | null
    email?: string | null
  } | Array<{
    full_name?: string | null
    email?: string | null
  }> | null
}

export interface FeedbackConversationResponse {
  id: string
  feedback_id: string
  user_id: string
  status: ConversationStatus
  last_message_at: string
  created_at: string
  updated_at?: string | null
  closed_at?: string | null
  admin_user_id?: string | null
  admin_viewed_at?: string | null
  // Joins
  feedback_messages?: FeedbackMessageResponse[]
  feedback?: FeedbackResponse
}

export interface FeedbackResponse {
  id: string
  user_id?: string | null
  email?: string | null
  type: string
  message: string
  url?: string | null
  user_agent?: string | null
  viewport?: string | null
  referrer?: string | null
  screenshot_url?: string | null
  status: string
  priority?: string | null
  admin_response?: string | null
  admin_user_id?: string | null
  wants_response?: boolean | null
  created_at: string
  updated_at?: string | null
  resolved_at?: string | null
  question_id?: string | null
  // Join con user_profiles
  user_profiles?: UserProfileResponse | null
}

// ============================================
// TIPOS PARA UI
// ============================================

export interface UserWithConversations {
  id: string
  odeName: string
  key: string
  email: string | null
  name: string | null
  planType: string
  registrationDate?: string
  targetOposicion?: string | null
  isActiveStudent?: boolean
  feedbacks: FeedbackResponse[]
  totalConversations: number
  pendingConversations: number
  lastActivity: string
  // Campos adicionales
  cancellationType?: string | null
  ciudad?: string | null
  browserName?: string | null
  operatingSystem?: string | null
  deviceModel?: string | null
}

export interface FeedbackStats {
  total: number
  pending: number
  resolved: number
  dismissed: number
}

// ============================================
// TIPOS PARA ESTADOS Y FILTROS
// ============================================

export const feedbackTypeValues = ['bug', 'suggestion', 'content', 'design', 'praise', 'other'] as const
export type FeedbackType = typeof feedbackTypeValues[number]

export const feedbackStatusValues = ['pending', 'in_review', 'in_progress', 'resolved', 'dismissed'] as const
export type FeedbackStatus = typeof feedbackStatusValues[number]

export const conversationStatusValues = ['waiting_admin', 'waiting_user', 'open', 'closed', 'resolved', 'dismissed'] as const
export type ConversationStatus = typeof conversationStatusValues[number]

export const filterTypeValues = ['all', 'pending', 'resolved', 'dismissed'] as const
export type FilterType = typeof filterTypeValues[number]

// ============================================
// ZOD SCHEMAS PARA VALIDACIÓN
// ============================================

export const feedbackTypeSchema = z.enum(feedbackTypeValues)
export const feedbackStatusSchema = z.enum(feedbackStatusValues)
export const conversationStatusSchema = z.enum(conversationStatusValues)

export const feedbackUpdateSchema = z.object({
  status: feedbackStatusSchema.optional(),
  admin_response: z.string().optional(),
  admin_user_id: z.string().uuid().optional(),
  resolved_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export const conversationUpdateSchema = z.object({
  status: conversationStatusSchema.optional(),
  last_message_at: z.string().optional(),
  admin_viewed_at: z.string().optional(),
  closed_at: z.string().optional(),
})

export const newMessageSchema = z.object({
  conversation_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  is_admin: z.boolean(),
  message: z.string().min(1, 'El mensaje no puede estar vacío'),
})

// ============================================
// CONFIGURACIÓN UI
// ============================================

export interface TypeConfig {
  label: string
  color: string
}

export const FEEDBACK_TYPES: Record<FeedbackType, TypeConfig> = {
  'bug': { label: '🐛 Bug', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
  'suggestion': { label: '💡 Sugerencia', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
  'content': { label: '📚 Contenido', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
  'design': { label: '🎨 Diseño', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300' },
  'praise': { label: '⭐ Felicitación', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
  'other': { label: '❓ Otro', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' }
}

export const STATUS_CONFIG: Record<FeedbackStatus, TypeConfig> = {
  'pending': { label: '⏳ Pendiente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
  'in_review': { label: '👀 En Revisión', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
  'in_progress': { label: '🔄 En Progreso', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300' },
  'resolved': { label: '✅ Cerrado', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
  'dismissed': { label: '❌ Descartado', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' }
}

// ============================================
// HELPERS
// ============================================

/**
 * Helper para obtener info del sender que puede ser objeto o array (Supabase join behavior)
 */
export function getSenderInfo(
  sender: FeedbackMessageResponse['sender']
): { full_name?: string | null; email?: string | null } | undefined {
  if (!sender) return undefined
  if (Array.isArray(sender)) return sender[0]
  return sender
}

/**
 * Valida datos de actualización de feedback
 */
export function validateFeedbackUpdate(data: unknown) {
  return feedbackUpdateSchema.parse(data)
}

/**
 * Valida datos de nuevo mensaje
 */
export function validateNewMessage(data: unknown) {
  return newMessageSchema.parse(data)
}

// ============================================
// TIPO PARA AUTH CONTEXT
// ============================================

export interface AuthUser {
  id: string
  email?: string
  [key: string]: unknown
}

export interface AuthContextType {
  user: AuthUser | null
  supabase: import('@supabase/supabase-js').SupabaseClient
  loading?: boolean
  [key: string]: unknown
}
