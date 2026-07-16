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
        -- Referido NO rechazado. Un 'rejected' es una referencia INVÁLIDA (cuenta preexistente
        -- por la política solo-usuarios-nuevos, o refund/fraude): si la rechazamos porque NO es
        -- captación nueva, el bono que premia la captación tampoco toca (decisión Manuel 16/07,
        -- caso Marta: referido rechazado por preexistente pero cobraba los 2€ igual). Invariante:
        -- status='rejected' ⇒ sin active_reward (reforzado también al rechazar en queries.ts).
        AND r.status <> 'rejected'
        -- "sin fraude" = flags vacíos. El DEFAULT de la columna es '[]'::jsonb (array
        -- vacío), así que hay que aceptarlo explícitamente: sin esto NINGUNA referral
        -- real (todas nacen con []) pasaba el filtro y el bono nunca se concedía (bug
        -- detectado 2026-07-11: 0 concesiones en toda la historia pese a elegibles).
        AND (r.fraud_flags IS NULL OR jsonb_typeof(r.fraud_flags) = 'null'
             OR r.fraud_flags = '{}'::jsonb OR r.fraud_flags = '[]'::jsonb)
        AND refd.registration_ip IS DISTINCT FROM amb.registration_ip
        -- >=N tests DESDE la atribución (created_at > attributed_at), NO de por vida: el bono
        -- premia la actividad que la REFERENCIA generó. Sin esto, referir a un free ya-activo
        -- (que arrastra cientos de tests antiguos) concedía 2€ instantáneos sin que la referencia
        -- activara nada → falso positivo + agujero de fraude (caso Marta, 12/07: 119 tests, 0 tras
        -- la referencia). El referido nuevo real hace TODOS sus tests tras la atribución, así que a
        -- él no le afecta.
        AND (SELECT count(*) FROM tests t WHERE t.user_id = r.referred_user_id
               AND t.created_at > r.attributed_at) >= ${ACTIVE_SIGNUP_MIN_TESTS}
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
