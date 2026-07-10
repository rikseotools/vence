/**
 * @jest-environment node
 */
// __tests__/integration/referrals-simulation.test.ts
// CAPA 3 (simulación E2E) — memoria feedback_feature_multiples_capas_seguridad.
// Simula el CIRCUITO COMPLETO del referido contra RDS (tx rollback), encadenando los pasos reales:
//   atribución → cupón aplicable → calificación por pago → hold → payable, y la rama de clawback.
// A diferencia de la integración por-función, aquí importa que la SECUENCIA entera encaje.

import { eq, sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { referrals, rewardPayouts, rewardSubmissions } from '@/db/referralSchema'
import { userProfiles } from '@/db/schema'
import {
  getOrCreateReferralCode,
  getReferralCode,
  attributeReferral,
  hasPendingReferral,
  qualifyReferralOnPayment,
  promoteEligibleToPayable,
  rejectReferralOnRefund,
  getReferralStats,
  getPayableReferrals,
  payReferral,
  createRewardSubmission,
  getPendingRewardSubmissions,
  payRewardSubmission,
  getUserOwedBalance,
  getEmbajadoresWithBalance,
  payAccumulated,
  getEmbajadorEarnings,
  getUnseenEarningsCount,
  getReferralAdminStats,
} from '@/lib/referrals/queries'

const DAY = 86_400_000
const ROLLBACK = new Error('__ROLLBACK_SENTINEL__')

async function withTx(fn: (tx: any, users: string[]) => Promise<void>): Promise<void> {
  const db = getAdminDb()
  const users = (await db.select({ id: userProfiles.id }).from(userProfiles).limit(3)).map((r: any) => r.id)
  if (users.length < 3) throw new Error('se necesitan 3 user_profiles reales')
  try {
    await db.transaction(async (tx: any) => { await fn(tx, users); throw ROLLBACK })
  } catch (e) { if (e !== ROLLBACK) throw e }
}

describe('SIMULACIÓN E2E — circuito de referido (RDS, tx rollback)', () => {
  it('camino feliz: atribuir → cupón aplicable → pagar → calificar → hold → payable', async () => {
    await withTx(async (tx, [embajador, referido]) => {
      // 1) el embajador (premium) genera su código
      const code = await getOrCreateReferralCode(embajador, tx)

      // 2) el referido (nuevo, nunca pagó) es atribuido
      const attr = await attributeReferral(
        { code, referredUserId: referido, referrerIsActivePremium: true, referredHasEverPaid: false }, tx)
      expect(attr.ok).toBe(true)

      // 3) al ir al checkout, el cupón 5 € SÍ aplica (hay referido pending)
      expect(await hasPendingReferral(referido, tx)).toBe(true)
      // ...y las stats del embajador: 1 registro, 0 compradores todavía
      expect(await getReferralStats(embajador, tx)).toMatchObject({ registros: 1, compradores: 0 })

      // 4) el referido paga dentro de la ventana → calificado
      const [row] = await tx.select().from(referrals).where(eq(referrals.referredUserId, referido)).limit(1)
      const paidAt = new Date(new Date(row.attributedAt).getTime() + 3 * DAY).toISOString()
      expect((await qualifyReferralOnPayment(
        { referredUserId: referido, planType: 'monthly', paymentRef: 'sub_x', paidAt }, tx)).qualified).toBe(true)

      // 5) ya no está pending (el cupón no volvería a aplicar) y cuenta como comprador
      expect(await hasPendingReferral(referido, tx)).toBe(false)
      expect(await getReferralStats(embajador, tx)).toMatchObject({ registros: 1, compradores: 1 })

      // 6) pasa el hold → el cron lo promueve a payable (listo para payout)
      const [q] = await tx.select().from(referrals).where(eq(referrals.referredUserId, referido)).limit(1)
      expect(await promoteEligibleToPayable(new Date(new Date(q.holdUntil).getTime()).toISOString(), tx)).toBe(1)
      const [fin] = await tx.select().from(referrals).where(eq(referrals.referredUserId, referido)).limit(1)
      expect(fin.status).toBe('payable')
    })
  })

  it('clawback: pagar → calificar → REEMBOLSO dentro del hold → rechazado (no se paga)', async () => {
    await withTx(async (tx, [embajador, referido]) => {
      const code = await getOrCreateReferralCode(embajador, tx)
      await attributeReferral(
        { code, referredUserId: referido, referrerIsActivePremium: true, referredHasEverPaid: false }, tx)
      const [row] = await tx.select().from(referrals).where(eq(referrals.referredUserId, referido)).limit(1)
      const paidAt = new Date(new Date(row.attributedAt).getTime() + 1 * DAY).toISOString()
      await qualifyReferralOnPayment({ referredUserId: referido, planType: 'annual', paymentRef: 'sub_y', paidAt }, tx)

      // reembolso → clawback
      const claw = await rejectReferralOnRefund(referido, tx)
      expect(claw).toMatchObject({ rejected: 1, alreadyPaid: false })
      const [after] = await tx.select().from(referrals).where(eq(referrals.referredUserId, referido)).limit(1)
      expect(after.status).toBe('rejected')

      // el cron ya NO lo promueve (no está qualified) y no cuenta como comprador
      expect(await promoteEligibleToPayable(new Date(Date.now() + 30 * DAY).toISOString(), tx)).toBe(0)
      expect(await getReferralStats(embajador, tx)).toMatchObject({ compradores: 0 })
    })
  })

  it('payout admin: payable → payReferral → paid + reward_payout (10 €), doble pago rechazado', async () => {
    await withTx(async (tx, [embajador, referido, admin]) => {
      const code = await getOrCreateReferralCode(embajador, tx)
      await attributeReferral(
        { code, referredUserId: referido, referrerIsActivePremium: true, referredHasEverPaid: false }, tx)
      const [row] = await tx.select().from(referrals).where(eq(referrals.referredUserId, referido)).limit(1)
      const paidAt = new Date(new Date(row.attributedAt).getTime() + 1 * DAY).toISOString()
      await qualifyReferralOnPayment({ referredUserId: referido, planType: 'monthly', paymentRef: 'sub_z', paidAt }, tx)
      const [q] = await tx.select().from(referrals).where(eq(referrals.referredUserId, referido)).limit(1)
      await promoteEligibleToPayable(new Date(new Date(q.holdUntil).getTime()).toISOString(), tx)

      // aparece en la lista de payables con el embajador correcto
      const mine = (await getPayableReferrals(tx)).find((p) => p.referralId === row.id)
      expect(mine).toBeTruthy()
      expect(mine!.referrerUserId).toBe(embajador)

      // el admin lo paga
      const pay = await payReferral(
        { referralId: row.id, adminUserId: admin, giftcardRef: 'AMZN-TEST', purchasedVia: 'bitrefill' }, tx)
      expect(pay).toMatchObject({ ok: true })

      // referido → paid + reward_payout creado (reason referral, beneficiario embajador, 10 €)
      const [after] = await tx.select().from(referrals).where(eq(referrals.id, row.id)).limit(1)
      expect(after.status).toBe('paid')
      expect(after.payoutId).toBeTruthy()
      const [po] = await tx.select().from(rewardPayouts).where(eq(rewardPayouts.id, after.payoutId)).limit(1)
      expect(po).toMatchObject({ reason: 'referral', beneficiaryUserId: embajador, status: 'paid' })
      expect(Number(po.amount)).toBe(10)

      // pagar otra vez → rechazado (ya no es payable) → sin doble gift card
      expect(await payReferral({ referralId: row.id, adminUserId: admin }, tx)).toMatchObject({ ok: false })
    })
  })

  it('recompensa BUG: crear (3 €, sin hold) → aparece → pagar → paid + reward_payout', async () => {
    await withTx(async (tx, [user, , admin]) => {
      const c = await createRewardSubmission({ userId: user, type: 'bug', feedbackId: undefined }, tx)
      expect(c).toMatchObject({ ok: true })
      const sid = (c as { ok: true; id: string }).id

      const pending = await getPendingRewardSubmissions(tx)
      expect(pending.find((p) => p.id === sid)).toBeTruthy()

      const pay = await payRewardSubmission({ submissionId: sid, adminUserId: admin, giftcardRef: 'AMZN-BUG' }, tx)
      expect(pay).toMatchObject({ ok: true })
      const [s] = await tx.select().from(rewardSubmissions).where(eq(rewardSubmissions.id, sid)).limit(1)
      expect(s.status).toBe('paid')
      const [po] = await tx.select().from(rewardPayouts).where(eq(rewardPayouts.id, s.payoutId)).limit(1)
      expect(po).toMatchObject({ reason: 'bug', beneficiaryUserId: user, status: 'paid' })
      expect(Number(po.amount)).toBe(3)
    })
  })

  it('recompensa UGC: SIN hold (solo referido = venta tiene hold) → paga al momento (5 €)', async () => {
    await withTx(async (tx, [user, , admin]) => {
      const c = await createRewardSubmission({ userId: user, type: 'ugc', url: 'https://t.me/post' }, tx)
      const sid = (c as { ok: true; id: string }).id
      // ya no hay hold en ugc → paga directamente (el post se verifica al pagar el vale)
      const pay = await payRewardSubmission({ submissionId: sid, adminUserId: admin, giftcardRef: 'AMZN-UGC' }, tx)
      expect(pay).toMatchObject({ ok: true })
      const [po2] = await tx.select().from(rewardPayouts).where(eq(rewardPayouts.beneficiaryUserId, user)).limit(1)
      expect(po2).toMatchObject({ reason: 'ugc' })
      expect(Number(po2.amount)).toBe(5)
    })
  })

  it('recompensa UGC: tope 3/mes → la 4ª se rechaza', async () => {
    await withTx(async (tx, [user]) => {
      for (let i = 0; i < 3; i++) {
        expect(await createRewardSubmission({ userId: user, type: 'ugc', url: `https://t.me/${i}` }, tx)).toMatchObject({ ok: true })
      }
      expect(await createRewardSubmission({ userId: user, type: 'ugc', url: 'https://t.me/4' }, tx)).toMatchObject({ ok: false, reason: 'monthly_cap' })
    })
  })

  it('ANTI-DUPLICADO bug: el mismo feedback_id no se recompensa dos veces', async () => {
    await withTx(async (tx, [user]) => {
      const fb = '00000000-0000-4000-8000-000000000abc'
      expect(await createRewardSubmission({ userId: user, type: 'bug', feedbackId: fb }, tx)).toMatchObject({ ok: true })
      expect(await createRewardSubmission({ userId: user, type: 'bug', feedbackId: fb }, tx)).toMatchObject({ ok: false, reason: 'duplicate' })
    })
  })

  it('ANTI-DUPLICADO ugc: la misma url no se recompensa dos veces', async () => {
    await withTx(async (tx, [user]) => {
      const url = 'https://t.me/dup-post'
      expect(await createRewardSubmission({ userId: user, type: 'ugc', url }, tx)).toMatchObject({ ok: true })
      expect(await createRewardSubmission({ userId: user, type: 'ugc', url }, tx)).toMatchObject({ ok: false, reason: 'duplicate' })
    })
  })

  it('getReferralCode (READ-ONLY) devuelve el mismo código que getOrCreateReferralCode (vista admin)', async () => {
    await withTx(async (tx, [user]) => {
      const created = await getOrCreateReferralCode(user, tx)   // asegura que existe
      expect(await getReferralCode(user, tx)).toBe(created)     // lo lee sin crear nada
    })
  })

  it('SALDO ACUMULADO: referido(10) + ugc(5) = 15 → pagar 10 → sobran 5', async () => {
    await withTx(async (tx, [embajador, referido, admin]) => {
      // referido payable (10 €) para el embajador
      const code = await getOrCreateReferralCode(embajador, tx)
      await attributeReferral({ code, referredUserId: referido, referrerIsActivePremium: true, referredHasEverPaid: false }, tx)
      const [row] = await tx.select().from(referrals).where(eq(referrals.referredUserId, referido)).limit(1)
      const paidAt = new Date(new Date(row.attributedAt).getTime() + 1 * DAY).toISOString()
      await qualifyReferralOnPayment({ referredUserId: referido, planType: 'monthly', paymentRef: 'sub_a', paidAt }, tx)
      const [q] = await tx.select().from(referrals).where(eq(referrals.referredUserId, referido)).limit(1)
      await promoteEligibleToPayable(new Date(new Date(q.holdUntil).getTime()).toISOString(), tx)

      // ugc (5 €) para el MISMO embajador, hold vencido
      const c = await createRewardSubmission({ userId: embajador, type: 'ugc', url: 'https://t.me/x' }, tx)
      await tx.update(rewardSubmissions).set({ holdUntil: sql`now() - interval '1 day'` }).where(eq(rewardSubmissions.id, (c as { ok: true; id: string }).id))

      // saldo = 10 + 5 = 15
      expect(await getUserOwedBalance(embajador, tx)).toBe(15)
      expect((await getEmbajadoresWithBalance(tx)).find((e) => e.userId === embajador)?.balance).toBe(15)

      // pagar la mayor denominación <= 15 = 10 €
      expect(await payAccumulated({ userId: embajador, adminUserId: admin, amount: 10, giftcardRef: 'AMZN' }, tx)).toMatchObject({ ok: true })
      // saldo restante = 5 (se acumula)
      expect(await getUserOwedBalance(embajador, tx)).toBe(5)

      // pagar 10 de nuevo → excede el saldo; y 7 → denominación inválida
      expect(await payAccumulated({ userId: embajador, adminUserId: admin, amount: 10 }, tx)).toMatchObject({ ok: false })
      expect(await payAccumulated({ userId: embajador, adminUserId: admin, amount: 7 }, tx)).toMatchObject({ ok: false, reason: 'invalid_denomination' })
    })
  })

  it('PANEL/BADGE: earnings por fuente (reward_earnings), saldo, novedades sin ver y escaparate admin', async () => {
    await withTx(async (tx, [embajador, referido]) => {
      // Referido → payable (10 €)
      const code = await getOrCreateReferralCode(embajador, tx)
      await attributeReferral({ code, referredUserId: referido, referrerIsActivePremium: true, referredHasEverPaid: false }, tx)
      const [row] = await tx.select().from(referrals).where(eq(referrals.referredUserId, referido)).limit(1)
      const paidAt = new Date(new Date(row.attributedAt).getTime() + 1 * DAY).toISOString()
      await qualifyReferralOnPayment({ referredUserId: referido, planType: 'monthly', paymentRef: 'sub_e', paidAt }, tx)
      const [q] = await tx.select().from(referrals).where(eq(referrals.referredUserId, referido)).limit(1)
      await promoteEligibleToPayable(new Date(new Date(q.holdUntil).getTime()).toISOString(), tx)

      // Bonus UGC (5 €) para el mismo embajador, EN HOLD (no disponible aún)
      await createRewardSubmission({ userId: embajador, type: 'ugc', url: 'https://t.me/x' }, tx)

      // Earnings: ganado 15; disponible 10 (referido payable; ugc en hold NO); en proceso 5
      const earn = await getEmbajadorEarnings(embajador, tx)
      expect(earn.earnedLifetime).toBe(15)
      expect(earn.balance).toBe(10)
      expect(earn.pending).toBe(5)
      const bySrc = Object.fromEntries(earn.bySource.map((s) => [s.source, s.earned]))
      expect(bySrc).toEqual({ referido: 10, ugc: 5 })

      // Badge: sin marcar visto → 2 novedades; marcado en el futuro → 0
      expect(await getUnseenEarningsCount(embajador, tx)).toBe(2)
      await tx.execute(sql`update user_profiles set referral_earnings_seen_at = now() + interval '10 days' where id = ${embajador}`)
      expect(await getUnseenEarningsCount(embajador, tx)).toBe(0)

      // Escaparate admin refleja el ingreso (global; ≥ lo de este embajador)
      const stats = await getReferralAdminStats(tx)
      expect(stats.totalEarned).toBeGreaterThanOrEqual(15)
      expect(stats.bySource.find((s) => s.source === 'referido')).toBeTruthy()
      expect(stats.bySource.find((s) => s.source === 'ugc')).toBeTruthy()
    })
  })
})
