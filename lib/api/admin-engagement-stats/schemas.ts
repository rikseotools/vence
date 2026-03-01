// lib/api/admin-engagement-stats/schemas.ts - Schemas para estadísticas completas de engagement
import { z } from 'zod/v3'

// ============================================
// DAU/MAU HISTORY (14 días)
// ============================================

export const dauMauHistoryItemSchema = z.object({
  date: z.string(),
  dau: z.number().int().min(0),
  mau: z.number().int().min(0),
  ratio: z.number().int().min(0),
  formattedDate: z.string(),
  weekday: z.string(),
})

// ============================================
// ACTIVATION HISTORY (14 días)
// ============================================

export const activationHistoryItemSchema = z.object({
  date: z.string(),
  formattedDate: z.string(),
  weekday: z.string(),
  total: z.number().int().min(0),
  organic: z.number().int().min(0),
  meta: z.number().int().min(0),
  google: z.number().int().min(0),
})

export const activationSummarySchema = z.object({
  totalOrganic: z.number().int().min(0),
  totalMeta: z.number().int().min(0),
  totalGoogle: z.number().int().min(0),
  activatedOrganic: z.number().int().min(0),
  activatedMeta: z.number().int().min(0),
  activatedGoogle: z.number().int().min(0),
  totalActivated: z.number().int().min(0),
})

// ============================================
// RETENTION ANALYSIS (4 semanas)
// ============================================

export const retentionAnalysisItemSchema = z.object({
  week: z.string(),
  weekLabel: z.string().optional(),
  registered: z.number().int().min(0),
  day1Retention: z.number().int().min(0),
  day7Retention: z.number().int().min(0),
  day30Retention: z.number().int().min(0),
})

// ============================================
// ENGAGEMENT DEPTH
// ============================================

export const engagementDepthSchema = z.object({
  testsPerActiveUser: z.number().min(0),
  avgDaysActivePerMonth: z.number().min(0),
  avgLongestStreak: z.number().min(0),
  userEngagementLevels: z.object({
    casual: z.number().int().min(0),
    regular: z.number().int().min(0),
    power: z.number().int().min(0),
  }),
  distributionDaysActive: z.record(z.string(), z.number().int().min(0)),
})

export const engagementDepthHistoryItemSchema = z.object({
  month: z.string(),
  testsPerUser: z.number().min(0),
  avgDaysActive: z.number().min(0),
  activeUsers: z.number().int().min(0),
})

// ============================================
// HABIT FORMATION
// ============================================

export const habitFormationSchema = z.object({
  powerUsers: z.number().int().min(0),
  powerUsersPercentage: z.number().int().min(0),
  weeklyActiveUsers: z.number().int().min(0),
  weeklyActivePercentage: z.number().int().min(0),
  habitDistribution: z.object({
    occasional: z.number().int().min(0),
    regular: z.number().int().min(0),
    habitual: z.number().int().min(0),
  }),
  avgSessionsPerWeek: z.number().min(0),
})

export const habitFormationHistoryItemSchema = z.object({
  month: z.string(),
  powerUsersPercent: z.number().int().min(0),
  weeklyActivePercent: z.number().int().min(0),
  activeUsers: z.number().int().min(0),
})

// ============================================
// RETENTION RATE HISTORY (8 períodos)
// ============================================

export const retentionRateHistoryItemSchema = z.object({
  period: z.string(),
  periodLabel: z.string(),
  registered: z.number().int().min(0),
  day1Retention: z.number().int().min(0),
  day7Retention: z.number().int().min(0),
  day30Retention: z.number().int().min(0),
})

// ============================================
// COHORT ANALYSIS (8 semanas)
// ============================================

export const cohortAnalysisItemSchema = z.object({
  week: z.string(),
  registered: z.number().int().min(0),
  active: z.number().int().min(0),
  retentionRate: z.number().int().min(0),
})

// ============================================
// FULL RESPONSE
// ============================================

export const engagementStatsResponseSchema = z.object({
  // Core metrics
  totalUsers: z.number().int().min(0),
  averageDAU: z.number().int().min(0),
  MAU: z.number().int().min(0),
  dauMauRatio: z.number().int().min(0),
  registeredActiveRatio: z.number().int().min(0),

  // DAU/MAU history (14 days)
  dauMauHistory: z.array(dauMauHistoryItemSchema),

  // Activation (14 days + summary)
  activationHistory: z.array(activationHistoryItemSchema),
  activationSummary: activationSummarySchema,

  // Retention (4 weeks)
  retentionAnalysis: z.array(retentionAnalysisItemSchema),

  // Engagement depth
  engagementDepth: engagementDepthSchema,
  engagementDepthHistory: z.array(engagementDepthHistoryItemSchema),

  // Habit formation
  habitFormation: habitFormationSchema,
  habitFormationHistory: z.array(habitFormationHistoryItemSchema),

  // Retention rate history (8 periods)
  retentionRateHistory: z.array(retentionRateHistoryItemSchema),

  // Cohort analysis (8 weeks)
  cohortAnalysis: z.array(cohortAnalysisItemSchema),
})

export type EngagementStatsResponse = z.infer<typeof engagementStatsResponseSchema>
