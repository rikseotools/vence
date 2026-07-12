// lib/referrals/queries.ts
// Queries del Programa de Referidos (Fase 1). Escrituras → getAdminDb, lecturas → getReadDb.
// Cada función acepta un `exec` opcional (db o tx de Drizzle) para poder testear dentro de una
// transacción con ROLLBACK (integración contra RDS real sin persistir). Diseño: Anexo A del roadmap.

import { and, desc, eq, inArray, lte, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { getAdminDb, getReadDb } from '@/db/client'
import { referralCodes, referrals, rewardPayouts, rewardSubmissions } from '@/db/referralSchema'
import { userProfiles, userSubscriptions } from '@/db/schema'
import {
  generateReferralCode,
  abbreviateReferredName,
  refereeEligibility,
  computeHoldUntil,
  isWithinAttributionWindow,
  rewardAmount,
  withinRewardMonthlyCap,
  MIN_PAYOUT_EUR,
  isValidDenomination,
  activeSignupEnabled,
  deriveActiveReward,
  type ActiveRewardView,
  type EligibilityReason,
  type RewardType,
} from './logic'

// Drizzle db o tx; `any` para no pelear con los genéricos de transacción.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Executor = any

/** Devuelve el código del embajador; lo crea (token opaco único) si no tiene. */
export async function getOrCreateReferralCode(ownerUserId: string, exec?: Executor): Promise<string> {
  const db = exec ?? getAdminDb()
  const existing = await db.select({ code: referralCodes.code })
    .from(referralCodes).where(eq(referralCodes.ownerUserId, ownerUserId)).limit(1)
  if (existing.length) return existing[0].code

  for (let i = 0; i < 5; i++) {
    const code = generateReferralCode()
    try {
      const [row] = await db.insert(referralCodes)
        .values({ ownerUserId, code }).returning({ code: referralCodes.code })
      return row.code
    } catch {
      // colisión (code único u owner ya existente por carrera) → re-leer por owner
      const again = await db.select({ code: referralCodes.code })
        .from(referralCodes).where(eq(referralCodes.ownerUserId, ownerUserId)).limit(1)
      if (again.length) return again[0].code
    }
  }
  throw new Error('no se pudo generar un código de referido único')
}

/** Código del embajador SIN crearlo (READ-ONLY). null si aún no tiene. Para vistas admin de solo lectura. */
export async function getReferralCode(ownerUserId: string, exec?: Executor): Promise<string | null> {
  const db = exec ?? getReadDb()
  const rows = await db.select({ code: referralCodes.code })
    .from(referralCodes).where(eq(referralCodes.ownerUserId, ownerUserId)).limit(1)
  return rows.length ? rows[0].code : null
}

/** plan_type del usuario (para el gate de embajador = 'premium'). */
export async function getUserPlanType(userId: string, exec?: Executor): Promise<string | null> {
  const db = exec ?? getReadDb()
  const [row] = await db.select({ plan: userProfiles.planType })
    .from(userProfiles).where(eq(userProfiles.id, userId)).limit(1)
  return (row?.plan as string | null) ?? null
}

/** ¿el usuario ha pagado ALGUNA vez? (tiene alguna fila en user_subscriptions → excluye ex-premium). */
export async function hasUserEverPaid(userId: string, exec?: Executor): Promise<boolean> {
  const db = exec ?? getReadDb()
  const [row] = await db.select({ id: userSubscriptions.id })
    .from(userSubscriptions).where(eq(userSubscriptions.userId, userId)).limit(1)
  return !!row
}

/** ¿el usuario tiene un referido en estado `pending`? (atribución válida → puede llevar el cupón 5 €). */
export async function hasPendingReferral(userId: string, exec?: Executor): Promise<boolean> {
  const db = exec ?? getReadDb()
  const [row] = await db.select({ id: referrals.id }).from(referrals)
    .where(and(eq(referrals.referredUserId, userId), eq(referrals.status, 'pending'))).limit(1)
  return !!row
}

/** Resuelve un código de referido ACTIVO → owner, o null si no existe/está inactivo. */
export async function resolveActiveReferralCode(
  code: string, exec?: Executor,
): Promise<{ ownerUserId: string } | null> {
  const db = exec ?? getReadDb()
  const [row] = await db.select({ owner: referralCodes.ownerUserId })
    .from(referralCodes)
    .where(and(eq(referralCodes.code, code), eq(referralCodes.active, true)))
    .limit(1)
  return row ? { ownerUserId: row.owner as string } : null
}

export interface AttributeInput {
  code: string
  referredUserId: string
  referrerIsActivePremium: boolean
  referredHasEverPaid: boolean
}
export type AttributeResult =
  | { ok: true; referralId: string; referrerUserId: string; alreadyAttributed?: boolean }
  | { ok: false; reason: 'code_invalid' | EligibilityReason | 'insert_failed' }

/** Atribuye un referido a un embajador (first-touch: unique referred_user_id). */
export async function attributeReferral(input: AttributeInput, exec?: Executor): Promise<AttributeResult> {
  const db = exec ?? getAdminDb()

  const [codeRow] = await db.select({ owner: referralCodes.ownerUserId, active: referralCodes.active })
    .from(referralCodes).where(eq(referralCodes.code, input.code)).limit(1)
  if (!codeRow || !codeRow.active) return { ok: false, reason: 'code_invalid' }
  const referrerUserId = codeRow.owner as string

  const elig = refereeEligibility({
    referrerUserId,
    referredUserId: input.referredUserId,
    referredHasEverPaid: input.referredHasEverPaid,
    referrerIsActivePremium: input.referrerIsActivePremium,
  })
  if (!elig.eligible) return { ok: false, reason: elig.reason! }

  // first-touch: si ya fue atribuido, no duplicar (respeta al primero).
  const [existing] = await db.select({ id: referrals.id, referrer: referrals.referrerUserId })
    .from(referrals).where(eq(referrals.referredUserId, input.referredUserId)).limit(1)
  if (existing) return { ok: true, referralId: existing.id, referrerUserId: existing.referrer, alreadyAttributed: true }

  try {
    const [row] = await db.insert(referrals)
      .values({ referrerUserId, referredUserId: input.referredUserId, code: input.code, status: 'pending' })
      .returning({ id: referrals.id })
    return { ok: true, referralId: row.id, referrerUserId }
  } catch {
    // carrera contra el unique(referred_user_id) → leer el ganador
    const [again] = await db.select({ id: referrals.id, referrer: referrals.referrerUserId })
      .from(referrals).where(eq(referrals.referredUserId, input.referredUserId)).limit(1)
    if (again) return { ok: true, referralId: again.id, referrerUserId: again.referrer, alreadyAttributed: true }
    return { ok: false, reason: 'insert_failed' }
  }
}

export interface QualifyInput {
  referredUserId: string
  planType: string
  paymentRef: string
  paidAt: string // ISO
}

/** Al pagar el referido: si hay `pending` y paga dentro de la ventana → `qualified` + hold. */
export async function qualifyReferralOnPayment(
  input: QualifyInput, exec?: Executor,
): Promise<{ qualified: boolean; reason?: 'no_pending_referral' | 'outside_window'; referrerUserId?: string; bounty?: number }> {
  const db = exec ?? getAdminDb()
  const [ref] = await db.select().from(referrals)
    .where(and(eq(referrals.referredUserId, input.referredUserId), eq(referrals.status, 'pending'))).limit(1)
  if (!ref) return { qualified: false, reason: 'no_pending_referral' }

  if (!isWithinAttributionWindow(ref.attributedAt, input.paidAt)) {
    await db.update(referrals).set({ status: 'expired', updatedAt: sql`now()` }).where(eq(referrals.id, ref.id))
    return { qualified: false, reason: 'outside_window' }
  }

  const holdUntil = computeHoldUntil(input.paidAt).toISOString()
  await db.update(referrals).set({
    status: 'qualified',
    qualifiedAt: input.paidAt,
    planType: input.planType,
    qualifyingPaymentRef: input.paymentRef,
    holdUntil,
    updatedAt: sql`now()`,
  }).where(eq(referrals.id, ref.id))
  return { qualified: true, referrerUserId: ref.referrerUserId, bounty: Number(ref.bountyAmount) }
}

/**
 * Clawback: si el referido reembolsa/hace chargeback, rechaza su referido para que NO se pague.
 * Rechaza estados no-terminales (pending/qualified/payable). Si ya estaba `paid`, avisa (clawback manual).
 */
export async function rejectReferralOnRefund(
  referredUserId: string, exec?: Executor,
): Promise<{ rejected: number; alreadyPaid: boolean }> {
  const db = exec ?? getAdminDb()
  const [paid] = await db.select({ id: referrals.id }).from(referrals)
    .where(and(eq(referrals.referredUserId, referredUserId), eq(referrals.status, 'paid'))).limit(1)
  const res = await db.update(referrals)
    .set({ status: 'rejected', updatedAt: sql`now()` })
    .where(and(
      eq(referrals.referredUserId, referredUserId),
      inArray(referrals.status, ['pending', 'qualified', 'payable']),
    ))
    .returning({ id: referrals.id })
  return { rejected: res.length, alreadyPaid: !!paid }
}

/** Promueve `qualified` → `payable` cuando el hold ya venció (para el cron). Devuelve nº promovidos. */
export async function promoteEligibleToPayable(nowIso: string, exec?: Executor): Promise<number> {
  const db = exec ?? getAdminDb()
  const res = await db.update(referrals)
    .set({ status: 'payable', updatedAt: sql`now()` })
    .where(and(eq(referrals.status, 'qualified'), lte(referrals.holdUntil, nowIso)))
    .returning({ id: referrals.id })
  return res.length
}

/**
 * Recompensa "registro activo" (2€ al embajador cuando el referido llega a N tests) tal y como
 * se le muestra al embajador, con total transparencia:
 *  - `earned`  → ya concedida (columna active_reward_amount rellena); cuenta en su saldo.
 *  - `pending` → aún no: mostramos el progreso REAL de tests (misma fuente que la concesión:
 *                tabla `tests`) para que "N/N" coincida con cuándo se paga de verdad.
 *  - `none`    → el programa está apagado o el referido quedó descartado → no se promete nada.
 */
export interface ReferralDetail {
  name: string | null
  city: string | null
  oposicion: string | null
  status: string
  date: string
  activeReward: ActiveRewardView
}

/** Detalle por referido (nombre, ciudad, oposición, estado, fecha, bonus de registro activo). */
export async function getReferralDetails(
  referrerUserId: string, exec?: Executor,
): Promise<ReferralDetail[]> {
  const db = exec ?? getReadDb()
  const rows = await db.select({
    name: userProfiles.fullName,
    city: userProfiles.ciudad,
    oposicion: userProfiles.targetOposicion,
    status: referrals.status,
    date: referrals.attributedAt,
    // Columnas añadidas por migración 20260711 (aún no en el schema Drizzle) → SQL literal.
    activeRewardAmount: sql<string | null>`referrals.active_reward_amount`,
    // MISMA fuente de conteo que grantActiveSignupRewards (tabla `tests`, por referido) → coherencia.
    testsDone: sql<number>`(select count(*)::int from tests t where t.user_id = referrals.referred_user_id)`,
  })
    .from(referrals)
    .innerJoin(userProfiles, eq(referrals.referredUserId, userProfiles.id))
    .where(eq(referrals.referrerUserId, referrerUserId))
    .orderBy(desc(referrals.attributedAt))
    .limit(200)

  const enabled = activeSignupEnabled()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (rows as any[]).map((r) => {
    const activeReward = deriveActiveReward({
      grantedAmount: r.activeRewardAmount != null ? Number(r.activeRewardAmount) : null,
      testsDone: Number(r.testsDone) || 0,
      status: r.status,
      enabled,
    })
    // Privacidad: el embajador no ve el apellido completo del referido → "Nombre A. B.".
    return { name: abbreviateReferredName(r.name), city: r.city, oposicion: r.oposicion, status: r.status, date: r.date, activeReward }
  })
}

export interface PayableReferral {
  referralId: string
  referrerUserId: string
  referrerName: string | null
  referrerEmail: string | null
  referredName: string | null
  amount: string
  qualifiedAt: string | null
}

/** Referidos listos para pagar (status `payable`) con datos del embajador y del referido. */
export async function getPayableReferrals(exec?: Executor): Promise<PayableReferral[]> {
  const db = exec ?? getReadDb()
  const refUp = alias(userProfiles, 'ref_up')
  const rdUp = alias(userProfiles, 'rd_up')
  const rows = await db.select({
    referralId: referrals.id,
    referrerUserId: referrals.referrerUserId,
    referrerName: refUp.fullName,
    referrerEmail: refUp.email,
    referredName: rdUp.fullName,
    amount: referrals.bountyAmount,
    qualifiedAt: referrals.qualifiedAt,
  })
    .from(referrals)
    .innerJoin(refUp, eq(referrals.referrerUserId, refUp.id))
    .leftJoin(rdUp, eq(referrals.referredUserId, rdUp.id))
    .where(eq(referrals.status, 'payable'))
    .orderBy(referrals.qualifiedAt)
  return rows as PayableReferral[]
}

/**
 * Marca un referido `payable` como PAGADO: crea el reward_payout y pasa el referido a `paid`.
 * Atómico (tx) + optimista (solo si sigue `payable`). Devuelve el id del payout.
 */
export async function payReferral(
  params: { referralId: string; adminUserId: string; giftcardRef?: string; purchasedVia?: string },
  exec?: Executor,
): Promise<{ ok: true; payoutId: string } | { ok: false; reason: string }> {
  const run = async (tx: Executor) => {
    const [ref] = await tx.select({
      id: referrals.id, referrer: referrals.referrerUserId,
      amount: referrals.bountyAmount, status: referrals.status,
    }).from(referrals).where(eq(referrals.id, params.referralId)).limit(1)
    if (!ref) return { ok: false as const, reason: 'not_found' }
    if (ref.status !== 'payable') return { ok: false as const, reason: `not_payable(${ref.status})` }

    const [payout] = await tx.insert(rewardPayouts).values({
      beneficiaryUserId: ref.referrer,
      reason: 'referral',
      sourceId: ref.id,
      amount: ref.amount,
      method: 'amazon_giftcard',
      purchasedVia: params.purchasedVia ?? null,
      giftcardRef: params.giftcardRef ?? null,
      status: 'paid',
      approvedBy: params.adminUserId,
      paidAt: sql`now()`,
    }).returning({ id: rewardPayouts.id })

    await tx.update(referrals)
      .set({ status: 'paid', payoutId: payout.id, updatedAt: sql`now()` })
      .where(and(eq(referrals.id, ref.id), eq(referrals.status, 'payable')))
    return { ok: true as const, payoutId: payout.id }
  }
  if (exec) return run(exec)
  return getAdminDb().transaction(run)
}

// ============================================================================
// Recompensas por BUG / UGC (tabla reward_submissions)
// ============================================================================

/** Resuelve un email → userId (case-insensitive), o null. Para crear recompensas desde el admin. */
export async function findUserIdByEmail(email: string, exec?: Executor): Promise<string | null> {
  const db = exec ?? getReadDb()
  const [row] = await db.select({ id: userProfiles.id }).from(userProfiles)
    .where(sql`lower(${userProfiles.email}) = ${email.trim().toLowerCase()}`).limit(1)
  return (row?.id as string | undefined) ?? null
}

/** Nº de recompensas de este tipo que cuentan para el tope del mes en curso (no rechazadas). */
export async function countRewardSubmissionsThisMonth(
  userId: string, type: RewardType, exec?: Executor,
): Promise<number> {
  const db = exec ?? getReadDb()
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(rewardSubmissions)
    .where(and(
      eq(rewardSubmissions.userId, userId),
      eq(rewardSubmissions.type, type),
      sql`${rewardSubmissions.status} <> 'rejected'`,
      sql`${rewardSubmissions.createdAt} >= date_trunc('month', now())`,
    ))
  return Number(row?.n ?? 0)
}

/**
 * Crea una recompensa (bug 3€ / ugc 5€) para un usuario, ya APROBADA por el admin (que la validó en
 * el chat de soporte). Rechaza DUPLICADOS por motivo (bug=feedback_id, ugc=url; reason 'duplicate'),
 * aplica el tope mensual (ugc 3/mes) y el hold del UGC (post vivo N días).
 */
export async function createRewardSubmission(
  params: { userId: string; type: RewardType; url?: string; screenshotUrl?: string; feedbackId?: string },
  exec?: Executor,
): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const db = exec ?? getAdminDb()

  // Guardarraíl anti-duplicado por MOTIVO (control robusto): nunca 2 recompensas del mismo motivo.
  // bug → mismo feedback_id; ugc → misma url. Solo cuentan las no-rejected. El referido es idempotente
  // por su cuenta (fila `referrals`). Ver docs/runbooks/embajadores-recompensas.md §"Anti-duplicado".
  if (params.type === 'bug' && params.feedbackId) {
    const [dup] = await db.select({ id: rewardSubmissions.id }).from(rewardSubmissions)
      .where(and(
        eq(rewardSubmissions.type, 'bug'),
        eq(rewardSubmissions.feedbackId, params.feedbackId),
        sql`${rewardSubmissions.status} <> 'rejected'`,
      )).limit(1)
    if (dup) return { ok: false, reason: 'duplicate' }
  }
  if (params.type === 'ugc' && params.url) {
    const [dup] = await db.select({ id: rewardSubmissions.id }).from(rewardSubmissions)
      .where(and(
        eq(rewardSubmissions.type, 'ugc'),
        eq(rewardSubmissions.url, params.url),
        sql`${rewardSubmissions.status} <> 'rejected'`,
      )).limit(1)
    if (dup) return { ok: false, reason: 'duplicate' }
  }

  const count = await countRewardSubmissionsThisMonth(params.userId, params.type, db)
  if (!withinRewardMonthlyCap(params.type, count)) return { ok: false, reason: 'monthly_cap' }

  const amount = String(rewardAmount(params.type))
  // Sin hold en bug/ugc: el hold (ventana de reembolso + clawback) SOLO tiene sentido en una VENTA
  // (referido). En bug/ugc no hay venta ni reembolso posible → el saldo es elegible al crearse. El
  // post de UGC se verifica igualmente al pagar el vale (decisión Manuel 11/07).
  const holdUntil = null

  const [row] = await db.insert(rewardSubmissions).values({
    userId: params.userId,
    type: params.type,
    status: 'approved',
    url: params.url ?? null,
    screenshotUrl: params.screenshotUrl ?? null,
    feedbackId: params.feedbackId ?? null,
    amount,
    holdUntil,
  }).returning({ id: rewardSubmissions.id })
  return { ok: true, id: row.id }
}

