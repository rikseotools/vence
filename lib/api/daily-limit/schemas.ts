// lib/api/daily-limit/schemas.ts
// Zod schemas for the graduated daily question limit system
import { z } from 'zod'

// =====================================================
// GRADUATED LIMIT CONFIGURATION
// =====================================================

/**
 * A single tier in the graduated limit system.
 * Users progress through tiers based on registration age
 * and how many times they've hit the daily limit.
 */
export const GraduatedLimitTierSchema = z.object({
  /** Minimum days since registration for this tier to apply */
  minDaysRegistered: z.number().int().min(0),
  /** Maximum days since registration (exclusive). null = no upper bound */
  maxDaysRegistered: z.number().int().min(1).nullable(),
  /** Daily question limit for this tier */
  dailyLimit: z.number().int().min(1),
  /** Label for logging/debugging */
  label: z.string(),
})

export type GraduatedLimitTier = z.infer<typeof GraduatedLimitTierSchema>

export const GraduatedLimitConfigSchema = z.object({
  /** Default limit for users who don't qualify for graduated reduction */
  defaultLimit: z.number().int().min(1),
  /** Minimum number of times a user must have hit the limit before graduation kicks in */
  minLimitHitsRequired: z.number().int().min(1),
  /** Tiers ordered by minDaysRegistered ascending */
  tiers: z.array(GraduatedLimitTierSchema).min(1),
})

export type GraduatedLimitConfig = z.infer<typeof GraduatedLimitConfigSchema>

// =====================================================
// QUERY RESULTS
// =====================================================

export const UserLimitProfileSchema = z.object({
  userId: z.string().uuid(),
  planType: z.string().nullable(),
  createdAt: z.string(),
  /** Days since registration */
  registrationAgeDays: z.number().int().min(0),
  /** Total number of times this user has hit the daily limit (from conversion_events) */
  totalLimitHits: z.number().int().min(0),
  /** Whether the user is premium (bypasses all limits) */
  isPremium: z.boolean(),
})

export type UserLimitProfile = z.infer<typeof UserLimitProfileSchema>

export const DynamicLimitResultSchema = z.object({
  /** The calculated daily limit for this user */
  dailyLimit: z.number().int().min(1),
  /** Which tier was applied (null = default, no graduation) */
  tierLabel: z.string().nullable(),
  /** Whether graduated reduction is active for this user */
  isGraduated: z.boolean(),
  /** User's registration age in days */
  registrationAgeDays: z.number().int().min(0),
  /** How many times user has hit the limit historically */
  totalLimitHits: z.number().int().min(0),
})

export type DynamicLimitResult = z.infer<typeof DynamicLimitResultSchema>

// =====================================================
// DAILY LIMIT STATUS (from RPC or Drizzle query)
// =====================================================

export const DailyLimitStatusSchema = z.object({
  allowed: z.boolean(),
  questionsToday: z.number().int().min(0),
  questionsRemaining: z.number().int().min(0),
  dailyLimit: z.number().int().min(1),
  isPremium: z.boolean(),
  /** Whether this user has a graduated (reduced) limit */
  isGraduated: z.boolean(),
  /** Which tier label applies (for logging) */
  tierLabel: z.string().nullable(),
})

export type DailyLimitStatus = z.infer<typeof DailyLimitStatusSchema>
