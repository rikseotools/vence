// app/api/admin/rewards/route.ts — recompensas manuales (admin).
//   GET  → lista las recompensas `approved` pendientes de pagar.
//   POST → crea una recompensa para un usuario (por email).
//          Body: { email, type: 'bug'|'ugc'|'impugnacion', url?, screenshotUrl?, feedbackId?, disputeId? }
// Requiere admin. El admin la crea porque ya la validó en el chat de soporte.
//
// ── POR QUÉ ACEPTA `impugnacion` (T-477) ────────────────────────────────────────────────────
//
// Desde el 28/07 el euro de impugnación se concede SOLO cuando el motivo es verificable, y tanto
// el manual (§6.bis) como el runbook de embajadores prometen que **lo subjetivo se sigue premiando
// A MANO**. Esa vía no existía: esta puerta rechazaba con 400 todo lo que no fuera `bug` o `ugc`,
// mientras el dominio lo soportaba entero (importe de 1 €, `disputeId`, anti-duplicado por
// `dispute_id` con índice único en BD y su propio tope mensual).
//
// La consecuencia no era teórica: para cumplir la política había que **saltarse el endpoint** y
// llamar a `createRewardSubmission` desde un script (se hizo el 02/08 con Lucía Quiroga), y el
// atajo alternativo —cobrarlo como `bug`— habría pagado **3 € en vez de 1 €** y dejado el motivo
// falseado en la traza.

import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { requireAdmin } from '@/lib/api/shared/auth'
import { getPendingRewardSubmissions, createRewardSubmission, findUserIdByEmail } from '@/lib/referrals/queries'
import { emitReferralEvent } from '@/lib/referrals/observability'
import { type RewardType } from '@/lib/referrals/logic'

async function _GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response
  const rewards = await getPendingRewardSubmissions()
  return NextResponse.json({ rewards })
}

async function _POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const email = typeof body?.email === 'string' ? body.email : ''
  const type = body?.type
  const disputeId = typeof body?.disputeId === 'string' ? body.disputeId : undefined
  if (!email || (type !== 'bug' && type !== 'ugc' && type !== 'impugnacion')) {
    return NextResponse.json({ ok: false, error: 'email y type (bug|ugc|impugnacion) requeridos' }, { status: 400 })
  }
  // `disputeId` es OBLIGATORIO en las de impugnación, y no por formalismo: es el MOTIVO trazable
  // con el que el anti-duplicado (índice único parcial sobre `dispute_id`) impide pagar dos veces
  // la misma impugnación. Sin él la recompensa entra sin nada que la ate y esa puerta deja de
  // proteger — el mismo papel que `feedback_id` en las de bug y `url` en las de UGC.
  if (type === 'impugnacion' && !disputeId) {
    return NextResponse.json(
      { ok: false, error: 'disputeId requerido en type=impugnacion (es el motivo trazable del anti-duplicado)' },
      { status: 400 },
    )
  }

  const userId = await findUserIdByEmail(email)
  if (!userId) return NextResponse.json({ ok: false, error: 'usuario no encontrado' }, { status: 404 })

  const result = await createRewardSubmission({
    userId,
    type: type as RewardType,
    url: typeof body?.url === 'string' ? body.url : undefined,
    screenshotUrl: typeof body?.screenshotUrl === 'string' ? body.screenshotUrl : undefined,
    feedbackId: typeof body?.feedbackId === 'string' ? body.feedbackId : undefined,
    disputeId,
  })
  if (result.ok) {
    emitReferralEvent('reward_created', { userId, endpoint: '/api/admin/rewards', metadata: { type } })
    // NO se envía email en bug/ugc (decisión Manuel 10/07): estas recompensas nacen de un feedback
    // que YA le respondemos por su hilo, así que el email sería redundante. El badge 🎁 se enciende
    // igual (es server-side vía la vista `reward_earnings`, no depende de notifyEarning).
    // El email SÍ se manda en el caso `referido` (webhook Stripe), donde no hay hilo de soporte.
  } else if (result.reason === 'monthly_cap') {
    emitReferralEvent('reward_cap_hit', { userId, endpoint: '/api/admin/rewards', severity: 'warn', metadata: { type } })
  } else if (result.reason === 'duplicate') {
    // Ya existe recompensa para este mismo motivo (bug=feedback / ugc=post / impugnacion=dispute)
    // → no duplicar.
    emitReferralEvent('reward_duplicate', { userId, endpoint: '/api/admin/rewards', severity: 'warn', metadata: { type } })
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 409 })
}

export const GET = withErrorLogging('/api/admin/rewards', _GET)
export const POST = withErrorLogging('/api/admin/rewards', _POST)
export { _GET, _POST }