export interface PendingReward {
  id: string
  type: string
  amount: string
  url: string | null
  holdUntil: string | null
  userId: string
  userName: string | null
  userEmail: string | null
  createdAt: string
}

/** Recompensas `approved` (bug/ugc) con datos del usuario, para el panel admin. */
export async function getPendingRewardSubmissions(exec?: Executor): Promise<PendingReward[]> {
  const db = exec ?? getReadDb()
  const rows = await db.select({
    id: rewardSubmissions.id,
    type: rewardSubmissions.type,
    amount: rewardSubmissions.amount,
    url: rewardSubmissions.url,
    holdUntil: rewardSubmissions.holdUntil,
    userId: rewardSubmissions.userId,
    userName: userProfiles.fullName,
    userEmail: userProfiles.email,
    createdAt: rewardSubmissions.createdAt,
  }).from(rewardSubmissions)
    .innerJoin(userProfiles, eq(rewardSubmissions.userId, userProfiles.id))
    .where(eq(rewardSubmissions.status, 'approved'))
    .orderBy(rewardSubmissions.createdAt)
  return rows as PendingReward[]
}

/**
 * Marca una recompensa `approved` como PAGADA: crea el reward_payout (reason bug/ugc) y la pasa a `paid`.
 * Atómico + optimista. Rechaza si sigue en hold (UGC no vencido).
 */
