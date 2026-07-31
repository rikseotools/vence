// __tests__/integration/helpers/referralsFixture.ts
//
// Fixture compartido de las suites de referidos (integración + simulación E2E).
//
// ## Por qué existe (T-336, 31/07/2026)
//
// Las dos suites cogían «tres `user_profiles` cualesquiera» (`SELECT id FROM user_profiles
// LIMIT 3`, sin ORDER BY) y los usaban como embajador y referidos. Eso venía funcionando por
// casualidad hasta que producción estrenó el guard **«solo usuarios nuevos»**
// (`REFERRAL_NEW_ACCOUNT_MAX_AGE_DAYS = 7`, `refereeEligibility`): a partir de ahí, CUALQUIER
// usuario real de la base es una cuenta vieja, así que **toda atribución se rechazaba con
// `referred_not_new`** y 11 tests se pusieron rojos sin que nadie tocara los tests.
//
// El diagnóstico importa: **no era un fallo de producción**. El guard es deliberado y correcto
// (una cuenta preexistente no es captación). Lo que estaba mal era el fixture, que dependía de
// filas ajenas cuyo `created_at` no controla nadie. Por eso la reparación NO relaja ninguna
// aserción —eso, en un circuito de dinero, sería peor que el rojo— sino que le da al test el
// dato que el dominio exige: un referido **nuevo de verdad**.
//
// Aquí, además, el fixture es único para las dos suites: duplicado en dos ficheros es como
// llegaron a divergir sin que se notara.
//
// Todo ocurre dentro de una transacción que SIEMPRE hace ROLLBACK: no persiste nada, ni
// siquiera los usuarios que crea.

import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'

const ROLLBACK = new Error('__ROLLBACK_SENTINEL__')

/** Cuántos días de antigüedad tiene una cuenta que el dominio SÍ considera captación nueva. */
export const EDAD_CUENTA_NUEVA_DIAS = 0

/**
 * Crea un `user_profiles` efímero dentro de la transacción.
 *
 * @param tx        transacción abierta (se revierte entera al final)
 * @param etiqueta  para que el email sea legible si algo se queda mirando en un log
 * @param edadDias  antigüedad de la cuenta. 0 = recién registrada (el caso normal del referido);
 *                  un valor > 7 sirve para EJERCER el guard de «solo usuarios nuevos».
 */
export async function crearUsuarioEfimero(tx: any, etiqueta: string, edadDias = EDAD_CUENTA_NUEVA_DIAS): Promise<string> {
  const email = `test-referidos-${etiqueta}-${Math.random().toString(36).slice(2, 10)}@vence.test`
  const [row] = await tx.execute(sql`
    INSERT INTO user_profiles (id, email, full_name, plan_type, created_at, registration_date)
    VALUES (gen_random_uuid(), ${email}, 'Test Referidos', 'free',
            NOW() - (${edadDias} * INTERVAL '1 day'),
            NOW() - (${edadDias} * INTERVAL '1 day'))
    RETURNING id`)
  return row.id as string
}

/**
 * Ejecuta `fn` dentro de una transacción con ROLLBACK garantizado, inyectando TRES usuarios
 * recién creados: `[embajador, referido, tercero]`.
 *
 * Los tres nacen con `created_at = NOW()`, así que el referido es captación nueva de verdad y
 * la atribución se evalúa por lo que el test quiere probar, no por la edad accidental de una
 * fila ajena.
 */
export async function withTx(fn: (tx: any, users: string[]) => Promise<void>): Promise<void> {
  const db = getAdminDb()
  try {
    await db.transaction(async (tx: any) => {
      const users = [
        await crearUsuarioEfimero(tx, 'embajador'),
        await crearUsuarioEfimero(tx, 'referido'),
        await crearUsuarioEfimero(tx, 'tercero'),
      ]
      await fn(tx, users)
      throw ROLLBACK
    })
  } catch (e) {
    if (e !== ROLLBACK) throw e
  }
}
