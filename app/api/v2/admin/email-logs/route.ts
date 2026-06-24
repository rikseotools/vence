// app/api/v2/admin/email-logs/route.ts
// Historial de emails enviados (últimos 50) para /admin/configuracion. Datos de
// todos los usuarios → tier admin.
//
// AGNÓSTICO (Fase C1): sustituye el supabase.from('email_logs') con embed de cliente
// por Drizzle detrás de requireAdmin. Reconstruye el embed user_profiles!inner(email,
// full_name) con un JOIN + json_build_object (FK email_logs.user_id → user_profiles.id).
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
    SELECT el.*,
      json_build_object('email', up.email, 'full_name', up.full_name) AS user_profiles
    FROM email_logs el
    JOIN user_profiles up ON up.id = el.user_id
    ORDER BY el.sent_at DESC
    LIMIT 50
  `)
  const logs = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []

  return NextResponse.json({ success: true, logs })
}

export const GET = withErrorLogging('/api/v2/admin/email-logs', _GET)
