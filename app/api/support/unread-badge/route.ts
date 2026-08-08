// app/api/support/unread-badge/route.ts
// [T-378] Cuenta unread de "respuestas de soporte" del usuario AUTENTICADO: conversaciones
// de feedback ya respondidas (notification_logs.context_data->>'type'='feedback_response')
// + impugnaciones normales y psicotécnicas resueltas/rechazadas/alegadas sin leer.
//
// Antes esto vivía sumado dentro del badge de la campana (useIntelligentNotifications +
// useDisputeNotifications) y nunca bajaba a 0 si el usuario tenía impugnaciones sin leer,
// aunque despachara sus avisos de estudio — ver hooks/useSupportUnreadBadge.ts. Las mismas
// ventanas/filtros que ya usan `/api/v2/notifications/system` y
// `/api/v2/disputes/notifications` (30 días, is_read/opened_at), para no inventar un
// criterio nuevo de qué cuenta como "reciente".
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

function countOf(res: unknown): number {
  const rows = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
  return Number((rows[0] as { n?: string | number } | undefined)?.n || 0)
}

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/support/unread-badge')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }
  const uid = auth.userId
  const db = getAdminDb()

  const [feedbackRes, disputesRes, psychoDisputesRes] = await Promise.all([
    db.execute(sql`
      SELECT count(*)::int AS n FROM notification_logs
      WHERE user_id = ${uid}::uuid AND opened_at IS NULL
        AND created_at >= now() - interval '30 days'
        AND context_data->>'type' = 'feedback_response'
    `),
    db.execute(sql`
      SELECT count(*)::int AS n FROM question_disputes
      WHERE user_id = ${uid}::uuid AND is_read = false
        AND status IN ('resolved', 'rejected', 'appealed')
        AND resolved_at >= now() - interval '30 days'
    `),
    db.execute(sql`
      SELECT count(*)::int AS n FROM psychometric_question_disputes
      WHERE user_id = ${uid}::uuid AND is_read = false
        AND status IN ('resolved', 'rejected')
        AND resolved_at >= now() - interval '30 days'
    `),
  ])

  const unread = countOf(feedbackRes) + countOf(disputesRes) + countOf(psychoDisputesRes)
  return NextResponse.json({ success: true, unread })
}

export const GET = withErrorLogging('/api/support/unread-badge', _GET)
