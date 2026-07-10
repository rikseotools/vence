// lib/referrals/coupon.ts — cupón de 5 € para el referido, POR-CUENTA Stripe (los cupones son por cuenta).
// Se aplica en el checkout (cuenta Nila, altas nuevas). Get-or-create idempotente con id fijo.

import type Stripe from 'stripe'

export const REFERRAL_COUPON_ID = 'referral_5eur'
export const REFERRAL_DISCOUNT_CENTS = 500 // 5,00 €

/**
 * Garantiza que existe el cupón de referido en la cuenta `sc` y devuelve su id.
 * Idempotente: si ya existe lo reutiliza; si dos checkouts lo crean a la vez, la carrera se ignora.
 */
export async function ensureReferralCoupon(sc: Stripe): Promise<string> {
  try {
    await sc.coupons.retrieve(REFERRAL_COUPON_ID)
    return REFERRAL_COUPON_ID
  } catch {
    try {
      await sc.coupons.create({
        id: REFERRAL_COUPON_ID,
        amount_off: REFERRAL_DISCOUNT_CENTS,
        currency: 'eur',
        duration: 'once', // solo el primer pago
        name: 'Descuento embajador (5 €)',
      })
    } catch {
      // carrera / ya existe → ok, se usa igualmente
    }
    return REFERRAL_COUPON_ID
  }
}
