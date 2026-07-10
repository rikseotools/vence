// lib/referrals/queries.ts
// Queries del Programa de Referidos (Fase 1). Escrituras → getAdminDb, lecturas → getReadDb.
// Cada función acepta un `exec` opcional (db o tx de Drizzle) para poder testear dentro de una
// transacción con ROLLBACK (integración contra RDS real sin persistir). Diseño: Anexo A del roadmap.

import { and, eq, lte, sql } from 'drizzle-orm'
import { getAdminDb, getReadDb } from '@/db/client'
import { referralCodes, referrals } from '@/db/referralSchema'
import {
  generateReferralCode,
  refereeEligibility,
  computeHoldUntil,
  isWithinAttributionWindow,
  type EligibilityReason,
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

/** Promueve `qualified` → `payable` cuando el hold ya venció (para el cron). Devuelve nº promovidos. */
export async function promoteEligibleToPayable(nowIso: string, exec?: Executor): Promise<number> {
  const db = exec ?? getAdminDb()
  const res = await db.update(referrals)
    .set({ status: 'payable', updatedAt: sql`now()` })
    .where(and(eq(referrals.status, 'qualified'), lte(referrals.holdUntil, nowIso)))
    .returning({ id: referrals.id })
  return res.length
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
