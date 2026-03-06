// lib/api/ranking/schemas.ts - Schemas de validacion para ranking
import { z } from 'zod/v3'

// ============================================
// VALORES PERMITIDOS
// ============================================

export const timeFilterOptions = ['yesterday', 'today', 'week', 'month'] as const
export type TimeFilter = typeof timeFilterOptions[number]

export const streakTimeFilterOptions = ['week', 'month', 'all'] as const
export type StreakTimeFilter = typeof streakTimeFilterOptions[number]

export const streakCategoryOptions = ['all', 'principiantes', 'veteranos'] as const
export type StreakCategory = typeof streakCategoryOptions[number]

// ============================================
// AVATAR SCHEMA
// ============================================

export const avatarSchema = z.object({
  type: z.enum(['automatic', 'predefined', 'uploaded', 'google']),
  emoji: z.string().optional(),
  color: z.string().optional(),
  url: z.string().optional(),
  profile: z.string().optional(),
}).nullable()

export type Avatar = z.infer<typeof avatarSchema>

// ============================================
// REQUEST: GET RANKING
// ============================================

export const getRankingRequestSchema = z.object({
  timeFilter: z.enum(timeFilterOptions),
  userId: z.string().uuid().optional(),
  minQuestions: z.number().int().min(1).default(5),
  limit: z.number().int().min(1).max(500).default(50),
  offset: z.number().int().min(0).default(0),
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
  name: z.string(),
  ciudad: z.string().nullable(),
  avatar: avatarSchema,
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
  hasMore: z.boolean().optional(),
  generatedAt: z.string().optional(),
  error: z.string().optional(),
})

export type GetRankingResponse = z.infer<typeof getRankingResponseSchema>

// ============================================
// REQUEST: GET STREAK RANKING
// ============================================

export const getStreakRankingRequestSchema = z.object({
  timeFilter: z.enum(streakTimeFilterOptions),
  category: z.enum(streakCategoryOptions).default('all'),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
  userId: z.string().uuid().optional(),
})

export type GetStreakRankingRequest = z.infer<typeof getStreakRankingRequestSchema>

// ============================================
// STREAK RESPONSE SCHEMAS
// ============================================

export const streakEntrySchema = z.object({
  userId: z.string().uuid(),
  streak: z.number().int().min(0),
  rank: z.number().int().min(1),
  name: z.string(),
  ciudad: z.string().nullable(),
  avatar: avatarSchema,
  isNovato: z.boolean(),
})

export type StreakEntry = z.infer<typeof streakEntrySchema>

export const getStreakRankingResponseSchema = z.object({
  success: z.boolean(),
  streaks: z.array(streakEntrySchema).optional(),
  hasMore: z.boolean().optional(),
  error: z.string().optional(),
})

export type GetStreakRankingResponse = z.infer<typeof getStreakRankingResponseSchema>

// ============================================
// VALIDATORS
// ============================================

export function safeParseGetRankingRequest(data: unknown) {
  return getRankingRequestSchema.safeParse(data)
}

export function validateGetRankingRequest(data: unknown): GetRankingRequest {
  return getRankingRequestSchema.parse(data)
}

export function safeParseGetStreakRankingRequest(data: unknown) {
  return getStreakRankingRequestSchema.safeParse(data)
}
