// app/api/admin/observability/route.ts
// Dashboard admin de observabilidad — Bloque 4 Gap 9.
//
// Complementa /admin/salud-sistema (que responde "¿hay fuego?") con una vista
// detallada de qué pasa en el sistema:
//   - Volumen eventos por source/event_type/severity
//   - Top errores recientes con stack
//   - Endpoints lentos (p50/p95/p99)
//   - Eventos client-side (hydration, tts, intent_unfulfilled, web_vital_degraded)
//   - Sample evento por categoría
//
// Soporta `?window=1h|6h|24h|7d` (default 6h).

import { NextRequest, NextResponse } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { requireAdmin } from '@/lib/api/shared/auth'
import { getAdminDb } from '@/db/client'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

type WindowKey = '1h' | '6h' | '24h' | '7d'
const WINDOW_HOURS: Record<WindowKey, number> = {
  '1h': 1,
  '6h': 6,
  '24h': 24,
  '7d': 24 * 7,
}

function parseWindow(raw: string | null): WindowKey {
  if (raw && raw in WINDOW_HOURS) return raw as WindowKey
  return '6h'
}

async function _GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const window = parseWindow(request.nextUrl.searchParams.get('window'))
  const windowHours = WINDOW_HOURS[window]
  const db = getAdminDb()

  // Consulta única con múltiples agregaciones via Drizzle execute
  // (más eficiente que N queries paralelas por window).
  const [
    bySourceAndSeverity,
    byEventType,
    topErrors,
    slowEndpoints,
    clientSideEvents,
    timeseries,
    totalCount,
  ] = await Promise.all([
    // 1) Volumen por source + severity
    db.execute(sql`
      SELECT source, severity, COUNT(*)::int AS n
      FROM public.observable_events
      WHERE ts > NOW() - (${windowHours}::int * INTERVAL '1 hour')
      GROUP BY source, severity
      ORDER BY n DESC
    `),

    // 2) Top event_types
    db.execute(sql`
      SELECT event_type, severity, COUNT(*)::int AS n, MAX(ts) AS last_ts
      FROM public.observable_events
      WHERE ts > NOW() - (${windowHours}::int * INTERVAL '1 hour')
      GROUP BY event_type, severity
      ORDER BY n DESC
      LIMIT 30
    `),

    // 3) Top errores recientes (con sample)
    db.execute(sql`
      SELECT
        endpoint, event_type, severity, http_status,
        COUNT(*)::int AS n,
        MAX(ts) AS last_ts,
        (ARRAY_AGG(error_message ORDER BY ts DESC))[1] AS sample_message
      FROM public.observable_events
      WHERE ts > NOW() - (${windowHours}::int * INTERVAL '1 hour')
        AND severity IN ('error', 'critical')
      GROUP BY endpoint, event_type, severity, http_status
      ORDER BY n DESC
      LIMIT 20
    `),

    // 4) Endpoints más lentos (p50/p95/p99)
    db.execute(sql`
      SELECT
        endpoint,
        COUNT(*)::int AS n,
        AVG(duration_ms)::int AS avg_ms,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms)::int AS p50_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::int AS p95_ms,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms)::int AS p99_ms,
        MAX(duration_ms) AS max_ms
      FROM public.observable_events
      WHERE ts > NOW() - (${windowHours}::int * INTERVAL '1 hour')
        AND duration_ms IS NOT NULL
        AND duration_ms > 200
      GROUP BY endpoint
      HAVING COUNT(*) > 3
      ORDER BY p95_ms DESC
      LIMIT 15
    `),

    // 5) Eventos client-side (source=frontend)
    db.execute(sql`
      SELECT event_type, severity, COUNT(*)::int AS n, MAX(ts) AS last_ts
      FROM public.observable_events
      WHERE ts > NOW() - (${windowHours}::int * INTERVAL '1 hour')
        AND source = 'frontend'
      GROUP BY event_type, severity
      ORDER BY n DESC
      LIMIT 20
    `),

    // 6) Timeseries por hora (para gráfica)
    db.execute(sql`
      SELECT
        date_trunc('hour', ts)::timestamptz AS hour,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE severity = 'error')::int AS errors,
        COUNT(*) FILTER (WHERE severity = 'critical')::int AS critical,
        COUNT(*) FILTER (WHERE http_status >= 500)::int AS s5xx,
        COUNT(*) FILTER (WHERE http_status BETWEEN 200 AND 299)::int AS s2xx
      FROM public.observable_events
      WHERE ts > NOW() - (${windowHours}::int * INTERVAL '1 hour')
      GROUP BY 1 ORDER BY 1
    `),

    // 7) Total
    db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM public.observable_events
      WHERE ts > NOW() - (${windowHours}::int * INTERVAL '1 hour')
    `),
  ])

  return NextResponse.json({
    success: true,
    generatedAt: new Date().toISOString(),
    window,
    windowHours,
    total: (totalCount as unknown as Array<{ total: number }>)[0]?.total ?? 0,
    bySourceAndSeverity: bySourceAndSeverity as unknown,
    byEventType: byEventType as unknown,
    topErrors: topErrors as unknown,
    slowEndpoints: slowEndpoints as unknown,
    clientSideEvents: clientSideEvents as unknown,
    timeseries: timeseries as unknown,
  })
}

export const GET = withErrorLogging('/api/admin/observability', _GET as any)
