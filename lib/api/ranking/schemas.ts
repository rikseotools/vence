// lib/api/ranking/schemas.ts - Schemas de validacion para ranking
import { z } from 'zod/v3'

// ============================================
// VALORES PERMITIDOS
// ============================================

export const timeFilterOptions = ['yesterday', 'today', 'week', 'month'] as const
export type TimeFilter = typeof timeFilterOptions[number]

// ============================================
// REQUEST: GET RANKING
// ============================================

export const getRankingRequestSchema = z.object({
  timeFilter: z.enum(timeFilterOptions),
  userId: z.string().uuid().optional(),
  minQuestions: z.number().int().min(1).default(5),
  limit: z.number().int().min(1).max(500).default(100),
})

export type GetRankingRequest = z.infer<typeof getRankingRequestSchema>

// ============================================
// RESPONSE SCHEMAS
// ============================================

export const rankingEntrySchema = z.object({
  userId: z.string().uuid(),
  totalQuestions: z.number().int().min(0),
  correctAnswers: z.number().int().min(0),
  accuracy: z.number().min(0).max(100),
  rank: z.number().int().min(1),
})

export type RankingEntry = z.infer<typeof rankingEntrySchema>

export const userPositionSchema = z.object({
  rank: z.number().int().min(1),
  totalQuestions: z.number().int().min(0),
  correctAnswers: z.number().int().min(0),
  accuracy: z.number().min(0).max(100),
  totalUsers: z.number().int().min(1),
})

export type UserPosition = z.infer<typeof userPositionSchema>

export const getRankingResponseSchema = z.object({
  success: z.boolean(),
  ranking: z.array(rankingEntrySchema).optional(),
  userPosition: userPositionSchema.optional().nullable(),
  generatedAt: z.string().optional(),
  error: z.string().optional(),
})

export type GetRankingResponse = z.infer<typeof getRankingResponseSchema>

// ============================================
// VALIDATORS
// ============================================

export function safeParseGetRankingRequest(data: unknown) {
  return getRankingRequestSchema.safeParse(data)
}

export function validateGetRankingRequest(data: unknown): GetRankingRequest {
  return getRankingRequestSchema.parse(data)
}
