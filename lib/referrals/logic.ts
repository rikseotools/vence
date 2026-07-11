// lib/referrals/logic.ts
// Lógica PURA del Programa de Referidos / Embajadores (sin BD, sin I/O → testeable).
// Diseño: docs/roadmap/programa-referidos-embajadores.md
//
// Reglas (2026-07-10): refiere solo premium; el referido debe NUNCA haber pagado
// (registro nuevo o free existente, excluye ex-premium) y pagar en <=10 días DESDE LA
// ATRIBUCIÓN; hold = pago + 5 días (ventana de reembolso); bounty 10 €, descuento 5 €.

import { randomBytes } from 'crypto'

export const REFERRAL_ATTRIBUTION_WINDOW_DAYS = 10
export const REFERRAL_HOLD_DAYS = 5          // = ventana de reembolso de Vence
export const REFERRAL_BOUNTY_EUR = 10        // gift card Amazon al embajador
export const REFERRAL_DISCOUNT_EUR = 5       // descuento (cupón) al referido

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Token de referido opaco (estilo OpositaTest `?capturar=70a0b2d21`), hex.
 * 6 bytes → 12 caracteres hex. Suficiente entropía y anti-enumeración.
 */
export function generateReferralCode(bytes = 6): string {
  return randomBytes(bytes).toString('hex')
}

/** ¿el pago del referido cae dentro de la ventana desde la atribución? */
export function isWithinAttributionWindow(
  attributedAt: Date | string,
  paidAt: Date | string,
  windowDays = REFERRAL_ATTRIBUTION_WINDOW_DAYS,
): boolean {
  const a = new Date(attributedAt).getTime()
  const p = new Date(paidAt).getTime()
  if (Number.isNaN(a) || Number.isNaN(p)) return false
  if (p < a) return false // pago antes de atribuir = inválido
  return (p - a) / DAY_MS <= windowDays
}

/** hold_until = pago + ventana de reembolso (por defecto 5 días). */
export function computeHoldUntil(paidAt: Date | string, holdDays = REFERRAL_HOLD_DAYS): Date {
  return new Date(new Date(paidAt).getTime() + holdDays * DAY_MS)
}

/** ¿venció ya el hold? (para promover qualified → payable). */
export function isHoldExpired(holdUntil: Date | string, now: Date | string): boolean {
  return new Date(now).getTime() >= new Date(holdUntil).getTime()
}

export interface EligibilityInput {
  referrerUserId: string
  referredUserId: string
  /** true si el referido pagó ALGUNA vez (incluye ex-premium) → NO elegible */
  referredHasEverPaid: boolean
  /** el embajador debe ser premium ACTIVO en el momento de atribuir */
  referrerIsActivePremium: boolean
}

export type EligibilityReason =
  | 'referrer_not_premium'
  | 'self_referral'
  | 'referred_not_new_payer'

/** Elegibilidad del referido en el momento de atribuir. */
export function refereeEligibility(
  input: EligibilityInput,
): { eligible: boolean; reason?: EligibilityReason } {
  if (!input.referrerIsActivePremium) return { eligible: false, reason: 'referrer_not_premium' }
  if (input.referrerUserId === input.referredUserId) return { eligible: false, reason: 'self_referral' }
  if (input.referredHasEverPaid) return { eligible: false, reason: 'referred_not_new_payer' }
  return { eligible: true }
}

// --- State machine del estado de un referido ---
export const REFERRAL_STATES = [
  'pending', 'qualified', 'payable', 'paid', 'rejected', 'expired',
] as const
export type ReferralState = (typeof REFERRAL_STATES)[number]

const LEGAL_TRANSITIONS: Record<ReferralState, ReferralState[]> = {
  pending: ['qualified', 'rejected', 'expired'],
  qualified: ['payable', 'rejected'],   // rejected = reembolso dentro del hold
  payable: ['paid', 'rejected'],
  paid: ['rejected'],                    // clawback por chargeback tardío
  rejected: [],                          // terminal
  expired: [],                           // terminal
}

export function isLegalTransition(from: ReferralState, to: ReferralState): boolean {
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false
}

// ============================================================================
// Recompensas por BUG / UGC (las otras 2 formas de ganar, tabla reward_submissions)
// ============================================================================
export const REWARD_AMOUNTS = { bug: 3, ugc: 5 } as const
export type RewardType = keyof typeof REWARD_AMOUNTS
export const UGC_MONTHLY_CAP = 3          // UGC: máximo 3 al mes por usuario
export const UGC_HOLD_DAYS = REFERRAL_HOLD_DAYS // UGC: se paga tras comprobar que el post sigue vivo

export function rewardAmount(type: RewardType): number {
  return REWARD_AMOUNTS[type]
}

/** ¿puede el usuario recibir otra recompensa de este tipo este mes? (solo UGC tiene tope duro). */
export function withinRewardMonthlyCap(type: RewardType, countThisMonth: number): boolean {
  if (type === 'ugc') return countThisMonth < UGC_MONTHLY_CAP
  return true // bug: sin tope duro; se controla por aprobación manual
}

