// app/api/referrals/track-view/route.ts — registra una visita a /embajadores (top del embudo).
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

  emitReferralEvent('referral_page_view', {
    userId,
    endpoint: '/embajadores',
    metadata: { ref, authenticated: !!userId },
  })
  return NextResponse.json({ ok: true })
}

export const POST = withErrorLogging('/api/referrals/track-view', _POST)
export { _POST }
