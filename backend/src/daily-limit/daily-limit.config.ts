// backend/src/daily-limit/daily-limit.config.ts
//
// Configuración del sistema de daily limit graduado. Port literal de
// lib/api/daily-limit/config.ts del frontend.
//
// Actualmente TODOS los tiers están en 25 preguntas/día. La estructura
// graduada se preserva por si se quiere re-activar con valores distintos
// (basta con cambiar `dailyLimit` por tier).

export interface GraduatedLimitTier {
  minDaysRegistered: number;
  /** null = sin límite superior (último tier). */
  maxDaysRegistered: number | null;
  dailyLimit: number;
  label: string;
}

export interface GraduatedLimitConfig {
  defaultLimit: number;
  /** Mínimo de "limit_reached" events para que se aplique graduación. */
  minLimitHitsRequired: number;
  tiers: GraduatedLimitTier[];
}

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
};

/** Plan types que bypasean todos los límites diarios. */
export const PREMIUM_PLAN_TYPES = [
  'premium',
  'trial',
  'legacy_free',
  'premium_semester',
  'admin',
] as const;

export type PremiumPlanType = (typeof PREMIUM_PLAN_TYPES)[number];

export interface UserLimitProfile {
  userId: string;
  planType: string | null;
  /** ISO timestamp. */
  createdAt: string;
  registrationAgeDays: number;
  totalLimitHits: number;
  isPremium: boolean;
}

export interface DynamicLimitResult {
  dailyLimit: number;
  tierLabel: string | null;
  isGraduated: boolean;
  registrationAgeDays: number;
  totalLimitHits: number;
}
