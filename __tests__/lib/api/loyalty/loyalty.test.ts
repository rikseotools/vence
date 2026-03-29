import { determineLoyaltyTier, couponForTier } from '@/lib/api/loyalty/queries'
import { LOYALTY_CONFIG } from '@/lib/api/loyalty/schemas'
import type { LoyaltyTier } from '@/lib/api/loyalty/schemas'

describe('determineLoyaltyTier', () => {
  it('devuelve none para renovación 0 (recién creada)', () => {
    expect(determineLoyaltyTier(0)).toBe('none')
  })

  it('devuelve none para valores negativos', () => {
    expect(determineLoyaltyTier(-1)).toBe('none')
  })

  it('devuelve tier_1 para renovación 1', () => {
    expect(determineLoyaltyTier(1)).toBe('tier_1')
  })

  it('devuelve tier_1 para renovación 2', () => {
    expect(determineLoyaltyTier(2)).toBe('tier_1')
  })

  it('devuelve tier_2 para renovación 3', () => {
    expect(determineLoyaltyTier(3)).toBe('tier_2')
  })

  it('devuelve tier_2 para renovación 10', () => {
    expect(determineLoyaltyTier(10)).toBe('tier_2')
  })

  it('devuelve tier_2 para renovación 100', () => {
    expect(determineLoyaltyTier(100)).toBe('tier_2')
  })
})

describe('couponForTier', () => {
  it('devuelve null para tier none', () => {
    expect(couponForTier('none')).toBeNull()
  })

  it('devuelve loyalty_10 para tier_1', () => {
    expect(couponForTier('tier_1')).toBe('loyalty_10')
  })

  it('devuelve loyalty_20 para tier_2', () => {
    expect(couponForTier('tier_2')).toBe('loyalty_20')
  })

  it('coincide con LOYALTY_CONFIG', () => {
    expect(couponForTier('tier_1')).toBe(LOYALTY_CONFIG.tier1CouponId)
    expect(couponForTier('tier_2')).toBe(LOYALTY_CONFIG.tier2CouponId)
  })
})

describe('flujo completo tier por renovación', () => {
  const cases: [number, LoyaltyTier, string | null][] = [
    [0, 'none', null],
    [1, 'tier_1', 'loyalty_10'],
    [2, 'tier_1', 'loyalty_10'],
    [3, 'tier_2', 'loyalty_20'],
    [4, 'tier_2', 'loyalty_20'],
    [50, 'tier_2', 'loyalty_20'],
  ]

  it.each(cases)(
    'renovación %i → tier %s → cupón %s',
    (renewal, expectedTier, expectedCoupon) => {
      const tier = determineLoyaltyTier(renewal)
      expect(tier).toBe(expectedTier)
      expect(couponForTier(tier)).toBe(expectedCoupon)
    }
  )
})

describe('LOYALTY_CONFIG', () => {
  it('tier_1 cubre las 2 primeras renovaciones', () => {
    expect(LOYALTY_CONFIG.tier1MaxRenewals).toBe(2)
  })

  it('tier_1 es 10% de descuento', () => {
    expect(LOYALTY_CONFIG.tier1PercentOff).toBe(10)
  })

  it('tier_2 es 20% de descuento', () => {
    expect(LOYALTY_CONFIG.tier2PercentOff).toBe(20)
  })
})
