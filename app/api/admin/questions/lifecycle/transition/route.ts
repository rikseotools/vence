// app/api/admin/questions/lifecycle/transition/route.ts
// Wrapper del SQL function transition_question_state.
// Única vía legítima desde la app para cambiar lifecycle_state de una pregunta.
//
// Body:
//   { questionId, expectedState (string|null), newState, reasonCode, aiVerificationId?, notes? }
//
// El SQL function valida: input → optimistic check → terminal rejection → transición legal
// → UPDATE questions + INSERT history en misma transacción.

import { NextRequest } from 'next/server'
import { z } from 'zod/v3'
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { invalidateTestConfigCache } from '@/lib/cache/test-config'
import { invalidateLawStatsCache } from '@/lib/cache/law-stats'
import {
  LIFECYCLE_STATES,
  isValidReasonCode,
  isLegalTransition,
  isTerminalState,
  type LifecycleState,
} from '@/lib/constants/lifecycleReasons'

const bodySchema = z.object({
  questionId: z.string().uuid('questionId debe ser UUID'),
  expectedState: z.enum(LIFECYCLE_STATES).nullable(),  // null permitido durante backfill window solo
  newState: z.enum(LIFECYCLE_STATES),
  reasonCode: z.string().min(1, 'reasonCode requerido').refine(isValidReasonCode, {
    message: 'reasonCode no está en la taxonomía cerrada (ver lib/constants/lifecycleReasons.ts)',
  }),
  aiVerificationId: z.string().uuid().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

async function _POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  const body = await request.json().catch(() => null)
  if (!body) {
    return Response.json({ success: false, error: 'Body inválido (no es JSON)' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({
      success: false,
      error: parsed.error.issues[0]?.message || 'Datos inválidos',
      issues: parsed.error.issues,
    }, { status: 400 })
  }

  const { questionId, expectedState, newState, reasonCode, aiVerificationId, notes } = parsed.data

  // Pre-validación cliente-side (la SQL function lo enforce también, pero esto da mejor error UX).
  if (expectedState !== null) {
    if (isTerminalState(expectedState as LifecycleState)) {
      return Response.json({
        success: false,
        error: `Estado terminal ${expectedState} no admite transición de salida. Crear pregunta nueva si es recuperable.`,
      }, { status: 400 })
    }
    if (!isLegalTransition(expectedState as LifecycleState, newState)) {
      return Response.json({
        success: false,
        error: `Transición ilegal: ${expectedState} → ${newState}`,
      }, { status: 400 })
    }
  }

  try {
    const db = getDb()
    await db.execute(sql`
      SELECT public.transition_question_state(
        ${questionId}::uuid,
        ${expectedState}::text,
        ${newState}::text,
        ${reasonCode}::text,
        ${admin.user.id}::uuid,
        ${aiVerificationId ?? null}::uuid,
        ${notes ?? null}::text
      )
    `)

    // El lifecycle_state cambia → is_active (GENERATED) cambia → counts y
    // listas que cachean test-config y law-stats se quedan stale.
    invalidateTestConfigCache()
    invalidateLawStatsCache()

    return Response.json({
      success: true,
      questionId,
      newState,
      reasonCode,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)

    // Errores esperados de la función SQL → 409 (Conflict) o 400 (Bad Request)
    if (msg.includes('State mismatch')) {
      return Response.json({
        success: false,
        error: msg,
        hint: 'El estado actual de la pregunta cambió desde tu última lectura. Recarga el panel.',
      }, { status: 409 })
    }
    if (msg.includes('Cannot transition from terminal') || msg.includes('Illegal transition') || msg.includes('Same-state') || msg.includes('Invalid p_new_state') || msg.includes('p_reason_code is required')) {
      return Response.json({ success: false, error: msg }, { status: 400 })
    }
    if (msg.includes('not found')) {
      return Response.json({ success: false, error: msg }, { status: 404 })
    }

    // Cualquier otro error → 500 con detalle (withErrorLogging lo loga)
    throw e
  }
}

export const POST = withErrorLogging('/api/admin/questions/lifecycle/transition', _POST)
