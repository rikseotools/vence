/**
 * @jest-environment node
 */
// __tests__/integration/referrals-queries.test.ts  (en __tests__/integration/ para el job CI de integración)
// CAPA 2 (integración) del programa de referidos — queries reales contra RDS vivo, dentro de una
// transacción con ROLLBACK (NO persiste nada; respeta la convención "integración readonly").
// Ver memoria feedback_feature_multiples_capas_seguridad + docs/roadmap/programa-referidos-embajadores.md.

import { eq } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { referrals } from '@/db/referralSchema'
import { userProfiles } from '@/db/schema'
import {
  getOrCreateReferralCode,
  attributeReferral,
  qualifyReferralOnPayment,
  promoteEligibleToPayable,
  getReferralStats,
  getReferralDetails,
} from '@/lib/referrals/queries'

const DAY = 86_400_000
const ROLLBACK = new Error('__ROLLBACK_SENTINEL__')

// Ejecuta fn dentro de una tx que SIEMPRE hace rollback. Inyecta 3 user_profiles reales.
async function withTx(fn: (tx: any, users: string[]) => Promise<void>): Promise<void> {
  const db = getAdminDb()
  const users = (await db.select({ id: userProfiles.id }).from(userProfiles).limit(3)).map((r: any) => r.id)
  if (users.length < 3) throw new Error('se necesitan 3 user_profiles reales para el test')
  try {
    await db.transaction(async (tx: any) => {
      await fn(tx, users)
      throw ROLLBACK
    })
  } catch (e) {
    if (e !== ROLLBACK) throw e
  }
}