export async function payRewardSubmission(
  params: { submissionId: string; adminUserId: string; giftcardRef?: string; purchasedVia?: string },
  exec?: Executor,
): Promise<{ ok: true; payoutId: string } | { ok: false; reason: string }> {
  const run = async (tx: Executor) => {
    const [s] = await tx.select().from(rewardSubmissions)
      .where(eq(rewardSubmissions.id, params.submissionId)).limit(1)
    if (!s) return { ok: false as const, reason: 'not_found' }
    if (s.status !== 'approved') return { ok: false as const, reason: `not_approved(${s.status})` }
    if (s.holdUntil && new Date(s.holdUntil).getTime() > Date.now()) return { ok: false as const, reason: 'in_hold' }

    const [payout] = await tx.insert(rewardPayouts).values({
      beneficiaryUserId: s.userId,
      reason: s.type,
      sourceId: s.id,
      amount: s.amount,
      method: 'amazon_giftcard',
      purchasedVia: params.purchasedVia ?? null,
      giftcardRef: params.giftcardRef ?? null,
      status: 'paid',
      approvedBy: params.adminUserId,
      paidAt: sql`now()`,
    }).returning({ id: rewardPayouts.id })

    await tx.update(rewardSubmissions)
      .set({ status: 'paid', payoutId: payout.id, updatedAt: sql`now()` })
      .where(and(eq(rewardSubmissions.id, s.id), eq(rewardSubmissions.status, 'approved')))
    return { ok: true as const, payoutId: payout.id }
  }
  if (exec) return run(exec)
  return getAdminDb().transaction(run)
}

