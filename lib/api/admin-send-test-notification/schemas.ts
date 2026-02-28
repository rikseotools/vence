// lib/api/admin-send-test-notification/schemas.ts - Schemas para envío de notificación de prueba
import { z } from 'zod/v3'

// ============================================
// REQUEST
// ============================================

export const sendTestNotificationRequestSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1),
  body: z.string().min(1),
  category: z.string().optional(),
  data: z.record(z.unknown()).optional(),
})

export type SendTestNotificationRequest = z.infer<typeof sendTestNotificationRequestSchema>

// ============================================
// RESPONSE
// ============================================

export const sendTestNotificationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  details: z.object({
    pushStatusCode: z.number(),
    pushHeaders: z.record(z.unknown()).optional(),
    userId: z.string().uuid(),
    title: z.string(),
    category: z.string().optional(),
    timestamp: z.string(),
  }).optional(),
  error: z.string().optional(),
})

export type SendTestNotificationResponse = z.infer<typeof sendTestNotificationResponseSchema>
