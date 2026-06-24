// app/api/v2/admin/feedback/messages/route.ts
// Mensajes de una conversación de feedback (con datos del remitente). Tier admin.
// AGNÓSTICO (Fase C1): sustituye supabase.from('feedback_messages') con embed
// sender:sender_id por Drizzle (JOIN user_profiles → json_build_object).
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

async function _GET(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  const conversationId = new URL(request.url).searchParams.get('conversationId')
  if (!conversationId) {
    return NextResponse.json({ success: false, error: 'missing_conversationId' }, { status: 400 })
  }

  const res = await getAdminDb().execute(sql`
    SELECT fm.id, fm.conversation_id, fm.sender_id, fm.is_admin, fm.message,
           fm.created_at, fm.read_at,
           CASE WHEN up.id IS NULL THEN NULL
                ELSE json_build_object('full_name', up.full_name, 'email', up.email) END AS sender
    FROM feedback_messages fm
    LEFT JOIN user_profiles up ON up.id = fm.sender_id
    WHERE fm.conversation_id = ${conversationId}::uuid
    ORDER BY fm.created_at ASC
  `)
  const messages = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
  return NextResponse.json({ success: true, messages })
}

export const GET = withErrorLogging('/api/v2/admin/feedback/messages', _GET)
