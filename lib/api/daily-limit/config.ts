// lib/api/daily-limit/config.ts
// Graduated daily limit configuration
//
// All tiers set to 25 questions/day (uniform limit for all free users).
// The graduated structure is preserved so it can be re-enabled with different
// values if needed — just change the dailyLimit per tier.
//
// Previously had 15/day (31-60 days) and 10/day (61+ days) but analysis showed
// it punished engaged users without driving conversions (April 2026).

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
      dailyLimit: 25,
      label: 'established',
    },
    {
      minDaysRegistered: 61,
      maxDaysRegistered: null,
      dailyLimit: 25,
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
