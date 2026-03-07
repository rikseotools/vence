// lib/api/user-stats/schemas.ts - Schemas Zod para User Stats v2
import { z } from 'zod'

export const getUserStatsRequestSchema = z.object({
  userId: z.string().uuid(),
})

export const userPublicStatsSchema = z.object({
  totalQuestions: z.number(),
  globalAccuracy: z.number(),
  currentStreak: z.number(),
  questionsThisWeek: z.number(),
})

export type UserPublicStats = z.infer<typeof userPublicStatsSchema>
