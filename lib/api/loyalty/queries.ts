// lib/api/loyalty/queries.ts - Lógica core de descuentos de fidelidad
//
// MULTI-CUENTA: todas las funciones aceptan un cliente Stripe `sc` de la cuenta
// donde vive la suscripción. Default = cuenta Manuel (stripe()) para no romper
// llamadores que no lo pasen. IMPORTANTE: los cupones de fidelidad
// (LOYALTY_CONFIG.tier*CouponId) son POR-CUENTA — deben existir con el MISMO id
// en cada cuenta (replicados en Nila con el mismo id que en Manuel).
import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'
import { LOYALTY_CONFIG } from './schemas'
import type { LoyaltyTier, LoyaltyStatus, ApplyLoyaltyResult } from './schemas'

// ============================================
// CONTAR RENOVACIONES PAGADAS
// ============================================

export async function countPaidRenewals(subscriptionId: string, sc: Stripe = stripe()): Promise<number> {
  const invoices = await sc.invoices.list({
    subscription: subscriptionId,
    status: 'paid',
    limit: 100,
  })

  return invoices.data.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (inv: any) => inv.billing_reason === 'subscription_cycle'
  ).length
}

// ============================================
// DETERMINAR TIER POR NÚMERO DE RENOVACIÓN
// ============================================

/**
 * Determina el tier de fidelidad según el número de renovación próxima.
 * @param upcomingRenewalNumber - Número de la renovación que viene (1-based).
 *   Si es 0, significa que aún no ha habido renovaciones (recién creada).
 */
export function determineLoyaltyTier(upcomingRenewalNumber: number): LoyaltyTier {
  if (upcomingRenewalNumber <= 0) return 'none'
  if (upcomingRenewalNumber <= LOYALTY_CONFIG.tier1MaxRenewals) return 'tier_1'
  return 'tier_2'
}

// ============================================
// CUPÓN PARA CADA TIER
// ============================================

export function couponForTier(tier: LoyaltyTier): string | null {
  switch (tier) {
    case 'tier_1': return LOYALTY_CONFIG.tier1CouponId
    case 'tier_2': return LOYALTY_CONFIG.tier2CouponId
    default: return null
  }
}

// ============================================
// OBTENER CUPÓN ACTUAL DE UNA SUSCRIPCIÓN
// ============================================

async function getCurrentCouponId(subscriptionId: string, sc: Stripe = stripe()): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = await sc.subscriptions.retrieve(subscriptionId) as any
  return sub.discount?.coupon?.id || null
}

// ============================================
// DIAGNÓSTICO: ESTADO DE FIDELIDAD
// ============================================

export async function getLoyaltyStatus(subscriptionId: string, sc: Stripe = stripe()): Promise<LoyaltyStatus> {
  const [renewalCount, currentCouponId] = await Promise.all([
    countPaidRenewals(subscriptionId, sc),
    getCurrentCouponId(subscriptionId, sc),
  ])

  // La próxima renovación será renewalCount + 1
  const upcomingRenewal = renewalCount + 1
  const expectedTier = determineLoyaltyTier(upcomingRenewal)
  const expectedCouponId = couponForTier(expectedTier)

  const currentTier: LoyaltyTier =
    currentCouponId === LOYALTY_CONFIG.tier1CouponId ? 'tier_1' :
    currentCouponId === LOYALTY_CONFIG.tier2CouponId ? 'tier_2' : 'none'

  const needsUpdate = currentCouponId !== expectedCouponId

  return {
    subscriptionId,
    renewalCount,
    currentTier,
    currentCouponId,
    expectedTier,
    expectedCouponId,
    needsUpdate,
  }
}

// ============================================
// APLICAR CUPÓN DE FIDELIDAD (idempotente)
// ============================================

export async function ensureLoyaltyCoupon(subscriptionId: string, sc: Stripe = stripe()): Promise<ApplyLoyaltyResult> {
  const status = await getLoyaltyStatus(subscriptionId, sc)

  if (!status.needsUpdate) {
    return {
      applied: false,
      couponId: status.currentCouponId,
      renewalCount: status.renewalCount,
      tier: status.currentTier,
      reason: 'already_correct',
    }
  }

  // Aplicar cupón correcto usando campo `coupon` (compatible con API 2024-06-20)
  if (status.expectedCouponId) {
    await sc.subscriptions.update(subscriptionId, {
      coupon: status.expectedCouponId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  } else {
    // Quitar cupón si expectedTier es 'none' (no debería pasar en flujo normal)
    await sc.subscriptions.update(subscriptionId, {
      coupon: '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }

  return {
    applied: true,
    couponId: status.expectedCouponId,
    renewalCount: status.renewalCount,
    tier: status.expectedTier,
    reason: status.currentCouponId
      ? `upgraded_${status.currentTier}_to_${status.expectedTier}`
      : `applied_${status.expectedTier}`,
  }
}

// ============================================
// APLICAR CUPÓN INICIAL (en checkout)
// ============================================

/**
 * Aplica loyalty_10 a una suscripción recién creada.
 * Se llama desde handleCheckoutSessionCompleted para que la 1a renovación
 * ya tenga descuento automáticamente.
 */
export async function applyInitialLoyaltyCoupon(subscriptionId: string, sc: Stripe = stripe()): Promise<ApplyLoyaltyResult> {
  const currentCouponId = await getCurrentCouponId(subscriptionId, sc)

  // Si ya tiene algún cupón de loyalty, no tocar
  if (currentCouponId === LOYALTY_CONFIG.tier1CouponId || currentCouponId === LOYALTY_CONFIG.tier2CouponId) {
    return {
      applied: false,
      couponId: currentCouponId,
      renewalCount: 0,
      tier: currentCouponId === LOYALTY_CONFIG.tier2CouponId ? 'tier_2' : 'tier_1',
      reason: 'already_has_loyalty_coupon',
    }
  }

  await sc.subscriptions.update(subscriptionId, {
    coupon: LOYALTY_CONFIG.tier1CouponId,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  return {
    applied: true,
    couponId: LOYALTY_CONFIG.tier1CouponId,
    renewalCount: 0,
    tier: 'tier_1',
    reason: 'initial_checkout',
  }
}
