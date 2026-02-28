// lib/api/admin-funnel-users/schemas.ts
import { z } from 'zod/v3'

// ============================================
// STAGES DEL FUNNEL
// ============================================

export const funnelStages = [
  'registrations',
  'completed_first_test',
  'hit_limit',
  'saw_modal',
  'clicked_upgrade',
  'visited_premium',
  'started_checkout',
  'paid'
] as const

export type FunnelStage = typeof funnelStages[number]

// ============================================
// QUERY PARAMS
// ============================================

export const funnelUsersQuerySchema = z.object({
  stage: z.enum(funnelStages),
  days: z.coerce.number().int().min(1).max(365).default(7),
  limit: z.coerce.number().int().min(1).max(500).default(50)
})

export type FunnelUsersQuery = z.infer<typeof funnelUsersQuerySchema>

// ============================================
// RESPONSE: FUNNEL USERS
// ============================================

const funnelUserSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().nullable().optional(),
  fullName: z.string().nullable().optional(),
  planType: z.string().nullable().optional(),
  registrationSource: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  firstTestCompletedAt: z.string().nullable().optional(),
  eventAt: z.string().nullable().optional(),
  eventType: z.string().nullable().optional()
})

export type FunnelUser = z.infer<typeof funnelUserSchema>

export const funnelUsersResponseSchema = z.object({
  stage: z.enum(funnelStages),
  count: z.number().int().min(0),
  users: z.array(funnelUserSchema),
  period: z.object({
    days: z.number().int(),
    from: z.string()
  })
})

export type FunnelUsersResponse = z.infer<typeof funnelUsersResponseSchema>

// ============================================
// RESPONSE: ERROR
// ============================================

export const funnelUsersErrorSchema = z.object({
  error: z.string()
})

export type FunnelUsersError = z.infer<typeof funnelUsersErrorSchema>
