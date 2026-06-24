// app/api/v2/admin/pending-feedback-counts/route.ts
// Conteos para los badges admin del Header/useAdminNotifications: feedback pendiente
// (clasificado por tipo) + rate-limit hits no revisados. Datos de TODOS los usuarios.
//
// AGNÓSTICO (Fase C1, tier admin): sustituye 3 supabase.from de cliente (2 embeds de
// feedback + COUNT de validation_error_logs) por Drizzle detrás de requireAdmin. La
// lógica `needsAttention` se porta VERBATIM del hook para no divergir en los conteos.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 20

function rowsOf(res: unknown): unknown[] {
  return Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
}

type Msg = { id: string; is_admin: boolean; created_at: string }
type FbType = string | null | undefined

function classify(counts: { deletion: number; bug: number; email: number; other: number }, type: FbType) {
  if (type === 'account_deletion') counts.deletion++
  else if (type === 'bug') counts.bug++
  else if (type === 'email') counts.email++
  else counts.other++
}

// ¿El último mensaje es del usuario (no admin) o no hay mensajes? → necesita atención.
function msgsNeedAttention(msgs: Msg[]): boolean {
  if (!msgs || msgs.length === 0) return true
  const sorted = [...msgs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return !!sorted[0] && sorted[0].is_admin === false
}

async function _GET(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  const db = getAdminDb()

  // 1. Feedbacks pending/in_progress con sus conversaciones y mensajes (embed reconstruido).
  const feedbacksRes = await db.execute(sql`
    SELECT uf.id, uf.type,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', fc.id, 'status', fc.status,
          'feedback_messages', COALESCE((
            SELECT json_agg(json_build_object('id', fm.id, 'is_admin', fm.is_admin, 'created_at', fm.created_at))
            FROM feedback_messages fm WHERE fm.conversation_id = fc.id
          ), '[]'::json)
        ))
        FROM feedback_conversations fc WHERE fc.feedback_id = uf.id
      ), '[]'::json) AS feedback_conversations
    FROM user_feedback uf
    WHERE uf.status IN ('pending', 'in_progress')
  `)

  // 2. Conversaciones reabiertas: feedback resolved pero conversación no cerrada.
  const reopenedRes = await db.execute(sql`
    SELECT fc.id, fc.status, fc.feedback_id,
      json_build_object('id', uf.id, 'type', uf.type, 'status', uf.status) AS user_feedback,
      COALESCE((
        SELECT json_agg(json_build_object('id', fm.id, 'is_admin', fm.is_admin, 'created_at', fm.created_at))
        FROM feedback_messages fm WHERE fm.conversation_id = fc.id
      ), '[]'::json) AS feedback_messages
    FROM feedback_conversations fc
    JOIN user_feedback uf ON uf.id = fc.feedback_id
    WHERE fc.status <> 'closed' AND uf.status = 'resolved'
  `)

  // 3. Rate-limit hits no revisados (últimas 24h).
  const rateLimitRes = await db.execute(sql`
    SELECT COUNT(*)::int AS n
    FROM validation_error_logs
    WHERE error_type = 'rate_limit' AND reviewed_at IS NULL
      AND created_at >= now() - interval '24 hours'
  `)

  let pendingFeedback = 0
  const feedbackByType = { deletion: 0, bug: 0, email: 0, other: 0 }

  for (const fb of rowsOf(feedbacksRes) as Array<{ type: FbType; feedback_conversations: Array<{ status: string; feedback_messages: Msg[] }> }>) {
    const conv = fb.feedback_conversations?.[0]
    let needsAttention = false
    if (!conv) needsAttention = true
    else if (conv.status !== 'closed') needsAttention = msgsNeedAttention(conv.feedback_messages || [])
    if (needsAttention) { pendingFeedback++; classify(feedbackByType, fb.type) }
  }

  for (const conv of rowsOf(reopenedRes) as Array<{ user_feedback: { type: FbType }; feedback_messages: Msg[] }>) {
    if (msgsNeedAttention(conv.feedback_messages || [])) {
      pendingFeedback++
      classify(feedbackByType, conv.user_feedback?.type)
    }
  }

  const rateLimitHits = (rowsOf(rateLimitRes)[0] as { n?: number } | undefined)?.n ?? 0

  return NextResponse.json({ success: true, pendingFeedback, feedbackByType, rateLimitHits })
}

export const GET = withErrorLogging('/api/v2/admin/pending-feedback-counts', _GET)
