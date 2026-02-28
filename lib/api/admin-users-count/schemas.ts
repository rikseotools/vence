// lib/api/admin-users-count/schemas.ts - Schemas para conteo de usuarios y suscripciones
import { z } from 'zod/v3'

// ============================================
// RESPONSE
// ============================================

export const usersCountResponseSchema = z.object({
  total: z.number().int().min(0),
  subscribed: z.number().int().min(0),
  unsubscribed: z.number().int().min(0),
  subscriptionRate: z.number().min(0).max(100),
})

export type UsersCountResponse = z.infer<typeof usersCountResponseSchema>
