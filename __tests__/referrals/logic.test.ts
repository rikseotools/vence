// __tests__/referrals/logic.test.ts
// CAPA 1 (unit) del programa de referidos — lógica pura, sin BD.
// Ver docs/roadmap/programa-referidos-embajadores.md + memoria feedback_feature_multiples_capas_seguridad.

import {
  generateReferralCode,
  isWithinAttributionWindow,
  computeHoldUntil,
  isHoldExpired,
  refereeEligibility,
  isLegalTransition,
  REFERRAL_ATTRIBUTION_WINDOW_DAYS,
  REFERRAL_HOLD_DAYS,
  rewardAmount,
  withinRewardMonthlyCap,
  isLegalRewardTransition,
  UGC_MONTHLY_CAP,
  payoutDenomination,
  isValidDenomination,
  AMAZON_ES_DENOMINATIONS,
  MIN_PAYOUT_EUR,
  type ReferralState,
} from '@/lib/referrals/logic'

describe('generateReferralCode', () => {
  it('genera hex de longitud bytes*2 (12 por defecto)', () => {
    expect(generateReferralCode()).toMatch(/^[0-9a-f]{12}$/)
    expect(generateReferralCode(9)).toMatch(/^[0-9a-f]{18}$/)
  })
  it('no colisiona en 5000 generaciones', () => {
    const set = new Set<string>()
    for (let i = 0; i < 5000; i++) set.add(generateReferralCode())
    expect(set.size).toBe(5000)
  })
})

describe('isWithinAttributionWindow', () => {
  const base = '2026-07-10T00:00:00.000Z'
  it('paga dentro de la ventana (5 días)', () => {
    expect(isWithinAttributionWindow(base, '2026-07-15T00:00:00.000Z')).toBe(true)
  })
  it('paga justo en el límite de 10 días → cuenta', () => {
    expect(isWithinAttributionWindow(base, '2026-07-20T00:00:00.000Z')).toBe(true)
  })
  it('paga a los 11 días → NO cuenta', () => {
    expect(isWithinAttributionWindow(base, '2026-07-21T00:00:01.000Z')).toBe(false)
  })
  it('paga ANTES de la atribución → inválido', () => {
    expect(isWithinAttributionWindow(base, '2026-07-09T23:59:59.000Z')).toBe(false)
  })
  it('fechas inválidas → false', () => {
    expect(isWithinAttributionWindow('nope', base)).toBe(false)
    expect(isWithinAttributionWindow(base, 'nope')).toBe(false)
  })
  it('respeta la constante de ventana', () => {
    expect(REFERRAL_ATTRIBUTION_WINDOW_DAYS).toBe(10)
  })
})

describe('computeHoldUntil / isHoldExpired', () => {
  it('hold = pago + 15 días por defecto (cubre la ventana de reembolso de 15 días)', () => {
    const paid = '2026-07-10T00:00:00.000Z'
    expect(computeHoldUntil(paid).toISOString()).toBe('2026-07-25T00:00:00.000Z')
    expect(REFERRAL_HOLD_DAYS).toBe(15)
  })
  it('acepta holdDays personalizado', () => {
    expect(computeHoldUntil('2026-07-10T00:00:00.000Z', 14).toISOString()).toBe('2026-07-24T00:00:00.000Z')
  })
  it('hold vencido cuando now >= holdUntil (incluye el instante exacto)', () => {
    const hold = '2026-07-15T00:00:00.000Z'
    expect(isHoldExpired(hold, '2026-07-15T00:00:00.000Z')).toBe(true)
    expect(isHoldExpired(hold, '2026-07-16T00:00:00.000Z')).toBe(true)
    expect(isHoldExpired(hold, '2026-07-14T23:59:59.000Z')).toBe(false)
  })
})