describe('referrals queries — integración RDS (tx rollback)', () => {
  it('getOrCreateReferralCode es idempotente por owner', async () => {
    await withTx(async (tx, [u1]) => {
      const c1 = await getOrCreateReferralCode(u1, tx)
      const c2 = await getOrCreateReferralCode(u1, tx)
      expect(c1).toMatch(/^[0-9a-f]{12}$/)
      expect(c2).toBe(c1)
    })
  })

  it('atribución happy-path + first-touch (no duplica)', async () => {
    await withTx(async (tx, [u1, u2]) => {
      const code = await getOrCreateReferralCode(u1, tx)
      const a = await attributeReferral({ code, referredUserId: u2, referrerIsActivePremium: true, referredHasEverPaid: false }, tx)
      expect(a).toMatchObject({ ok: true, referrerUserId: u1 })
      const b = await attributeReferral({ code, referredUserId: u2, referrerIsActivePremium: true, referredHasEverPaid: false }, tx)
      expect(b).toMatchObject({ ok: true, alreadyAttributed: true })
      if (a.ok && b.ok) expect(b.referralId).toBe(a.referralId) // misma fila (first-touch)
    })
  })

  it('rechazos de elegibilidad: código inválido, auto-referido, ya pagó', async () => {
    await withTx(async (tx, [u1, u2]) => {
      const code = await getOrCreateReferralCode(u1, tx)
      expect(await attributeReferral({ code: 'nope', referredUserId: u2, referrerIsActivePremium: true, referredHasEverPaid: false }, tx))
        .toMatchObject({ ok: false, reason: 'code_invalid' })
      expect(await attributeReferral({ code, referredUserId: u1, referrerIsActivePremium: true, referredHasEverPaid: false }, tx))
        .toMatchObject({ ok: false, reason: 'self_referral' })
      expect(await attributeReferral({ code, referredUserId: u2, referrerIsActivePremium: true, referredHasEverPaid: true }, tx))
        .toMatchObject({ ok: false, reason: 'referred_not_new_payer' })
    })
  })

  it('qualify dentro de ventana → qualified + hold', async () => {
    await withTx(async (tx, [u1, u2]) => {
      const code = await getOrCreateReferralCode(u1, tx)
      await attributeReferral({ code, referredUserId: u2, referrerIsActivePremium: true, referredHasEverPaid: false }, tx)
      const [row] = await tx.select().from(referrals).where(eq(referrals.referredUserId, u2)).limit(1)
      const paidAt = new Date(new Date(row.attributedAt).getTime() + 2 * DAY).toISOString()
      const q = await qualifyReferralOnPayment({ referredUserId: u2, planType: 'monthly', paymentRef: 'pi_test', paidAt }, tx)
      expect(q.qualified).toBe(true)
      const [after] = await tx.select().from(referrals).where(eq(referrals.referredUserId, u2)).limit(1)
      expect(after.status).toBe('qualified')
      expect(after.holdUntil).toBeTruthy()
      expect(after.qualifyingPaymentRef).toBe('pi_test')
    })
  })

  it('qualify fuera de ventana (11 días) → expired', async () => {
    await withTx(async (tx, [u1, u2]) => {
      const code = await getOrCreateReferralCode(u1, tx)
      await attributeReferral({ code, referredUserId: u2, referrerIsActivePremium: true, referredHasEverPaid: false }, tx)
      const [row] = await tx.select().from(referrals).where(eq(referrals.referredUserId, u2)).limit(1)
      const paidAt = new Date(new Date(row.attributedAt).getTime() + 11 * DAY).toISOString()
      const q = await qualifyReferralOnPayment({ referredUserId: u2, planType: 'monthly', paymentRef: 'pi_x', paidAt }, tx)
      expect(q).toMatchObject({ qualified: false, reason: 'outside_window' })
      const [after] = await tx.select().from(referrals).where(eq(referrals.referredUserId, u2)).limit(1)
      expect(after.status).toBe('expired')
    })
  })

  it('promoción qualified→payable solo cuando vence el hold', async () => {
    await withTx(async (tx, [u1, u2]) => {
      const code = await getOrCreateReferralCode(u1, tx)
      await attributeReferral({ code, referredUserId: u2, referrerIsActivePremium: true, referredHasEverPaid: false }, tx)
      const [row] = await tx.select().from(referrals).where(eq(referrals.referredUserId, u2)).limit(1)
      const paidAt = new Date(new Date(row.attributedAt).getTime() + 1 * DAY).toISOString()
      await qualifyReferralOnPayment({ referredUserId: u2, planType: 'annual', paymentRef: 'pi_h', paidAt }, tx)
      const [q] = await tx.select().from(referrals).where(eq(referrals.referredUserId, u2)).limit(1)
      const hold = new Date(q.holdUntil).getTime()
      // antes del hold: no promueve
      expect(await promoteEligibleToPayable(new Date(hold - 1000).toISOString(), tx)).toBe(0)
      // en/after del hold: promueve
      expect(await promoteEligibleToPayable(new Date(hold).toISOString(), tx)).toBe(1)
      const [after] = await tx.select().from(referrals).where(eq(referrals.referredUserId, u2)).limit(1)
      expect(after.status).toBe('payable')
    })
  })

  it('métrica registros vs compradores por embajador', async () => {
    await withTx(async (tx, [u1, u2]) => {
      const code = await getOrCreateReferralCode(u1, tx)
      await attributeReferral({ code, referredUserId: u2, referrerIsActivePremium: true, referredHasEverPaid: false }, tx)
      let stats = await getReferralStats(u1, tx)
      expect(stats).toMatchObject({ registros: 1, compradores: 0 })
      const [row] = await tx.select().from(referrals).where(eq(referrals.referredUserId, u2)).limit(1)
      const paidAt = new Date(new Date(row.attributedAt).getTime() + 1 * DAY).toISOString()
      await qualifyReferralOnPayment({ referredUserId: u2, planType: 'monthly', paymentRef: 'pi_m', paidAt }, tx)
      stats = await getReferralStats(u1, tx)
      expect(stats).toMatchObject({ registros: 1, compradores: 1, conversion: 1 })
    })
  })

  it('detalle de referidos (join user_profiles: nombre/ciudad/oposición/estado)', async () => {
    await withTx(async (tx, [u1, u2]) => {
      const code = await getOrCreateReferralCode(u1, tx)
      await attributeReferral({ code, referredUserId: u2, referrerIsActivePremium: true, referredHasEverPaid: false }, tx)
      const details = await getReferralDetails(u1, tx)
      expect(details).toHaveLength(1)
      // el referido u2 existe (join innerJoin funciona); status inicial pending; campos presentes.
      expect(details[0]).toEqual(expect.objectContaining({ status: 'pending' }))
      expect(details[0]).toHaveProperty('name')
      expect(details[0]).toHaveProperty('city')
      expect(details[0]).toHaveProperty('oposicion')
    })
  })
})
