// lib/referrals/disputeReward.ts
// Recompensa automática de 1 € por IMPUGNACIÓN ACEPTADA a favor del usuario (decisión Manuel 28/07).
//
// Se dispara desde `resolveDispute` (lib/api/v2/dispute/queries.ts), que es el ÚNICO punto por el que
// una impugnación pasa a `resolved` — endpoint admin y scripts CLI incluidos. Colgarlo ahí y no del
// endpoint HTTP es lo que garantiza que no haya una vía que resuelva sin pagar.
//
// REGLA DE ORO: esto NUNCA puede romper la resolución de una impugnación. Si algo falla aquí, se
// registra y se sigue: el usuario prefiere que su impugnación se resuelva sin 1 € a que no se resuelva.
// Por eso no lanza nunca y por eso NO va dentro de la transacción del UPDATE.

import { sql } from 'drizzle-orm'
import { getReadDb } from '@/db/client'
import { createRewardSubmission } from './queries'
import { shouldRewardResolvedDispute, disputeTypeIsRewardable } from './logic'
import { emitReferralEvent } from './observability'

/**
 * Emitir NO puede tumbar la resolución de una impugnación. Parece paranoia y no lo es: la primera
 * versión de este fichero emitía el evento directamente desde el `catch`, y en cuanto el sink no
 * estuvo disponible el propio manejador de errores lanzó — el error salió de aquí, subió hasta
 * `resolveDispute` y convirtió "no se pudo dar 1 €" en "no se pudo resolver la impugnación".
 * Lo cazaron 15 tests de `resolveDispute` (28/07). Si el handler de fallos puede fallar, no es un
 * handler de fallos.
 */
function safeEmit(...args: Parameters<typeof emitReferralEvent>): void {
  try {
    emitReferralEvent(...args)
  } catch {
    /* la observabilidad nunca decide si el usuario cobra o si su impugnación se resuelve */
  }
}

export interface DisputeRewardResult {
  granted: boolean
  reason?: 'not_resolved' | 'not_premium' | 'not_user_source' | 'not_rewardable_type' | 'duplicate' | 'monthly_cap' | 'error'
  amount?: number
}

/**
 * Concede (o no) el euro por una impugnación recién resuelta. Idempotente: el anti-duplicado por
 * `dispute_id` —índice único parcial en BD + check en `createRewardSubmission`— hace que re-ejecutarla
 * sea inofensivo.
 */
export async function maybeRewardResolvedDispute(params: {
  disputeId: string
  userId: string | null
  status: string
  questionType: 'legislative' | 'psychometric'
}): Promise<DisputeRewardResult> {
  try {
    if (params.status !== 'resolved' || !params.userId) return { granted: false, reason: 'not_resolved' }

    const db = getReadDb()
    // Plan del usuario + origen y TIPO de la impugnación. `source` solo existe en las legislativas;
    // las psicotécnicas son siempre de usuario (no hay pipeline `ai_auto` para ellas), de ahí el
    // 'user'. El `dispute_type` se lee de SU tabla: decide si el motivo es de los que pagan.
    const res = await db.execute(sql`
      select u.plan_type,
             ${params.questionType === 'legislative'
               ? sql`(select d.source from question_disputes d where d.id = ${params.disputeId})`
               : sql`'user'::text`} as source,
             ${params.questionType === 'legislative'
               ? sql`(select d.dispute_type from question_disputes d where d.id = ${params.disputeId})`
               : sql`(select d.dispute_type from psychometric_question_disputes d where d.id = ${params.disputeId})`} as dispute_type
      from user_profiles u where u.id = ${params.userId} limit 1`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = Array.isArray(res) ? res : ((res as any)?.rows ?? [])
    const planType = rows[0]?.plan_type ?? null
    const source = rows[0]?.source ?? 'user'
    const disputeType = rows[0]?.dispute_type ?? null

    if (!shouldRewardResolvedDispute({ status: params.status, source, planType, userId: params.userId, disputeType })) {
      // Distinguir el motivo importa para leer los datos después: `not_rewardable_type` es la
      // política funcionando (motivo subjetivo), no un usuario que se queda sin cobrar por error.
      const reason: DisputeRewardResult['reason'] =
        source !== 'user' ? 'not_user_source'
        : !disputeTypeIsRewardable(disputeType) ? 'not_rewardable_type'
        : 'not_premium'
      if (reason === 'not_rewardable_type') {
        safeEmit('reward_skipped_subjective_type', {
          userId: params.userId, endpoint: 'resolveDispute',
          metadata: { type: 'impugnacion', disputeId: params.disputeId, disputeType },
        })
      }
      return { granted: false, reason }
    }

    const created = await createRewardSubmission({
      userId: params.userId,
      type: 'impugnacion',
      disputeId: params.disputeId,
    })

    if (!created.ok) {
      // 'duplicate' es el camino NORMAL al re-resolver; 'monthly_cap' es el tope funcionando.
      if (created.reason === 'monthly_cap') {
        safeEmit('reward_cap_hit', {
          userId: params.userId, endpoint: 'resolveDispute', severity: 'warn',
          metadata: { type: 'impugnacion', disputeId: params.disputeId },
        })
      }
      return { granted: false, reason: created.reason as DisputeRewardResult['reason'] }
    }

    safeEmit('reward_created', {
      userId: params.userId, endpoint: 'resolveDispute',
      metadata: { type: 'impugnacion', amount: 1, disputeId: params.disputeId, questionType: params.questionType },
    })
    console.log(`🎁 [dispute-reward] +1 € a ${params.userId} por impugnación aceptada ${params.disputeId}`)
    return { granted: true, amount: 1 }
  } catch (e) {
    // Nunca propagar: la impugnación ya está resuelta y eso es lo que importa.
    safeEmit('referral_error', {
      userId: params.userId, endpoint: 'resolveDispute', severity: 'warn',
      metadata: { step: 'dispute_reward', disputeId: params.disputeId, error: e instanceof Error ? e.message : String(e) },
    })
    return { granted: false, reason: 'error' }
  }
}
