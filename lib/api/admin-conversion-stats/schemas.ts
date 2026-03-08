// lib/api/admin-conversion-stats/schemas.ts
import { z } from 'zod'

// ============================================
// REQUEST
// ============================================

export const conversionStatsRequestSchema = z.object({
  days: z.number().int().min(1).max(365).default(7),
})

export type ConversionStatsRequest = z.infer<typeof conversionStatsRequestSchema>

// ============================================
// RESPONSE
// ============================================

const registrationStatsSchema = z.object({
  total: z.number(),
  totalAllTime: z.number(),
  bySource: z.record(z.string(), z.number()),
  firstTestCompleted: z.number(),
  activeUsers: z.number(),
  activationRate: z.number(),
})

const activeUserMetricsSchema = z.object({
  dauTotal: z.number(),
  dauFree: z.number(),
  dauPremium: z.number(),
  monetizationRate: z.number(),
  paidInPeriod: z.number(),
  refundsInPeriod: z.number(),
  paidNetInPeriod: z.number(),
  refundAmountPeriod: z.number(),
  freeToPayRate: z.number(),
  dau7Days: z.number(),
  dau7DaysFree: z.number(),
  dau7DaysPremium: z.number(),
  monetizationRate7Days: z.number(),
  paidIn7Days: z.number(),
  refundsIn7Days: z.number(),
  paidNetIn7Days: z.number(),
  refundAmount7Days: z.number(),
  freeToPayRate7Days: z.number(),
})

const funnelCountsSchema = z.record(z.string(), z.number())

// dailyStats entries: { date: string, [eventType]: number }
export type DailyStatEntry = { date: string } & Record<string, number | string>

const previousPeriodSchema = z.object({
  registrations: z.number(),
  firstTestCompleted: z.number(),
  funnelCounts: funnelCountsSchema,
})

export const conversionStatsResponseSchema = z.object({
  registrations: registrationStatsSchema,
  activeUserMetrics: activeUserMetricsSchema,
  dailyStats: z.array(z.any()),
  funnelCounts: funnelCountsSchema,
  paidAllTime: z.number(),
  previousPeriod: previousPeriodSchema,
  period: z.object({
    days: z.number(),
    from: z.string(),
    to: z.string(),
  }),
})

export type ConversionStatsResponse = z.infer<typeof conversionStatsResponseSchema>
