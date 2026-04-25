// lib/api/daily-limit/config.ts
// Graduated daily limit configuration
//
// Rules:
// 1. New users (0-30 days): 25 questions/day (full experience, natural conversion window)
// 2. After 30 days + 3 limit hits: graduated reduction kicks in
// 3. The longer they stay free AND actively hit the limit, the lower their daily quota
//
// Data behind these numbers (April 2026 analysis):
// - P80 conversion: 29 days (80% of paying users convert within 29 days)
// - P90 conversion: 54 days
// - P95 conversion: 82 days
// - Premium users who hit limit before paying: avg 5 times, 67% only 1-3 times
// - Conversion rate after hitting limit: 6% (current modal alone is not enough)

import type { GraduatedLimitConfig } from './schemas'

export const GRADUATED_LIMIT_CONFIG: GraduatedLimitConfig = {
  defaultLimit: 25,
  minLimitHitsRequired: 3,
  tiers: [
    {
      minDaysRegistered: 0,
      maxDaysRegistered: 31,
      dailyLimit: 25,
      label: 'onboarding',
    },
    {
      minDaysRegistered: 31,
      maxDaysRegistered: 61,
      dailyLimit: 15,
      label: 'first-reduction',
    },
    {
      minDaysRegistered: 61,
      maxDaysRegistered: 91,
      dailyLimit: 10,
      label: 'second-reduction',
    },
    {
      minDaysRegistered: 91,
      maxDaysRegistered: null,
      dailyLimit: 5,
      label: 'veteran',
    },
  ],
}

// Premium plan types that bypass all limits
export const PREMIUM_PLAN_TYPES = [
  'premium',
  'trial',
  'legacy_free',
  'premium_semester',
  'admin',
] as const