/**
 * Abrevia el nombre de un REFERIDO para no exponer su apellido completo al embajador:
 * "Rubén Martínez López" → "Rubén M. L." (nombre + iniciales de apellidos). Privacidad.
 */
export function abbreviateReferredName(name: string | null | undefined): string | null {
  if (!name) return null
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return parts[0] ?? null
  const initials = parts.slice(1).map((p) => (p[0] ? p[0].toUpperCase() + '.' : '')).filter(Boolean).join(' ')
  return initials ? `${parts[0]} ${initials}` : parts[0]
}

// ===== Recompensa "REGISTRO ACTIVO" (bonus por referido que llega a >=5 tests) =====
// Decisión Manuel 11/07: 2€ por referido activo, como inversión temporal de captación/marca.
// DINERO REAL → detrás del flag ACTIVE_SIGNUP_REWARD=1 (OFF por defecto). Todo parametrizable por env.
export const ACTIVE_SIGNUP_REWARD_EUR = Number(process.env.ACTIVE_SIGNUP_REWARD_EUR || 2)
export const ACTIVE_SIGNUP_MIN_TESTS = Number(process.env.ACTIVE_SIGNUP_MIN_TESTS || 5)
export const ACTIVE_SIGNUP_MONTHLY_CAP = Number(process.env.ACTIVE_SIGNUP_MONTHLY_CAP || 30) // por embajador/mes (anti-abuso)
export const ACTIVE_SIGNUP_MONTHLY_BUDGET_EUR = Number(process.env.ACTIVE_SIGNUP_MONTHLY_BUDGET_EUR || 500) // presupuesto global/mes (tipo Ads)

/** La recompensa de registro activo solo se concede si el flag está EXACTAMENTE en '1'. */
export function activeSignupEnabled(): boolean {
  return process.env.ACTIVE_SIGNUP_REWARD === '1'
}

/**
 * Cómo se le muestra al embajador el bonus de "registro activo" de UN referido (pura, sin BD).
 *  - `earned`  → ya concedido (grantedAmount no nulo) — cuenta en su saldo.
 *  - `pending` → aún no, pero el programa está activo y el referido no está descartado → mostramos
 *                el progreso REAL de tests hacia el umbral (transparencia).
 *  - `none`    → programa apagado o referido rechazado → no se promete nada.
 * Extraída para poder testear el mapeo aislado (dinero → un modo de fallo = un test).
 */
export interface ActiveRewardView {
  state: 'earned' | 'pending' | 'none'
  amount: number
  testsDone: number
  testsNeeded: number
}
export function deriveActiveReward(input: {
  grantedAmount: number | null
  testsDone: number
  status: string
  enabled: boolean
}): ActiveRewardView {
  const testsNeeded = ACTIVE_SIGNUP_MIN_TESTS
  const done = Math.max(0, Math.trunc(input.testsDone || 0))
  if (input.grantedAmount != null) {
    return { state: 'earned', amount: input.grantedAmount, testsDone: done, testsNeeded }
  }
  if (input.enabled && input.status !== 'rejected') {
    return { state: 'pending', amount: ACTIVE_SIGNUP_REWARD_EUR, testsDone: done, testsNeeded }
  }
  return { state: 'none', amount: 0, testsDone: done, testsNeeded }
}

export const REWARD_SUBMISSION_STATES = ['pending', 'approved', 'rejected', 'paid'] as const
export type RewardSubmissionState = (typeof REWARD_SUBMISSION_STATES)[number]

const REWARD_LEGAL_TRANSITIONS: Record<RewardSubmissionState, RewardSubmissionState[]> = {
  pending: ['approved', 'rejected'],
  approved: ['paid', 'rejected'],
  rejected: [],
  paid: ['rejected'], // clawback (p.ej. post borrado tras cobrar)
}

export function isLegalRewardTransition(from: RewardSubmissionState, to: RewardSubmissionState): boolean {
  return REWARD_LEGAL_TRANSITIONS[from]?.includes(to) ?? false
}

// ============================================================================
// Pago ACUMULADO en gift cards de Amazon.es (denominaciones FIJAS de Bitrefill)
// ============================================================================
// Las recompensas se acumulan en el saldo del usuario y se pagan en tarjetas de Amazon.es de
// importes fijos. Regla: cuando el saldo llega al mínimo, se paga la mayor denominación <= saldo
// y el resto se acumula para la siguiente.
export const AMAZON_ES_DENOMINATIONS = [5, 10, 20, 50, 100, 200, 400, 500, 1000, 1500] as const
export const MIN_PAYOUT_EUR = 5

/** Mayor denominación de Amazon.es que se puede pagar con este saldo, o 0 si no llega al mínimo. */
export function payoutDenomination(balanceEur: number): number {
  if (!(balanceEur >= MIN_PAYOUT_EUR)) return 0
  let best = 0
  for (const d of AMAZON_ES_DENOMINATIONS) {
    if (d <= balanceEur && d > best) best = d
  }
  return best
}

/** ¿es `amount` una denominación válida de Amazon.es? */
export function isValidDenomination(amount: number): boolean {
  return (AMAZON_ES_DENOMINATIONS as readonly number[]).includes(amount)
}
