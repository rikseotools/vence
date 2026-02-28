// lib/api/admin-engagement-stats/schemas.ts - Schemas para estadísticas de engagement (MAU)
import { z } from 'zod/v3'

// ============================================
// QUERY PARAMS
// ============================================

export const engagementStatsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
})

export type EngagementStatsQuery = z.infer<typeof engagementStatsQuerySchema>

// ============================================
// RESPONSE
// ============================================

export const engagementStatsResponseSchema = z.object({
  activeUsers: z.number().int().min(0),
  totalUsers: z.number().int().min(0),
  mauPercentage: z.number().int().min(0).max(100),
})

export type EngagementStatsResponse = z.infer<typeof engagementStatsResponseSchema>
