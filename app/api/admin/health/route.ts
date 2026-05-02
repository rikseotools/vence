// app/api/admin/health/route.ts
// Health endpoint para monitorización externa (UptimeRobot, BetterStack, etc.)
// Devuelve métricas de capacidad y backlog del sistema.
// Auth: Bearer ${CRON_SECRET} (mismo patrón que crons; el monitor externo usa el mismo).

import { NextResponse, type NextRequest } from 'next/server'
import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const maxDuration = 10
export const dynamic = 'force-dynamic'

interface HealthMetrics {
  status: 'ok' | 'degraded' | 'critical'
  timestamp: string
  uptime_check: 'pong'
  metrics: {
    dirty_questions: {
      pending: number
      oldest_age_minutes: number | null
      threshold_warning: number
      threshold_critical: number
    }
    db: {
      connected: boolean
      latency_ms: number | null
    }
  }
}

// Thresholds: si dirty > critical, alertar inmediatamente
const DIRTY_WARNING = 2000
const DIRTY_CRITICAL = 5000

async function _GET(request: NextRequest): Promise<NextResponse<HealthMetrics | { success: false; error: string }>> {
  const authHeader = request.headers.get('authorization')
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const db = getAdminDb()
  const t0 = Date.now()

  try {
    // Una sola query con CTE para minimizar round-trips
    const result = await db.execute(sql`
      WITH dirty_stats AS (
        SELECT
          count(*)::int AS pending,
          EXTRACT(EPOCH FROM (now() - min(updated_at)))::int / 60 AS oldest_age_minutes
        FROM questions WHERE stats_dirty = true
      )
      SELECT pending, oldest_age_minutes FROM dirty_stats
    `)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (result as any)[0] as { pending: number; oldest_age_minutes: number | null }
    const dbLatencyMs = Date.now() - t0
    const pending = Number(row?.pending ?? 0)

    let status: 'ok' | 'degraded' | 'critical' = 'ok'
    if (pending >= DIRTY_CRITICAL) status = 'critical'
    else if (pending >= DIRTY_WARNING) status = 'degraded'

    const body: HealthMetrics = {
      status,
      timestamp: new Date().toISOString(),
      uptime_check: 'pong',
      metrics: {
        dirty_questions: {
          pending,
          oldest_age_minutes: row?.oldest_age_minutes ?? null,
          threshold_warning: DIRTY_WARNING,
          threshold_critical: DIRTY_CRITICAL,
        },
        db: {
          connected: true,
          latency_ms: dbLatencyMs,
        },
      },
    }

    // HTTP status: 200 si ok/degraded, 503 si critical (UptimeRobot detecta)
    return NextResponse.json(body, {
      status: status === 'critical' ? 503 : 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Health check failed',
      },
      { status: 503 }
    )
  }
}

export const GET = withErrorLogging('/api/admin/health', _GET)
