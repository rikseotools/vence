/**
 * @jest-environment node
 */
// __tests__/integration/referrals-simulation.test.ts
// CAPA 3 (simulación E2E) — memoria feedback_feature_multiples_capas_seguridad.
// Simula el CIRCUITO COMPLETO del referido contra RDS (tx rollback), encadenando los pasos reales:
//   atribución → cupón aplicable → calificación por pago → hold → payable, y la rama de clawback.
// A diferencia de la integración por-función, aquí importa que la SECUENCIA entera encaje.

import { eq } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { referrals, rewardPayouts } from '@/db/referralSchema'
import { userProfiles } from '@/db/schema'
import {
  getOrCreateReferralCode,
  attributeReferral,
  hasPendingReferral,
  qualifyReferralOnPayment,
  promoteEligibleToPayable,
  rejectReferralOnRefund,
  getReferralStats,
  getPayableReferrals,
  payReferral,
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
})