/** Top del embudo por embajador: nº de copias del enlace y de clicks (desde observable_events). */
export async function getReferralFunnelCounts(
  ownerUserId: string, exec?: Executor,
): Promise<{ copies: number; clicks: number }> {
  const db = exec ?? getReadDb()
  const res = await db.execute(sql`
    select event_type, count(*)::int as n
    from observable_events
    where user_id = ${ownerUserId}
      and event_type in ('referral_link_click', 'referral_link_copy')
    group by event_type`)
  // db.execute devuelve array (postgres-js) o { rows } (node-postgres): soportar ambos.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = Array.isArray(res) ? res : ((res as any)?.rows ?? [])
  let copies = 0
  let clicks = 0
  for (const r of rows) {
    if (r.event_type === 'referral_link_copy') copies = Number(r.n)
    else if (r.event_type === 'referral_link_click') clicks = Number(r.n)
  }
  return { copies, clicks }
}

// ============================================================================
// Pago ACUMULADO — saldo por usuario (referido + bug + ugc) pagado en denominaciones fijas
// ============================================================================

/** Saldo pendiente del usuario (€): ganado listo (referidos payable + recompensas approved tras hold) − pagado. */
export async function getUserOwedBalance(userId: string, exec?: Executor): Promise<number> {
  const db = exec ?? getReadDb()
  const res = await db.execute(sql`
    select (
      coalesce((select sum(bounty_amount) from referrals where referrer_user_id = ${userId} and status = 'payable'), 0)
      -- bono de registro activo (2€): pagable SOLO cuando el referido sobrevivió su hold sin
      -- reembolsar (status payable/paid). Sin esto el bono se GANA (vista reward_earnings) pero
      -- ninguna query lo hacía pagable → quedaba atascado en "en proceso" para siempre (bug 11/07).
      + coalesce((select sum(active_reward_amount) from referrals where referrer_user_id = ${userId} and active_reward_at is not null and status in ('payable','paid')), 0)
      + coalesce((select sum(amount) from reward_submissions where user_id = ${userId} and status = 'approved' and (hold_until is null or hold_until <= now())), 0)
      -- resta pagos Y solicitudes en curso (status <> 'void'): una solicitud 'pending' RESERVA el
      -- saldo (para que no se pida dos veces). 'void' = solicitud rechazada → no reserva. Modelo pull.
      - coalesce((select sum(amount) from reward_payouts where beneficiary_user_id = ${userId} and status <> 'void'), 0)
    )::float as balance`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = Array.isArray(res) ? res : ((res as any)?.rows ?? [])
  return Number(rows[0]?.balance ?? 0)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowsOf(res: any): any[] { return Array.isArray(res) ? res : (res?.rows ?? []) }

export interface EarningsBySource { source: string; earned: number; count: number }
export interface EmbajadorEarnings {
  balance: number         // disponible para SOLICITAR (payable/approved-tras-hold − pagado − solicitado)
  earnedLifetime: number  // total ganado (todas las fuentes)
  paidLifetime: number    // total cobrado (vales emitidos, status='paid')
  requested: number       // solicitado en curso (status='pending'): reservado, esperando que emitamos el vale
  pending: number         // en proceso (en hold): ganado − pagado − solicitado − disponible
  bySource: EarningsBySource[]
}

/** Panel del embajador: saldo + total ganado/cobrado/solicitado + desglose por FUENTE (escalable vía reward_earnings). */
export async function getEmbajadorEarnings(userId: string, exec?: Executor): Promise<EmbajadorEarnings> {
  const db = exec ?? getReadDb()
  const [earnedRes, paidRes, requestedRes, bySourceRes, balance] = await Promise.all([
    db.execute(sql`select coalesce(sum(amount),0)::float as t from reward_earnings where user_id = ${userId}`),
    // vales EMITIDOS = solo status='paid' (una solicitud 'pending' aún NO es un vale emitido)
    db.execute(sql`select coalesce(sum(amount),0)::float as t from reward_payouts where beneficiary_user_id = ${userId} and status = 'paid'`),
    // SOLICITADO en curso = status='pending' (reservado, esperando que emitamos el vale)
    db.execute(sql`select coalesce(sum(amount),0)::float as t from reward_payouts where beneficiary_user_id = ${userId} and status = 'pending'`),
    db.execute(sql`select source, sum(amount)::float as earned, count(*)::int as count from reward_earnings where user_id = ${userId} group by source order by earned desc`),
    getUserOwedBalance(userId, db),
  ])
  const earnedLifetime = Number(rowsOf(earnedRes)[0]?.t ?? 0)
  const paidLifetime = Number(rowsOf(paidRes)[0]?.t ?? 0)
  const requested = Number(rowsOf(requestedRes)[0]?.t ?? 0)
  const bySource = rowsOf(bySourceRes).map((r) => ({ source: r.source, earned: Number(r.earned), count: Number(r.count) }))
  // en proceso (hold) = ganado − emitido − solicitado − disponible. balance ya resta emitido+solicitado.
  const pending = Math.max(0, earnedLifetime - paidLifetime - requested - (balance as number))
  return { balance: balance as number, earnedLifetime, paidLifetime, requested, pending, bySource }
}

/** Nº de ingresos nuevos SIN VER por el embajador (cualquier fuente) — para el badge de novedades. */
export async function getUnseenEarningsCount(userId: string, exec?: Executor): Promise<number> {
  const db = exec ?? getReadDb()
  // "Sin ver" = ingresos nuevos (reward_earnings) O vales nuevos (reward_payouts) desde la última vez
  // que pinchó el 🎁 (referral_earnings_seen_at). Así un VALE emitido también hace parpadear el badge.
  const res = await db.execute(sql`
    with seen as (select coalesce(referral_earnings_seen_at, 'epoch'::timestamptz) ts from user_profiles where id = ${userId})
    select (
      (select count(*) from reward_earnings where user_id = ${userId} and earned_at is not null and earned_at > (select ts from seen))
      +
      (select count(*) from reward_payouts where beneficiary_user_id = ${userId} and status = 'paid' and giftcard_ref is not null
         and coalesce(purchased_via,'') <> 'bitrefill_dryrun' and paid_at > (select ts from seen))
    )::int as n`)
  return Number(rowsOf(res)[0]?.n ?? 0)
}

/** Marca las ganancias como vistas (apaga el badge). Preferencia de cuenta. */
export async function markEarningsSeen(userId: string, exec?: Executor): Promise<void> {
  const db = exec ?? getAdminDb()
  await db.execute(sql`update user_profiles set referral_earnings_seen_at = now() where id = ${userId}`)
}

export interface RecentEarning { source: string; amount: number; date: string }
/** Ingresos recientes (cualquier fuente) para el bloque celebratorio de novedades. */
export async function getRecentEarnings(userId: string, limit = 10, exec?: Executor): Promise<RecentEarning[]> {
  const db = exec ?? getReadDb()
  const res = await db.execute(sql`
    select source, amount::float as amount, earned_at as date from reward_earnings
    where user_id = ${userId} and earned_at is not null
    order by earned_at desc limit ${limit}`)
  return rowsOf(res).map((r) => ({ source: r.source, amount: Number(r.amount), date: String(r.date) }))
}

export interface AdminTopEmbajador { userId: string; name: string | null; email: string | null; earned: number; count: number }
export interface AdminReferralStats {
  totalEarned: number   // ganado por TODOS los embajadores (todas las fuentes)
  totalPaid: number     // pagado en gift cards
  outstanding: number   // lo que debemos (ganado − pagado)
  earners: number       // usuarios con ≥1 ingreso
  bySource: EarningsBySource[]                 // desglose global por fuente
  referralStatus: Record<string, number>       // pending/qualified/payable/paid/rejected/expired
  funnel: { views: number; copies: number; clicks: number; signups: number; buyers: number }
  topEmbajadores: AdminTopEmbajador[]
}

/** Escaparate de estadísticas del programa (read-only, para el panel admin). Todo desde reward_earnings + observable_events. */
export async function getReferralAdminStats(exec?: Executor): Promise<AdminReferralStats> {
  const db = exec ?? getReadDb()
  const [earnedRes, paidRes, bySrcRes, earnersRes, statusRes, funnelRes, topRes] = await Promise.all([
    db.execute(sql`select coalesce(sum(amount),0)::float as t from reward_earnings`),
    db.execute(sql`select coalesce(sum(amount),0)::float as t from reward_payouts where status = 'paid'`),
    db.execute(sql`select source, sum(amount)::float as earned, count(*)::int as count from reward_earnings group by source order by earned desc`),
    db.execute(sql`select count(distinct user_id)::int as n from reward_earnings`),
    db.execute(sql`select status, count(*)::int as n from referrals group by status`),
    db.execute(sql`select event_type, count(*)::int as n from observable_events
      where event_type in ('referral_page_view','referral_link_copy','referral_link_click','referral_attributed','referral_qualified')
      group by event_type`),
    db.execute(sql`
      select e.user_id, up.full_name as name, up.email as email, sum(e.amount)::float as earned, count(*)::int as count
      from reward_earnings e left join user_profiles up on up.id = e.user_id
      group by e.user_id, up.full_name, up.email order by earned desc limit 10`),
  ])
  const bySource = rowsOf(bySrcRes).map((r) => ({ source: r.source, earned: Number(r.earned), count: Number(r.count) }))
  const referralStatus: Record<string, number> = {}
  for (const r of rowsOf(statusRes)) referralStatus[r.status] = Number(r.n)
  const fmap: Record<string, number> = {}
  for (const r of rowsOf(funnelRes)) fmap[r.event_type] = Number(r.n)
  const totalEarned = Number(rowsOf(earnedRes)[0]?.t ?? 0)
  const totalPaid = Number(rowsOf(paidRes)[0]?.t ?? 0)
  return {
    totalEarned, totalPaid, outstanding: Math.max(0, totalEarned - totalPaid),
    earners: Number(rowsOf(earnersRes)[0]?.n ?? 0),
    bySource, referralStatus,
    funnel: {
      views: fmap['referral_page_view'] ?? 0,
      copies: fmap['referral_link_copy'] ?? 0,
      clicks: fmap['referral_link_click'] ?? 0,
      signups: fmap['referral_attributed'] ?? 0,
      buyers: fmap['referral_qualified'] ?? 0,
    },
    topEmbajadores: rowsOf(topRes).map((r) => ({ userId: r.user_id, name: r.name, email: r.email, earned: Number(r.earned), count: Number(r.count) })),
  }
}

export interface AccumBalance {
  userId: string
  name: string | null
  email: string | null
  balance: number
}

/** Embajadores con saldo acumulado >= mínimo pagable, listos para cobrar en gift card. */
export async function getEmbajadoresWithBalance(exec?: Executor): Promise<AccumBalance[]> {
  const db = exec ?? getReadDb()
  const res = await db.execute(sql`
    with earned as (
      select referrer_user_id as uid, sum(bounty_amount) as amt from referrals where status='payable' group by referrer_user_id
      union all
      -- bono de registro activo: pagable solo tras superar el hold del referido (payable/paid).
      -- Debe ser SIMÉTRICO con getUserOwedBalance (si no, un saldo aparecería pagable en un sitio
      -- y no en el otro). Ver bug 11/07 (bono atascado en "en proceso").
      select referrer_user_id as uid, sum(active_reward_amount) as amt from referrals where active_reward_at is not null and status in ('payable','paid') group by referrer_user_id
      union all
      select user_id as uid, sum(amount) as amt from reward_submissions where status='approved' and (hold_until is null or hold_until <= now()) group by user_id
    ),
    e2 as (select uid, sum(amt) as earned from earned group by uid),
    paid as (select beneficiary_user_id as uid, sum(amount) as amt from reward_payouts where status <> 'void' group by beneficiary_user_id)
    select e2.uid as user_id, up.full_name as name, up.email as email,
           (e2.earned - coalesce(p.amt, 0))::float as balance
    from e2
    join user_profiles up on up.id = e2.uid
    left join paid p on p.uid = e2.uid
    where (e2.earned - coalesce(p.amt, 0)) >= ${MIN_PAYOUT_EUR}
    order by balance desc`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = Array.isArray(res) ? res : ((res as any)?.rows ?? [])
  return rows.map((r) => ({ userId: r.user_id, name: r.name, email: r.email, balance: Number(r.balance) }))
}

/**
 * Paga una gift card de denominación fija contra el saldo acumulado del usuario. Atómico + valida
 * (denominación válida + no supera el saldo). Crea un reward_payout reason='accumulated'.
 */
export async function payAccumulated(
  params: { userId: string; adminUserId: string; amount: number; giftcardRef?: string; purchasedVia?: string },
  exec?: Executor,
): Promise<{ ok: true; payoutId: string } | { ok: false; reason: string }> {
  const run = async (tx: Executor) => {
    if (!isValidDenomination(params.amount)) return { ok: false as const, reason: 'invalid_denomination' }
    const balance = await getUserOwedBalance(params.userId, tx)
    if (params.amount > balance) return { ok: false as const, reason: `amount_exceeds_balance(${balance})` }

    const [payout] = await tx.insert(rewardPayouts).values({
      beneficiaryUserId: params.userId,
      reason: 'accumulated',
      amount: String(params.amount),
      method: 'amazon_giftcard',
      purchasedVia: params.purchasedVia ?? null,
      giftcardRef: params.giftcardRef ?? null,
      status: 'paid',
      approvedBy: params.adminUserId,
      paidAt: sql`now()`,
    }).returning({ id: rewardPayouts.id })
    return { ok: true as const, payoutId: payout.id }
  }
  if (exec) return run(exec)
  return getAdminDb().transaction(run)
}

// ============================================================================
// Solicitud de vale (modelo PULL): el usuario pide cobrar; el admin lo cumple.
// ============================================================================

/**
 * SOLICITUD de vale: el USUARIO pide cobrar su saldo disponible. Crea un payout 'pending' que
 * RESERVA el saldo (getUserOwedBalance resta status<>'void'). Atómico: valida denominación válida,
 * saldo suficiente y que NO haya otra solicitud en curso (una sola por usuario). El admin la cumple
 * luego (pending → paid). Nunca toca dinero retenido: getUserOwedBalance solo cuenta lo disponible.
 */
export async function createPayoutRequest(
  params: { userId: string; amount: number },
  exec?: Executor,
): Promise<{ ok: true; requestId: string } | { ok: false; reason: string }> {
  const run = async (tx: Executor) => {
    if (!isValidDenomination(params.amount)) return { ok: false as const, reason: 'invalid_denomination' }
    const existing = rowsOf(await tx.execute(sql`
      select 1 from reward_payouts where beneficiary_user_id = ${params.userId} and status = 'pending' limit 1`))
    if (existing.length > 0) return { ok: false as const, reason: 'already_pending' }
    const balance = await getUserOwedBalance(params.userId, tx)
    if (params.amount > balance) return { ok: false as const, reason: `amount_exceeds_balance(${balance})` }
    const [req] = await tx.insert(rewardPayouts).values({
      beneficiaryUserId: params.userId,
      reason: 'accumulated',
      amount: String(params.amount),
      method: 'amazon_giftcard',
      status: 'pending',
    }).returning({ id: rewardPayouts.id })
    return { ok: true as const, requestId: req.id }
  }
  if (exec) return run(exec)
  return getAdminDb().transaction(run)
}

export interface PayoutRequest {
  id: string
  userId: string
  name: string | null
  email: string | null
  amount: number
  createdAt: string
}

/** Solicitudes de vale PENDIENTES (para el admin y el badge "toca pagar"). Más antiguas primero. */
export async function getPendingPayoutRequests(exec?: Executor): Promise<PayoutRequest[]> {
  const db = exec ?? getReadDb()
  const res = await db.execute(sql`
    select p.id, p.beneficiary_user_id as user_id, up.full_name as name, up.email as email,
           p.amount::float as amount, p.created_at as created_at
    from reward_payouts p join user_profiles up on up.id = p.beneficiary_user_id
    where p.status = 'pending' order by p.created_at asc`)
  return rowsOf(res).map((r) => ({
    id: r.id, userId: r.user_id, name: r.name, email: r.email,
    amount: Number(r.amount), createdAt: String(r.created_at),
  }))
}

/** El admin CUMPLE una solicitud: pending → paid (emite el vale). Atómico, valida que siga 'pending'. */
export async function fulfillPayoutRequest(
  params: { requestId: string; adminUserId: string; giftcardRef?: string; purchasedVia?: string },
  exec?: Executor,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const run = async (tx: Executor) => {
    const res = rowsOf(await tx.execute(sql`
      update reward_payouts set status = 'paid', paid_at = now(), approved_by = ${params.adminUserId},
        giftcard_ref = ${params.giftcardRef ?? null}, purchased_via = ${params.purchasedVia ?? null}
      where id = ${params.requestId} and status = 'pending'
      returning id`))
    if (res.length === 0) return { ok: false as const, reason: 'not_pending_or_not_found' }
    return { ok: true as const }
  }
  if (exec) return run(exec)
  return getAdminDb().transaction(run)
}

/** Métrica núcleo: registros vs compradores + conversión, por embajador. */
export async function getReferralStats(
  referrerUserId: string, exec?: Executor,
): Promise<{ registros: number; compradores: number; conversion: number }> {
  const db = exec ?? getReadDb()
  const rows = await db.select({ status: referrals.status })
    .from(referrals).where(eq(referrals.referrerUserId, referrerUserId))
  const registros = rows.length
  const compradores = rows.filter((r: { status: string }) =>
    ['qualified', 'payable', 'paid'].includes(r.status)).length
  return { registros, compradores, conversion: registros ? compradores / registros : 0 }
}
