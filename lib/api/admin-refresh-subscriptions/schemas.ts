// lib/api/admin-refresh-subscriptions/schemas.ts
import { z } from 'zod/v3'

// ============================================
// RESPONSE: REFRESH SUBSCRIPTIONS
// ============================================

const subscriptionErrorSchema = z.object({
  user_id: z.string(),
  error: z.string()
})

const refreshResultsSchema = z.object({
  total: z.number(),
  valid: z.number(),
  expired: z.number(),
  renewed: z.number(),
  errors: z.array(subscriptionErrorSchema)
})

export type RefreshResults = z.infer<typeof refreshResultsSchema>

export const refreshSubscriptionsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  results: refreshResultsSchema
})

export type RefreshSubscriptionsResponse = z.infer<typeof refreshSubscriptionsResponseSchema>

// ============================================
// RESPONSE: ERROR
// ============================================

export const refreshSubscriptionsErrorSchema = z.object({
  error: z.string()
})

export type RefreshSubscriptionsError = z.infer<typeof refreshSubscriptionsErrorSchema>
