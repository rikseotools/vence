// app/api/admin/email-events/route.ts - Admin API for email events
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getEmailEvents } from '@/lib/api/admin-email-events'
import { emailEventsQuerySchema } from '@/lib/api/admin-email-events'
import { requireAdmin } from '@/lib/api/shared/auth'
import { getDb } from '@/db/client'

import { withErrorLogging } from '@/lib/api/withErrorLogging'

// Fila que devuelve get_subscription_count() (misma fn en RDS, agnóstico).
type SubCountRow = { suscritos: number; no_suscritos: number; total: number }
function rowsOf(res: unknown): unknown[] {
  return Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
}

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  try {
    const { searchParams } = new URL(request.url)
    const parsed = emailEventsQuerySchema.safeParse({
      timeRange: searchParams.get('timeRange') ?? undefined,
    })

    const timeRange = parsed.success ? parsed.data.timeRange : 30

    const [events, subRes] = await Promise.all([
      getEmailEvents(timeRange),
      // Conteo de suscripción sobre el SSOT de RDS (user_profiles + email_preferences).
      // NOTA: NO se reutiliza la fn `get_subscription_count()` — es Supabase-específica
      // (cuenta desde auth.users.email_confirmed_at, columna que no existe en RDS y
      // cuya tabla está vacía). En RDS los usuarios viven en user_profiles.
      getDb()
        .execute(sql`
          SELECT
            count(*) FILTER (WHERE ep.unsubscribed_all IS NULL OR ep.unsubscribed_all = false)::int AS suscritos,
            count(*) FILTER (WHERE ep.unsubscribed_all = true)::int AS no_suscritos,
            count(*)::int AS total
          FROM user_profiles up
          LEFT JOIN email_preferences ep ON ep.user_id = up.id
        `)
        .catch((e: unknown) => {
          console.warn('⚠️ Error getting subscription count:', e)
          return [] as unknown
        }),
    ])

    const subscriptionCount = (rowsOf(subRes)[0] as SubCountRow | undefined)

    return NextResponse.json({
      events,
      subscriptionCount: subscriptionCount ?? { suscritos: 0, no_suscritos: 0, total: 0 },
      totalEvents: events.length,
      timeRange: String(timeRange),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('❌ [API/admin/email-events] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// (POST eliminado 2026-06-20: handler muerto —0 callers— que usaba la RPC
//  is_user_admin/auth.uid(), no portable. El único uso del endpoint es el GET.)

export const GET = withErrorLogging('/api/admin/email-events', _GET)
