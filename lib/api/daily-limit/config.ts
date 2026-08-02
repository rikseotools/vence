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

/**
 * ¿Este `plan_type` queda exento del cupo diario?
 *
 * La lista de arriba se comparaba a mano en cada sitio, y el 02/08/2026 eso produjo una
 * SEXTA definición de «premium» (`plan_type === 'premium'` en el guardado del simulacro,
 * T-450) que dejaba fuera a `trial`, `legacy_free`, `premium_semester` y `admin`. No llegó
 * a cobrarles de más porque la función SQL del contador corta igual, pero dos definiciones
 * de lo mismo no protegen: divergen.
 *
 * Es la MISMA lista que aplica `increment_daily_questions` en la BD. Si cambia una, tiene
 * que cambiar la otra — lo vigila `__tests__/guardrails/dailyQuotaServerSide.test.ts`.
 */
export function esPlanPremium(planType: string | null | undefined): boolean {
  return planType != null && (PREMIUM_PLAN_TYPES as readonly string[]).includes(planType)
}
