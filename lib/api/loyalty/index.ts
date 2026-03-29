// lib/api/loyalty/index.ts - Exports del módulo de fidelidad

export {
  loyaltyTierSchema,
  LOYALTY_CONFIG,
  loyaltyStatusSchema,
  applyLoyaltyResultSchema,
  type LoyaltyTier,
  type LoyaltyStatus,
  type ApplyLoyaltyResult,
} from './schemas'

export {
  countPaidRenewals,
  determineLoyaltyTier,
  couponForTier,
  getLoyaltyStatus,
  ensureLoyaltyCoupon,
  applyInitialLoyaltyCoupon,
} from './queries'
