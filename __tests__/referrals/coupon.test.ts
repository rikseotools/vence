// __tests__/referrals/coupon.test.ts — CAPA unit del cupón de referido (Stripe mockeado).

import { ensureReferralCoupon, REFERRAL_COUPON_ID } from '@/lib/referrals/coupon'

describe('ensureReferralCoupon', () => {
  it('reutiliza el cupón si ya existe (no lo recrea)', async () => {
    const sc = { coupons: { retrieve: jest.fn().mockResolvedValue({ id: REFERRAL_COUPON_ID }), create: jest.fn() } }
    const id = await ensureReferralCoupon(sc as never)
    expect(id).toBe(REFERRAL_COUPON_ID)
    expect(sc.coupons.create).not.toHaveBeenCalled()
  })

  it('lo crea si no existe: 5 € (500 cents), eur, una vez', async () => {
    const sc = { coupons: { retrieve: jest.fn().mockRejectedValue(new Error('no')), create: jest.fn().mockResolvedValue({}) } }
    const id = await ensureReferralCoupon(sc as never)
    expect(id).toBe(REFERRAL_COUPON_ID)
    expect(sc.coupons.create).toHaveBeenCalledWith(expect.objectContaining({
      id: REFERRAL_COUPON_ID, amount_off: 500, currency: 'eur', duration: 'once',
    }))
  })

  it('carrera al crear (ya existe) → no lanza, devuelve el id', async () => {
    const sc = { coupons: { retrieve: jest.fn().mockRejectedValue(new Error('no')), create: jest.fn().mockRejectedValue(new Error('resource_already_exists')) } }
    await expect(ensureReferralCoupon(sc as never)).resolves.toBe(REFERRAL_COUPON_ID)
  })
})
