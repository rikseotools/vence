// lib/referrals/logic.ts
// Lógica PURA del Programa de Referidos / Embajadores (sin BD, sin I/O → testeable).
// Diseño: docs/roadmap/programa-referidos-embajadores.md
//
// Reglas (2026-07-10): refiere solo premium; el referido debe NUNCA haber pagado
// (registro nuevo o free existente, excluye ex-premium) y pagar en <=10 días DESDE LA
// ATRIBUCIÓN; hold = pago + 15 días (>= ventana de reembolso); bounty 10 €, descuento 5 €.

import { randomBytes } from 'crypto'
// Los tipos de impugnación tienen fuente única; importarla (en vez de recopiar la lista) es lo que
// hace que `Record<DisputeType, boolean>` obligue a clasificar cualquier tipo nuevo.
import type { DisputeType } from '@/lib/api/v2/dispute/types'
// Núcleo puro compartido con las CLI en CommonJS: una sola lista de motivos que pagan.
import {
  DISPUTE_REWARD_BY_TYPE as POLICY_BY_TYPE,
  disputeTypeIsRewardable as policyIsRewardable,
} from './disputeRewardPolicy'

export const REFERRAL_ATTRIBUTION_WINDOW_DAYS = 10
// Hold = 15 días para CUBRIR la ventana real de reembolso: garantía comercial (15 días,
// ver /cancelacion-y-devoluciones) + derecho de desistimiento UE (14 días, no renunciado
// en checkout). Antes eran 5 días → hueco de 10 días en el que se pagaba el bounty y el
// referido aún podía reembolsar → pérdida de la gift card (11/07/2026). El bounty no pasa
// a `payable` hasta que expira este hold; un reembolso dentro del hold hace qualified→rejected.
export const REFERRAL_HOLD_DAYS = 15
export const REFERRAL_BOUNTY_EUR = 10        // gift card Amazon al embajador
export const REFERRAL_DISCOUNT_EUR = 5       // descuento (cupón) al referido
// Solo cuenta como referido un usuario NUEVO: su cuenta debe haberse creado como mucho N días
// antes de la atribución (margen para el flujo real clic→registro→login donde se atribuye). Sin
// esto, un free PREEXISTENTE (que ya usaba Vece por su cuenta) contaba como referido y generaba
// bounty aunque el embajador no lo captó (caso Marta 12/07: cuenta de hace 31 días). Un referido
// nuevo real se registra a la vez que la referencia → age ~0.
export const REFERRAL_NEW_ACCOUNT_MAX_AGE_DAYS = 7

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
  /** antigüedad de la cuenta del referido, en días, al atribuir. undefined = no comprobar (back-compat) */
  referredAccountAgeDays?: number
}

export type EligibilityReason =
  | 'referrer_not_premium'
  | 'self_referral'
  | 'referred_not_new_payer'
  | 'referred_not_new'   // cuenta preexistente (creada hace > N días) → no es captación nueva

