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
  refereeEligibility,
  computeHoldUntil,
  isWithinAttributionWindow,
  rewardAmount,
  withinRewardMonthlyCap,
  UGC_HOLD_DAYS,
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
): Promise<{ qualified: boolean; reason?: 'no_pending_referral' | 'outside_window' }> {
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
  return { qualified: true }
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

export interface ReferralDetail {
  name: string | null
  city: string | null
  oposicion: string | null
  status: string
  date: string
}

/** Detalle por referido (nombre, ciudad, oposición, estado, fecha) para el panel del embajador. */
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
  })
    .from(referrals)
    .innerJoin(userProfiles, eq(referrals.referredUserId, userProfiles.id))
    .where(eq(referrals.referrerUserId, referrerUserId))
    .orderBy(desc(referrals.attributedAt))
    .limit(200)
  return rows as ReferralDetail[]
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
 * el chat de soporte). Aplica el tope mensual (ugc 3/mes) y el hold del UGC (post vivo N días).
 */
export async function createRewardSubmission(
  params: { userId: string; type: RewardType; url?: string; screenshotUrl?: string; feedbackId?: string },
  exec?: Executor,
): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const db = exec ?? getAdminDb()
  const count = await countRewardSubmissionsThisMonth(params.userId, params.type, db)
  if (!withinRewardMonthlyCap(params.type, count)) return { ok: false, reason: 'monthly_cap' }

  const amount = String(rewardAmount(params.type))
  const holdUntil = params.type === 'ugc'
    ? computeHoldUntil(new Date().toISOString(), UGC_HOLD_DAYS).toISOString()
    : null

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
