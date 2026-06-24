// app/api/v2/admin/feedback/open-count/route.ts
// Nº de conversaciones de feedback ABIERTAS y NO vistas por admin (badge del Header).
//
// AGNÓSTICO (Fase C1, tier admin): sustituye el supabase.from('feedback_conversations')
// de cliente por Drizzle detrás de requireAdmin — datos de TODOS los usuarios, así que
// NUNCA debe leerse con PostgREST de cliente una vez retirada RLS.
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
    SELECT COUNT(*)::int AS n
    FROM feedback_conversations
    WHERE status = 'open' AND admin_viewed_at IS NULL
  `)
  const rows = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
  const count = (rows[0] as { n?: number } | undefined)?.n ?? 0

  return NextResponse.json({ success: true, count })
}

export const GET = withErrorLogging('/api/v2/admin/feedback/open-count', _GET)
