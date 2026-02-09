// lib/api/close-inactive-feedback/schemas.ts
// Schemas de validación para el cron de cierre de feedback inactivos
import { z } from 'zod/v3'

// ============================================
// CONFIGURACIÓN
// ============================================

export const DAYS_WAITING_USER = 7    // Días para cerrar si usuario no responde
export const DAYS_OPEN_INACTIVE = 14  // Días para cerrar conversaciones abiertas sin actividad
export const DAYS_WAITING_ADMIN = 30  // Días para cerrar waiting_admin muy antiguos

// ============================================
// RESPONSE SCHEMAS
// ============================================

export const closedCountsSchema = z.object({
  waiting_user: z.number(),
  open: z.number(),
  waiting_admin_old: z.number(),
  total: z.number(),
})

export type ClosedCounts = z.infer<typeof closedCountsSchema>

export const configSchema = z.object({
  days_waiting_user: z.number(),
  days_open_inactive: z.number(),
  days_waiting_admin: z.number(),
})

export type Config = z.infer<typeof configSchema>

export const closeInactiveFeedbackResponseSchema = z.object({
  success: z.boolean(),
  closed: closedCountsSchema.optional(),
  config: configSchema.optional(),
  timestamp: z.string().optional(),
  error: z.string().optional(),
})

export type CloseInactiveFeedbackResponse = z.infer<typeof closeInactiveFeedbackResponseSchema>

// ============================================
// INTERNAL TYPES
// ============================================

export interface ConversationToCheck {
  id: string
  userId: string | null
  createdAt: string | null
}

export interface LastMessage {
  isAdmin: boolean | null
  createdAt: string | null
}
