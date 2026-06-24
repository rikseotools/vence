// app/api/v2/admin/upgrade-messages/impressions/route.ts
// Últimas 20 impresiones de mensajes de upgrade (A/B testing) para el panel
// /admin/conversiones. Datos de todos los usuarios → tier admin.
//
// AGNÓSTICO (Fase C1): sustituye el supabase.from('upgrade_message_impressions')
// con embed de cliente por Drizzle detrás de requireAdmin. Reconstruye el embed
// upgrade_messages(title, message_key) con json_build_object (FK message_id).
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
    SELECT i.*,
      json_build_object('title', m.title, 'message_key', m.message_key) AS upgrade_messages
    FROM upgrade_message_impressions i
    LEFT JOIN upgrade_messages m ON m.id = i.message_id
    ORDER BY i.shown_at DESC
    LIMIT 20
  `)
  const impressions = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []

  return NextResponse.json({ success: true, impressions })
}

export const GET = withErrorLogging('/api/v2/admin/upgrade-messages/impressions', _GET)
