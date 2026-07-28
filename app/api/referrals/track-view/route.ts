// app/api/referrals/track-view/route.ts — registra una visita a /recompensas (top del embudo).
// PÚBLICO (cuenta a logueados y anónimos). Emite referral_page_view a observable_events (agregado,
// sin userId). Fire-and-forget: no bloquea, no lanza. Consulta: count(*) where event_type='referral_page_view'.

import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import { emitReferralEvent } from '@/lib/referrals/observability'

async function _POST(request: NextRequest) {
  // Identidad OPCIONAL: si viene token válido, capturamos el userId del visitante (trazabilidad);
  // si es anónimo, se cuenta igual con userId null (NO devolvemos 401 — la visita pública también cuenta).
  const auth = await getAuthenticatedUser(request)
  const userId = auth.ok ? auth.user.id : null
  // De qué embajador viene (cookie puesta por /r/[code]) → "quién visitó vía el enlace de quién".
  const ref = request.cookies.get('vence_ref')?.value ?? null

  // `src` = por dónde entró (?src=header, ?src=msg-mencion…). Viene del cliente, así que se SANEA:
  // longitud acotada y alfabeto cerrado. Es una etiqueta de campaña, no un dato de confianza, y sin
  // recortar acabaría metiendo basura arbitraria en observable_events.
  let src: string | null = null
  try {
    const body = await request.json()
    const raw = typeof body?.src === 'string' ? body.src : null
    if (raw && /^[a-z0-9_-]{1,32}$/i.test(raw)) src = raw
  } catch { /* sin body → visita directa, src null */ }

  emitReferralEvent('referral_page_view', {
    userId,
    endpoint: '/recompensas',
    metadata: { ref, authenticated: !!userId, src },
  })
  return NextResponse.json({ ok: true })
}

export const POST = withErrorLogging('/api/referrals/track-view', _POST)
export { _POST }
