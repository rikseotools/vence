// lib/api/admin-pending-counts/schemas.ts - Schemas para conteo de impugnaciones pendientes
import { z } from 'zod/v3'

// ============================================
// RESPONSE
// ============================================

export const pendingCountsResponseSchema = z.object({
  success: z.boolean(),
  impugnaciones: z.number().int().min(0),
  detail: z.object({
    normal: z.number().int().min(0),
    psychometric: z.number().int().min(0),
  }),
})

export type PendingCountsResponse = z.infer<typeof pendingCountsResponseSchema>

// ============================================
// ERROR RESPONSE
// ============================================

export const pendingCountsErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  impugnaciones: z.literal(0),
})

export type PendingCountsError = z.infer<typeof pendingCountsErrorSchema>