/** Elegibilidad del referido en el momento de atribuir. */
export function refereeEligibility(
  input: EligibilityInput,
): { eligible: boolean; reason?: EligibilityReason } {
  if (!input.referrerIsActivePremium) return { eligible: false, reason: 'referrer_not_premium' }
  if (input.referrerUserId === input.referredUserId) return { eligible: false, reason: 'self_referral' }
  if (input.referredHasEverPaid) return { eligible: false, reason: 'referred_not_new_payer' }
  // Solo usuarios NUEVOS: una cuenta preexistente (creada hace más de N días) no es captación.
  if (input.referredAccountAgeDays !== undefined && input.referredAccountAgeDays > REFERRAL_NEW_ACCOUNT_MAX_AGE_DAYS) {
    return { eligible: false, reason: 'referred_not_new' }
  }
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
export const REWARD_AMOUNTS = { bug: 3, ugc: 5, impugnacion: 1 } as const
export type RewardType = keyof typeof REWARD_AMOUNTS
export const UGC_MONTHLY_CAP = 3          // UGC: máximo 3 al mes por usuario
export const UGC_HOLD_DAYS = 5 // UGC: hold propio (verificar que el post sigue vivo); NO ligado a la ventana de reembolso, por eso NO sube a 15 con el referido

// Impugnación aceptada = 1 € (decisión Manuel 28/07). A diferencia de bug/ugc, esta se concede
// AUTOMÁTICAMENTE al resolver, así que el tope no es opcional: es lo único que separa "premiar la
// calidad" de "pagar por volumen".
//
// El tope sale del dato, no del dedo (medido 28/07 sobre `question_disputes`): ~100-120 impugnaciones
// aceptadas/mes de usuarios premium ≈ 100-120 €/mes, pero MUY concentradas — una sola usuaria acumuló
// 76 aceptadas en 90 días (≈25/mes, ≈25 €/mes ella sola). Con tope 10 el gasto máximo por persona
// queda en 10 €/mes y el 90% de los usuarios no lo nota (la mediana está muy por debajo).
export const IMPUGNACION_MONTHLY_CAP = Number(process.env.IMPUGNACION_MONTHLY_CAP || 10)

export function rewardAmount(type: RewardType): number {
  return REWARD_AMOUNTS[type]
}

/**
 * Etiqueta user-facing de cada FUENTE de ingreso (las de `reward_earnings`). ÚNICA copia: antes vivía
 * duplicada en tres sitios (panel del usuario, `EmbajadorPanelView` y el panel admin) y ya habían
 * divergido —"Recomendaciones" vs "Referidos"—, con el riesgo real de que una fuente nueva se añadiera
 * en dos de los tres y en el otro saliera el identificador crudo ("impugnacion") a la cara del usuario.
 * Mismo problema que arregló el guardarraíl de `VoucherCard`.
 */
export const REWARD_SOURCE_LABEL: Record<string, string> = {
  referido: '💛 Recomendaciones',
  registro_activo: '📝 Registros activos',
  bug: '🐛 Mejoras/bugs',
  ugc: '📣 Opiniones',
  impugnacion: '⚖️ Impugnaciones aceptadas',
}

export function rewardSourceText(source: string): string {
  return REWARD_SOURCE_LABEL[source] || source
}

/** ¿puede el usuario recibir otra recompensa de este tipo este mes? (UGC e impugnación tienen tope duro). */
export function withinRewardMonthlyCap(type: RewardType, countThisMonth: number): boolean {
  if (type === 'ugc') return countThisMonth < UGC_MONTHLY_CAP
  if (type === 'impugnacion') return countThisMonth < IMPUGNACION_MONTHLY_CAP
  return true // bug: sin tope duro; se controla por aprobación manual
}

/**
 * ¿Qué TIPOS de impugnación dan derecho al euro? La política vive en el núcleo puro
 * `disputeRewardPolicy.js` (con el porqué y los números que la motivaron) para que la compartan el
 * runtime y las herramientas CLI en CommonJS — el dossier de impugnaciones enseña LA MISMA lista
 * que se paga, y la página de recompensas promete LA MISMA. Aquí solo se re-exporta tipada.
 *
 * El `Record<DisputeType, boolean>` es la red de seguridad: añadir un tipo a `ALL_DISPUTE_TYPES`
 * sin clasificarlo en el núcleo **no compila**. Un tipo nuevo no puede heredar en silencio una
 * política de pago que nadie eligió.
 */
export const DISPUTE_REWARD_BY_TYPE: Record<DisputeType, boolean> = POLICY_BY_TYPE

/** ¿Este tipo de impugnación da derecho al euro automático? Desconocido → NO (el dinero falla cerrado). */
export function disputeTypeIsRewardable(disputeType?: string | null): boolean {
  return policyIsRewardable(disputeType)
}

/**
 * ¿Corresponde 1 € por esta impugnación resuelta? PURA (sin BD) para poder testear la política
 * sin montar datos. Se concede SOLO si:
 *  · la impugnación se acepta A FAVOR del usuario (`resolved`; `rejected` no paga), y
 *  · la escribió una PERSONA (`source='user'`; las `ai_auto` no tienen a quién pagar), y
 *  · quien la escribió es PREMIUM (decisión Manuel 28/07: el programa es solo-premium, igual que
 *    el resto de fuentes — un free no cobra aunque su impugnación sea impecable), y
 *  · el TIPO es de los verificables (ver `DISPUTE_REWARD_BY_TYPE`).
 * El anti-duplicado por `dispute_id` y el tope mensual NO se deciden aquí: viven en la capa de BD
 * (índice único parcial) y en `withinRewardMonthlyCap`, porque necesitan contar filas.
 */
export function shouldRewardResolvedDispute(params: {
  status: string
  source?: string | null
  planType?: string | null
  userId?: string | null
  disputeType?: string | null
}): boolean {
  if (params.status !== 'resolved') return false
  if (!params.userId) return false
  if ((params.source ?? 'user') !== 'user') return false
  if (!disputeTypeIsRewardable(params.disputeType)) return false
  return params.planType === 'premium'
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

// ============================================================================
// Estado del icono 🎁 del Header (decisión Manuel, 29/07/2026)
// ============================================================================
//
// Tres estados que se aprenden sin leer instrucciones, y una señal aparte para la novedad:
//
//   · SIN saldo          → apagado (gris). No promete nada.
//   · CON saldo < mínimo → encendido, SIN cifra. Dice «tienes algo» sin prometer un cobro que no
//     existe: por debajo de 5 € no se puede canjear.
//   · Saldo COBRABLE     → encendido + la cifra del vale que ya se puede pedir.
//
// **Por qué la cifra solo aparece cuando es cobrable.** Medido el 29/07: de 18 usuarios con saldo,
// **11 están por debajo del mínimo** (tres con 1 €, siete con 3 €). Escribir «1 €» en la barra a
// quien no puede cobrarlo convierte el clic en una decepción —y quema el canal para la siguiente—,
// además de anclar la percepción del programa en su cifra más baja (las recompensas reales son 3 €
// por bug y 10 € por referido).
//
// **Por qué la novedad va aparte del color.** Antes el icono marcaba *ganancias sin ver* y se
// apagaba al pincharlo. Si el color pasa a significar «tienes saldo», el que tenga 3 € lo verá
// encendido para siempre y en dos días será papel pintado. Se separan: el COLOR informa del saldo,
// el PUNTO avisa de que hay algo nuevo desde la última visita.
//
// **Sin animación**: el `animate-bounce` permanente cansa, molesta a quien tiene sensibilidad al
// movimiento y hace que el icono se lea como publicidad — justo lo que impide pincharlo.

export type EstadoIconoRecompensas = 'sin_saldo' | 'con_saldo' | 'cobrable'

export interface IconoRecompensas {
  estado: EstadoIconoRecompensas
  /** Importe del vale que YA se puede pedir. `null` mientras no llegue al mínimo: no se pinta. */
  importeCobrable: number | null
  /** Punto de novedad: hay ingresos que el usuario aún no ha visto. */
  hayNovedad: boolean
  /** Texto del `title`/`aria-label`. Se decide aquí para que no diverja del estado pintado. */
  titulo: string
}

/**
 * Qué pinta el icono 🎁, dado el saldo y si hay ingresos sin ver. PURO: sin BD y sin React, para
 * poder fijarlo en tests — es la única función que decide si a alguien se le promete dinero.
 */
export function estadoIconoRecompensas({
  balanceEur,
  unseen,
}: { balanceEur: number; unseen: number }): IconoRecompensas {
  const saldo = Number.isFinite(balanceEur) && balanceEur > 0 ? balanceEur : 0
  const hayNovedad = Number.isFinite(unseen) && unseen > 0
  const cobrable = payoutDenomination(saldo) // 0 si no llega al mínimo; reutiliza la regla del pago

  if (cobrable > 0) {
    return {
      estado: 'cobrable',
      importeCobrable: cobrable,
      hayNovedad,
      titulo: `Tienes ${cobrable} € listos para canjear`,
    }
  }
  if (saldo > 0) {
    return {
      estado: 'con_saldo',
      importeCobrable: null,
      hayNovedad,
      // Sin cifra en el icono, pero el title sí puede decir cuánto falta: quien pasa el ratón
      // está preguntando, y ahí la respuesta honesta ayuda en vez de decepcionar.
      titulo: `Llevas ${saldo.toFixed(2).replace(/\.00$/, '')} € — a partir de ${MIN_PAYOUT_EUR} € puedes canjear`,
    }
  }
  return {
    estado: 'sin_saldo',
    importeCobrable: null,
    hayNovedad,
    titulo: 'Recompensas — gana por recomendar Vence, reportar fallos y opinar',
  }
}
