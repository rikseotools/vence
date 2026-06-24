// app/api/v2/admin/notification-users/route.ts
// Lista de usuarios con sus métricas de notificación + perfil + conteo de eventos
// recientes (30d) para /admin/notificaciones/users. Tier admin.
//
// AGNÓSTICO (Fase C1): sustituye 4 supabase.from de cliente por Drizzle detrás de
// requireAdmin. Los conteos se hacen con COUNT/GROUP BY en SQL (exacto, sin la
// agregación-en-cliente del original) y devuelve los usuarios ya enriquecidos.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
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
  const db = getAdminDb()

  const metrics = rowsOf(await db.execute(sql`
    SELECT * FROM user_notification_metrics ORDER BY overall_engagement_score DESC
  `))
  const ids = [...new Set(metrics.map(m => m.user_id).filter(Boolean) as string[])]

  const profiles = ids.length ? rowsOf(await db.execute(sql`
    SELECT id, email, created_at, plan_type, registration_source, requires_payment, stripe_customer_id
    FROM user_profiles WHERE id = ANY(${ids}::uuid[])
  `)) : []
  const profileMap = new Map(profiles.map(p => [p.id, p]))

  // Conteos de eventos recientes (30d) por usuario, exacto vía GROUP BY
  const pushCounts = rowsOf(await db.execute(sql`
    SELECT user_id, COUNT(*)::int AS n FROM notification_events
    WHERE created_at >= now() - interval '30 days' GROUP BY user_id
  `))
  const emailCounts = rowsOf(await db.execute(sql`
    SELECT user_id, COUNT(*)::int AS n FROM email_events
    WHERE created_at >= now() - interval '30 days' GROUP BY user_id
  `))
  const pushMap = new Map(pushCounts.map(r => [r.user_id, Number(r.n)]))
  const emailMap = new Map(emailCounts.map(r => [r.user_id, Number(r.n)]))

  const users = metrics.map(m => {
    const push = pushMap.get(m.user_id) || 0
    const email = emailMap.get(m.user_id) || 0
    return {
      ...m,
      user_profiles: profileMap.get(m.user_id) ?? null,
      recentPushEvents: push,
      recentEmailEvents: email,
      totalRecentEvents: push + email,
    }
  })

  return NextResponse.json({ success: true, users })
}

export const GET = withErrorLogging('/api/v2/admin/notification-users', _GET)
