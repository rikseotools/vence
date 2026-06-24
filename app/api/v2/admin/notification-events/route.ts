// app/api/v2/admin/notification-events/route.ts
// Eventos push + email (con perfil del usuario) para /admin/notificaciones/events.
// Datos de TODOS los usuarios → tier admin.
//
// AGNÓSTICO (Fase C1): sustituye 2 supabase.from con embed user_profiles!inner por
// Drizzle detrás de requireAdmin. Reconstruye el embed con JOIN + json_build_object
// (inner join = excluye eventos sin perfil, igual que !inner). La agregación de
// estadísticas se queda en el cliente sobre estos arrays.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 20

function rowsOf(res: unknown): unknown[] {
  return Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
}

async function _GET(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  const daysParam = Number(new URL(request.url).searchParams.get('days'))
  const days = Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 365 ? Math.floor(daysParam) : 30
  const db = getAdminDb()

  const pushEvents = rowsOf(await db.execute(sql`
    SELECT ne.*,
      json_build_object('email', up.email, 'created_at', up.created_at, 'plan_type', up.plan_type) AS user_profiles
    FROM notification_events ne
    JOIN user_profiles up ON up.id = ne.user_id
    WHERE ne.created_at >= now() - (${days}::int * interval '1 day')
    ORDER BY ne.created_at DESC
  `))
  const emailEvents = rowsOf(await db.execute(sql`
    SELECT ee.*,
      json_build_object('email', up.email, 'created_at', up.created_at, 'plan_type', up.plan_type) AS user_profiles
    FROM email_events ee
    JOIN user_profiles up ON up.id = ee.user_id
    WHERE ee.created_at >= now() - (${days}::int * interval '1 day')
    ORDER BY ee.created_at DESC
  `))

  return NextResponse.json({ success: true, pushEvents, emailEvents })
}

export const GET = withErrorLogging('/api/v2/admin/notification-events', _GET)