describe('refereeEligibility', () => {
  const ok = {
    referrerUserId: 'A',
    referredUserId: 'B',
    referredHasEverPaid: false,
    referrerIsActivePremium: true,
  }
  it('elegible: embajador premium, referido nuevo, distinto', () => {
    expect(refereeEligibility(ok)).toEqual({ eligible: true })
  })
  it('embajador no premium → referrer_not_premium (tiene prioridad)', () => {
    expect(refereeEligibility({ ...ok, referrerIsActivePremium: false })).toEqual({
      eligible: false, reason: 'referrer_not_premium',
    })
  })
  it('auto-referido → self_referral', () => {
    expect(refereeEligibility({ ...ok, referredUserId: 'A' })).toEqual({
      eligible: false, reason: 'self_referral',
    })
  })
  it('referido ya pagó alguna vez (ex-premium) → referred_not_new_payer', () => {
    expect(refereeEligibility({ ...ok, referredHasEverPaid: true })).toEqual({
      eligible: false, reason: 'referred_not_new_payer',
    })
  })
})

describe('isLegalTransition (state machine)', () => {
  it('transiciones legales del camino feliz', () => {
    expect(isLegalTransition('pending', 'qualified')).toBe(true)
    expect(isLegalTransition('qualified', 'payable')).toBe(true)
    expect(isLegalTransition('payable', 'paid')).toBe(true)
  })
  it('clawback: paid → rejected es legal', () => {
    expect(isLegalTransition('paid', 'rejected')).toBe(true)
  })
  it('rechazos y expiraciones legales desde pending', () => {
    expect(isLegalTransition('pending', 'rejected')).toBe(true)
    expect(isLegalTransition('pending', 'expired')).toBe(true)
  })
  it('saltos ilegales', () => {
    expect(isLegalTransition('pending', 'paid')).toBe(false)
    expect(isLegalTransition('payable', 'qualified')).toBe(false)
    expect(isLegalTransition('qualified', 'expired')).toBe(false)
  })
  it('estados terminales no transicionan', () => {
    for (const to of ['pending', 'qualified', 'payable', 'paid'] as ReferralState[]) {
      expect(isLegalTransition('rejected', to)).toBe(false)
      expect(isLegalTransition('expired', to)).toBe(false)
    }
  })
})

describe('recompensas bug/UGC', () => {
  it('importes: bug 3 €, ugc 5 €', () => {
    expect(rewardAmount('bug')).toBe(3)
    expect(rewardAmount('ugc')).toBe(5)
  })
  it('tope mensual: ugc corta en 3, bug sin tope duro', () => {
    expect(UGC_MONTHLY_CAP).toBe(3)
    expect(withinRewardMonthlyCap('ugc', 2)).toBe(true)
    expect(withinRewardMonthlyCap('ugc', 3)).toBe(false)
    expect(withinRewardMonthlyCap('bug', 100)).toBe(true)
  })
  it('state machine de recompensa: legales e ilegales', () => {
    expect(isLegalRewardTransition('pending', 'approved')).toBe(true)
    expect(isLegalRewardTransition('approved', 'paid')).toBe(true)
    expect(isLegalRewardTransition('paid', 'rejected')).toBe(true) // clawback
    expect(isLegalRewardTransition('pending', 'paid')).toBe(false)
    expect(isLegalRewardTransition('rejected', 'approved')).toBe(false)
  })
})

describe('pago acumulado (denominaciones Amazon.es)', () => {
  it('mayor denominación <= saldo; el resto se acumula', () => {
    expect(payoutDenomination(13)).toBe(10) // sobran 3
    expect(payoutDenomination(5)).toBe(5)
    expect(payoutDenomination(9)).toBe(5)
    expect(payoutDenomination(23)).toBe(20)
    expect(payoutDenomination(1500)).toBe(1500)
    expect(payoutDenomination(9999)).toBe(1500) // tope superior de la denominación
  })
  it('por debajo del mínimo (5€) no se paga', () => {
    expect(payoutDenomination(4.99)).toBe(0)
    expect(payoutDenomination(3)).toBe(0)
    expect(payoutDenomination(0)).toBe(0)
    expect(MIN_PAYOUT_EUR).toBe(5)
  })
  it('valida denominaciones', () => {
    expect(isValidDenomination(5)).toBe(true)
    expect(isValidDenomination(10)).toBe(true)
    expect(isValidDenomination(3)).toBe(false)
    expect(isValidDenomination(7)).toBe(false)
    expect(AMAZON_ES_DENOMINATIONS[0]).toBe(5)
  })
})
