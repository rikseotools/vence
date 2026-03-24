// lib/api/psychometric-stats/schemas.ts
import { z } from 'zod'

export const getPsychometricStatsRequestSchema = z.object({
  userId: z.string().uuid('ID de usuario inválido'),
})

export type GetPsychometricStatsRequest = z.infer<typeof getPsychometricStatsRequestSchema>

export const categoryStatSchema = z.object({
  displayName: z.string(),
  categoryKey: z.string(),
  accuracy: z.number(),
  correct: z.number(),
  total: z.number(),
})

export type CategoryStat = z.infer<typeof categoryStatSchema>

export const recentPsychometricTestSchema = z.object({
  id: z.string().uuid(),
  score: z.number(),
  total: z.number(),
  percentage: z.number(),
  date: z.string(),
  timeSeconds: z.number(),
  avgTimePerQuestion: z.number(),
})

export type RecentPsychometricTest = z.infer<typeof recentPsychometricTestSchema>

export const getPsychometricStatsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    categoryStats: z.array(categoryStatSchema),
    recentTests: z.array(recentPsychometricTestSchema),
  }).optional(),
  error: z.string().optional(),
})

export type GetPsychometricStatsResponse = z.infer<typeof getPsychometricStatsResponseSchema>
