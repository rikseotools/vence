// lib/api/loyalty/schemas.ts - Schemas de validación para descuentos de fidelidad
import { z } from 'zod/v3'

// ============================================
// TIERS DE FIDELIDAD
// ============================================

export const loyaltyTierSchema = z.enum(['none', 'tier_1', 'tier_2'])
export type LoyaltyTier = z.infer<typeof loyaltyTierSchema>

// ============================================
// CONFIGURACIÓN DE CUPONES
// ============================================

export const LOYALTY_CONFIG = {
  tier1CouponId: 'loyalty_10',
  tier2CouponId: 'loyalty_20',
  tier1MaxRenewals: 2, // renovaciones 1-2 → tier_1 (10%)
  tier1PercentOff: 10,
  tier2PercentOff: 20,
} as const

// ============================================
// ESTADO DE FIDELIDAD (diagnóstico)
// ============================================

export const loyaltyStatusSchema = z.object({
  subscriptionId: z.string(),
  renewalCount: z.number(),
  currentTier: loyaltyTierSchema,
  currentCouponId: z.string().nullable(),
  expectedTier: loyaltyTierSchema,
  expectedCouponId: z.string().nullable(),
  needsUpdate: z.boolean(),
})
export type LoyaltyStatus = z.infer<typeof loyaltyStatusSchema>

// ============================================
// RESULTADO DE APLICAR CUPÓN
// ============================================

export const applyLoyaltyResultSchema = z.object({
  applied: z.boolean(),
  couponId: z.string().nullable(),
  renewalCount: z.number(),
  tier: loyaltyTierSchema,
  reason: z.string(),
})
export type ApplyLoyaltyResult = z.infer<typeof applyLoyaltyResultSchema>
