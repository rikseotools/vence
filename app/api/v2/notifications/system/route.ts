// app/api/v2/notifications/system/route.ts
// Notificaciones de sistema no abiertas del usuario AUTENTICADO (últimos 30d).
// useIntelligentNotifications.loadSystemNotifications.
//
// AGNÓSTICO (Fase C1): sustituye supabase.from('notification_logs') de cliente.
// user_id del TOKEN. Devuelve filas crudas; el mapeo (context_data, fallbacks) se
// queda en el cliente.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/notifications/system')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const res = await getAdminDb().execute(sql`
    SELECT * FROM notification_logs
    WHERE user_id = ${auth.userId}::uuid AND opened_at IS NULL
      AND created_at >= now() - interval '30 days'
    ORDER BY created_at DESC
  `)
  const notifications = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
  return NextResponse.json({ success: true, notifications })
}

export const GET = withErrorLogging('/api/v2/notifications/system', _GET)
