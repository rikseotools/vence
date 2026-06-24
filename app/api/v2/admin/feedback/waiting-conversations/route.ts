// app/api/v2/admin/feedback/waiting-conversations/route.ts
// Conversaciones esperando admin y NO vistas (badge de pendientes). Tier admin.
// AGNÓSTICO (Fase C1): sustituye supabase.from('feedback_conversations') de cliente.
// (El fallback "columna admin_viewed_at no existe" del original se elimina: la
//  columna existe en BD desde hace tiempo.)
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

async function _GET(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  const res = await getAdminDb().execute(sql`
    SELECT id, feedback_id, status, last_message_at
    FROM feedback_conversations
    WHERE status = 'waiting_admin' AND admin_viewed_at IS NULL
  `)
  const conversations = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
  return NextResponse.json({ success: true, conversations })
}

export const GET = withErrorLogging('/api/v2/admin/feedback/waiting-conversations', _GET)
