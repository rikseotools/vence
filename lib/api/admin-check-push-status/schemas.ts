// lib/api/admin-check-push-status/schemas.ts
import { z } from 'zod/v3'

// ============================================
// RESPONSE: CHECK ALL PUSH STATUS
// ============================================

const userPushDetailSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  status: z.enum(['active', 'inactive', 'test_user', 'invalid_subscription', 'never_configured']),
  statusLabel: z.string(),
  details: z.string(),
  created: z.string().nullable(),
  lastUpdate: z.string()
})

export type UserPushDetail = z.infer<typeof userPushDetailSchema>

const pushStatsSchema = z.object({
  totalUsers: z.number(),
  activeUsers: z.number(),
  inactiveUsers: z.number(),
  expiredUsers: z.number(),
  neverConfigured: z.number(),
  details: z.array(userPushDetailSchema)
})

export type PushStats = z.infer<typeof pushStatsSchema>

export const checkPushStatusResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  stats: pushStatsSchema,
  timestamp: z.string(),
  summary: z.string()
})

export type CheckPushStatusResponse = z.infer<typeof checkPushStatusResponseSchema>

// ============================================
// RESPONSE: ERROR
// ============================================

export const checkPushStatusErrorSchema = z.object({
  error: z.string()
})

export type CheckPushStatusError = z.infer<typeof checkPushStatusErrorSchema>
