// lib/referrals/activeSignup.ts
// Concesión del bonus "REGISTRO ACTIVO": 2€ al embajador cuando un REFERIDO llega a >=5 tests.
//
// ⚠️ DINERO REAL — GUARDARRAÍLES POR CONSTRUCCIÓN:
//  1. Flag: no concede NADA salvo ACTIVE_SIGNUP_REWARD=1 (activeSignupEnabled). Deploy seguro OFF.
//  2. Anti-fraude: el referido debe tener IP de registro DISTINTA a la del embajador (bloquea
//     auto-registro) y la fila no debe estar fraud-flagged. Y >=5 tests reales (bot no los hace).
//  3. Tope por embajador/mes (anti-abuso) + presupuesto GLOBAL/mes (tipo línea de Ads).
//  4. Idempotente: 1 bonus por referido (columna referrals.active_reward_at); un UPDATE atómico
//     con ventana por embajador evita superar el tope aunque haya muchos elegibles a la vez.
// Pensado para llamarse desde el cron de referidos.

import { getAdminDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import {
  ACTIVE_SIGNUP_REWARD_EUR, ACTIVE_SIGNUP_MIN_TESTS,
  ACTIVE_SIGNUP_MONTHLY_CAP, ACTIVE_SIGNUP_MONTHLY_BUDGET_EUR, activeSignupEnabled,
} from './logic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Executor = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowsOf(res: unknown): any[] { return Array.isArray(res) ? res : ((res as any)?.rows ?? []) }

export interface ActiveSignupGrantResult {
  enabled: boolean
  granted: number
  amount: number
  budgetSpent: number
  note?: string
}

/**
 * Concede el bonus de registro activo a los referidos ya elegibles. Idempotente y seguro.
 * Devuelve cuántos concedió. No lanza si está deshabilitado (granted:0).
 */
export async function grantActiveSignupRewards(exec?: Executor): Promise<ActiveSignupGrantResult> {
  if (!activeSignupEnabled()) {
    return { enabled: false, granted: 0, amount: ACTIVE_SIGNUP_REWARD_EUR, budgetSpent: 0, note: 'disabled' }
  }
  const db = exec ?? getAdminDb()

  // Presupuesto global del mes (tipo Ads): si ya se alcanzó, no conceder más.
  const bRes = await db.execute(sql`
    SELECT coalesce(sum(active_reward_amount), 0)::float AS spent
    FROM referrals WHERE active_reward_at >= date_trunc('month', now())`)
  const budgetSpent = Number(rowsOf(bRes)[0]?.spent || 0)
  const budgetLeftUnits = Math.floor((ACTIVE_SIGNUP_MONTHLY_BUDGET_EUR - budgetSpent) / ACTIVE_SIGNUP_REWARD_EUR)
  if (budgetLeftUnits <= 0) {
    return { enabled: true, granted: 0, amount: ACTIVE_SIGNUP_REWARD_EUR, budgetSpent, note: 'budget_reached' }
  }

  // Concesión atómica. Candidatos = referido con >=N tests, sin bonus aún, IP distinta del embajador,
  // no fraud-flagged. row_number por embajador respeta el tope mensual DENTRO del mismo batch.
  const upd = await db.execute(sql`
    WITH candidate AS (
      SELECT r.id, r.referrer_user_id, r.attributed_at,
        (SELECT count(*) FROM referrals r2
           WHERE r2.referrer_user_id = r.referrer_user_id
             AND r2.active_reward_at >= date_trunc('month', now())) AS already
      FROM referrals r
      JOIN user_profiles refd ON refd.id = r.referred_user_id
      JOIN user_profiles amb ON amb.id = r.referrer_user_id
      WHERE r.active_reward_at IS NULL
        AND (r.fraud_flags IS NULL OR r.fraud_flags = '{}'::jsonb OR jsonb_typeof(r.fraud_flags) = 'null')
        AND refd.registration_ip IS DISTINCT FROM amb.registration_ip
        AND (SELECT count(*) FROM tests t WHERE t.user_id = r.referred_user_id) >= ${ACTIVE_SIGNUP_MIN_TESTS}
    ),
    ranked AS (
      SELECT id, already,
        row_number() OVER (PARTITION BY referrer_user_id ORDER BY attributed_at ASC) AS rn
      FROM candidate
    ),
    eligible AS (
      SELECT id FROM ranked
      WHERE (already + rn) <= ${ACTIVE_SIGNUP_MONTHLY_CAP}
      ORDER BY id
      LIMIT ${budgetLeftUnits}
    )
    UPDATE referrals
      SET active_reward_at = now(), active_reward_amount = ${ACTIVE_SIGNUP_REWARD_EUR}
      WHERE id IN (SELECT id FROM eligible)
      RETURNING id`)
  const granted = rowsOf(upd).length
  return { enabled: true, granted, amount: ACTIVE_SIGNUP_REWARD_EUR, budgetSpent: budgetSpent + granted * ACTIVE_SIGNUP_REWARD_EUR }
}
