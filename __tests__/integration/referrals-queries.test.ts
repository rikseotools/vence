/**
 * @jest-environment node
 */
// __tests__/integration/referrals-queries.test.ts  (en __tests__/integration/ para el job CI de integración)
// CAPA 2 (integración) del programa de referidos — queries reales contra RDS vivo, dentro de una
// transacción con ROLLBACK (NO persiste nada; respeta la convención "integración readonly").
// Ver memoria feedback_feature_multiples_capas_seguridad + docs/roadmap/programa-referidos-embajadores.md.

import { eq } from 'drizzle-orm'
import { referrals } from '@/db/referralSchema'
import { withTx, crearUsuarioEfimero } from './helpers/referralsFixture'
import {
  getOrCreateReferralCode,
  attributeReferral,
  qualifyReferralOnPayment,
  promoteEligibleToPayable,
  getReferralStats,
  getReferralDetails,
} from '@/lib/referrals/queries'

const DAY = 86_400_000

// El fixture (usuarios efímeros creados dentro de la tx) vive en un solo sitio compartido con
// la suite de simulación — ver el porqué en helpers/referralsFixture.ts (T-336).

// Escribe (aunque haga ROLLBACK) → se gatea como sus 7 hermanas que también escriben. Hasta
// T-384 era una de las DOS únicas sin gatear, y por eso era de las pocas que INTENTABA correr
// en un CI sin base de datos escribible: su rojo era del entorno, no del código. La regla que
// fija el guardarraíl `suiteRegistry`: una suite que crea datos declara su gate.
const describeIf =
  process.env.DATABASE_URL && process.env.INTEGRATION_DB_WRITABLE === '1' ? describe : describe.skip

describeIf('referrals queries — integración RDS (tx rollback)', () => {
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

  // El guard que dejó 11 tests rojos sin que nadie tocara un test (T-336): producción empezó a
  // exigir que el referido sea una cuenta NUEVA (≤ 7 días) y aquí no había nada que lo afirmara,
  // así que el cambio solo se «notó» como una avería difusa del CI. Ahora está fijado a los dos
  // lados: la cuenta recién creada pasa, la vieja se rechaza con su motivo exacto.
  it('solo capta usuarios NUEVOS: una cuenta preexistente se rechaza con referred_not_new', async () => {
    await withTx(async (tx, [u1]) => {
      const code = await getOrCreateReferralCode(u1, tx)

      const recienRegistrado = await crearUsuarioEfimero(tx, 'nuevo', 0)
      expect(await attributeReferral(
        { code, referredUserId: recienRegistrado, referrerIsActivePremium: true, referredHasEverPaid: false }, tx))
        .toMatchObject({ ok: true })

      const cuentaVieja = await crearUsuarioEfimero(tx, 'preexistente', 30)
      expect(await attributeReferral(
        { code, referredUserId: cuentaVieja, referrerIsActivePremium: true, referredHasEverPaid: false }, tx))
        .toMatchObject({ ok: false, reason: 'referred_not_new' })
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
      const estadoDeNuestraFila = async () => {
        const [r] = await tx.select().from(referrals).where(eq(referrals.referredUserId, u2)).limit(1)
        return r.status
      }

      // Se mira el estado de NUESTRA fila, no el número que devuelve la función (T-336).
      //
      // `promoteEligibleToPayable` es GLOBAL por diseño: promociona toda fila `qualified` con el
      // hold vencido, así que su contador incluye los referidos reales de producción que también
      // toquen en ese instante. Afirmar `toBe(0)`/`toBe(1)` era afirmar algo sobre el resto de la
      // base, no sobre este caso — y el día que hubo un referido real cualificado, rojo.
      //
      // Esto NO afloja la aserción, la aprieta: lo que de verdad importa del hold no es cuántas
      // filas movió la pasada, sino que ESTE referido no cobre antes de tiempo y sí después.
      await promoteEligibleToPayable(new Date(hold - 1000).toISOString(), tx)
      expect(await estadoDeNuestraFila()).toBe('qualified')   // un segundo antes: intacto

      await promoteEligibleToPayable(new Date(hold).toISOString(), tx)
      expect(await estadoDeNuestraFila()).toBe('payable')     // cumplido el hold: promociona
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
