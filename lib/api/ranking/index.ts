// lib/api/ranking/index.ts - Exports del modulo de ranking

// Schemas y tipos
export {
  timeFilterOptions,
  streakTimeFilterOptions,
  streakCategoryOptions,
  avatarSchema,
  getRankingRequestSchema,
  rankingEntrySchema,
  userPositionSchema,
  getRankingResponseSchema,
  getStreakRankingRequestSchema,
  streakEntrySchema,
  getStreakRankingResponseSchema,
  safeParseGetRankingRequest,
  validateGetRankingRequest,
  safeParseGetStreakRankingRequest,
  type TimeFilter,
  type StreakTimeFilter,
  type StreakCategory,
  type Avatar,
  type GetRankingRequest,
  type RankingEntry,
  type UserPosition,
  type GetRankingResponse,
  type GetStreakRankingRequest,
  type StreakEntry,
  type GetStreakRankingResponse,
} from './schemas'

// Queries
export {
  computeDateRange,
  resolveUserProfiles,
  getRanking,
  getUserPosition,
  getStreakRanking,
  invalidateRankingCache,
  type DateRange,
  type ResolvedProfile,
} from './queries'
