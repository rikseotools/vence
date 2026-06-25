// app/api/v2/admin/notification-overview/route.ts
// Datos para /admin/notificaciones/overview: eventos push + email + métricas por
// usuario, enriquecidos con el perfil. Datos de TODOS los usuarios → tier admin.
//
// AGNÓSTICO (Fase C1): sustituye 4 supabase.from de cliente por Drizzle detrás de
// requireAdmin. Devuelve los eventos YA enriquecidos con user_profiles (igual que
// hacía el cliente); la agregación (hourly/weekly/device/summary) se queda en el
// cliente sobre estos arrays (lógica intacta, sin divergencia).
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { pgUuidArray } from '@/lib/api/sqlArrays'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 20

function rowsOf(res: unknown): Array<Record<string, unknown>> {
  return (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []) as Array<Record<string, unknown>>
}

async function _GET(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  const daysParam = Number(new URL(request.url).searchParams.get('days'))
  const days = Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 365 ? Math.floor(daysParam) : 30
  const db = getAdminDb()

  const pushEvents = rowsOf(await db.execute(sql`
    SELECT * FROM notification_events WHERE created_at >= now() - (${days}::int * interval '1 day') ORDER BY created_at DESC
  `))
  const emailEvents = rowsOf(await db.execute(sql`
    SELECT * FROM email_events WHERE created_at >= now() - (${days}::int * interval '1 day') ORDER BY created_at DESC
  `))
  const userMetrics = rowsOf(await db.execute(sql`
    SELECT * FROM user_notification_metrics ORDER BY overall_engagement_score DESC
  `))

  // Perfiles para la unión de user_ids (enriquecimiento, igual que el cliente)
  const ids = [...new Set([
    ...pushEvents.map(e => e.user_id),
    ...emailEvents.map(e => e.user_id),
    ...userMetrics.map(m => m.user_id),
  ].filter(Boolean) as string[])]

  const profiles = ids.length
    ? rowsOf(await db.execute(sql`
        SELECT id, email, created_at, plan_type, registration_source
        FROM user_profiles WHERE id = ANY(${pgUuidArray(ids)})
      `))
    : []
  const map = new Map(profiles.map(p => [p.id, p]))
  const enrich = (arr: Array<Record<string, unknown>>, key: string) =>
    arr.map(x => ({ ...x, user_profiles: map.get(x[key] as string) ?? null }))

  return NextResponse.json({
    success: true,
    pushEvents: enrich(pushEvents, 'user_id'),
    emailEvents: enrich(emailEvents, 'user_id'),
    userMetrics: enrich(userMetrics, 'user_id'),
  })
}

export const GET = withErrorLogging('/api/v2/admin/notification-overview', _GET)
