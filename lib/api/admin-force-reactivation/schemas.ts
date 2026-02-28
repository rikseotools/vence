// lib/api/admin-force-reactivation/schemas.ts
import { z } from 'zod/v3'

// ============================================
// REQUEST: FORCE REACTIVATION PROMPT
// ============================================

export const forceReactivationRequestSchema = z.object({
  userId: z.string().uuid(),
  userEmail: z.string().email(),
  forcedBy: z.string().optional()
})

export type ForceReactivationRequest = z.infer<typeof forceReactivationRequestSchema>

// ============================================
// RESPONSE: FORCE REACTIVATION PROMPT
// ============================================

export const forceReactivationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  details: z.object({
    userId: z.string(),
    userEmail: z.string(),
    action: z.string(),
    forcedBy: z.string().optional(),
    timestamp: z.string(),
    nextStep: z.string()
  })
})

export type ForceReactivationResponse = z.infer<typeof forceReactivationResponseSchema>

// ============================================
// RESPONSE: ERROR
// ============================================

export const forceReactivationErrorSchema = z.object({
  error: z.string()
})

export type ForceReactivationError = z.infer<typeof forceReactivationErrorSchema>
