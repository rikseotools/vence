// lib/api/admin-send-personal-test/schemas.ts - Schemas para envío de notificación personal
import { z } from 'zod/v3'

// ============================================
// REQUEST
// ============================================

export const sendPersonalTestRequestSchema = z.object({
  adminEmail: z.string().email(),
  title: z.string().min(1),
  body: z.string().min(1),
  category: z.string().optional(),
  data: z.record(z.unknown()).optional(),
})

export type SendPersonalTestRequest = z.infer<typeof sendPersonalTestRequestSchema>

// ============================================
// RESPONSE
// ============================================

export const sendPersonalTestResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  details: z.object({
    pushStatusCode: z.number(),
    pushHeaders: z.record(z.unknown()).optional(),
    userId: z.string().uuid(),
    title: z.string(),
    category: z.string(),
    timestamp: z.string(),
    domain: z.string(),
  }).optional(),
  error: z.string().optional(),
})

export type SendPersonalTestResponse = z.infer<typeof sendPersonalTestResponseSchema>
