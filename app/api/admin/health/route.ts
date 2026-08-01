// app/api/admin/health/route.ts
// Health endpoint AMPLIADO para monitorización y diagnóstico de incidentes.
// Una sola request devuelve TODA la info necesaria para diagnosticar en 30s
// cualquier saturación o lentitud.
//
// Para usar hacen falta LAS DOS cabeceras (comprobado en vivo el 01/08/2026, T-442):
//
//   curl -H "x-cron-secret: $CRON_SECRET" -H "Authorization: Bearer $CRON_SECRET" \\
//        https://www.vence.es/api/admin/health
//
// Por qué dos: `/api/admin/*` pasa antes por el guard del proxy edge
// (`lib/security/adminApiGuard.ts`), que acepta `x-cron-secret` pero por
// `Authorization: Bearer` espera un JWT de ADMIN, no el CRON_SECRET — así que con solo
// el Bearer te rechaza con «Token inválido» ANTES de llegar aquí. Y una vez dentro,
// esta ruta hace además su propia comprobación del Bearer. Aquí ponía solo el Bearer,
// y llevaba tiempo sin funcionar: quien viniera a diagnosticar un incidente se comía un
// 401 y concluía que el endpoint estaba roto.
// Para monitorizar: UptimeRobot/BetterStack apuntando a este endpoint.

import { NextResponse, type NextRequest } from 'next/server'
import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const maxDuration = 15
export const dynamic = 'force-dynamic'

interface HealthMetrics {
  status: 'ok' | 'degraded' | 'critical'
  timestamp: string
  uptime_check: 'pong'
  metrics: {
    db: {
      connected: boolean
      latency_ms: number | null
      active_connections: number
      idle_connections: number
      total_connections: number
      max_connections: number
      idle_in_transaction: number
      slow_queries: { count: number; oldest_secs: number | null }
      pending_locks: number
    }
    queues: {
      stats_dirty_pending: number
      stats_oldest_age_minutes: number | null
    }
    crons: Array<{
      cron_name: string
      last_run: string | null
      last_status: string | null
      last_duration_ms: number | null
      last_processed: number | null
      last_error: string | null
      runs_last_hour: number
      errors_last_hour: number
    }>
    incidents: {
      currently_running_long_crons: Array<{
        cron_name: string
        started_at: string
        secs_running: number
      }>
      recent_errors: Array<{
        cron_name: string
        ended_at: string
        error_message: string | null
      }>
    }
  }
}

const DIRTY_WARNING = 2000
const DIRTY_CRITICAL = 5000
const SLOW_QUERY_WARNING_SECS = 30
const STALE_DIRTY_WARNING_MIN = 30

async function _GET(request: NextRequest): Promise<NextResponse<HealthMetrics | { success: false; error: string }>> {
  const authHeader = request.headers.get('authorization')
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const db = getAdminDb()
  const t0 = Date.now()

  try {
    // Una mega-query con 4 CTEs para minimizar round-trips
    const [dbStats, dirtyStats, cronStats, incidents] = await Promise.all([
      // DB stats
      db.execute(sql`
        SELECT
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_conn,
          count(*) FILTER (WHERE state = 'active') AS active,
          count(*) FILTER (WHERE state = 'idle') AS idle,
          count(*) FILTER (WHERE state = 'idle in transaction') AS idle_tx,
          count(*) AS total,
          (SELECT count(*) FROM pg_locks WHERE NOT granted) AS pending_locks,
          (SELECT count(*) FROM pg_stat_activity
           WHERE state = 'active'
           AND now() - query_start > interval '${sql.raw(String(SLOW_QUERY_WARNING_SECS))} seconds'
           AND pid <> pg_backend_pid()) AS slow_count,
          (SELECT EXTRACT(EPOCH FROM (now() - min(query_start)))::int FROM pg_stat_activity
           WHERE state = 'active'
           AND now() - query_start > interval '${sql.raw(String(SLOW_QUERY_WARNING_SECS))} seconds'
           AND pid <> pg_backend_pid()) AS oldest_slow_secs
        FROM pg_stat_activity WHERE datname = current_database()
      `),
      // Dirty queues
      // NOTA (2026-05-23): la columna global_dirty quedó obsoleta tras la
      // Fase 2-bis (trigger nuevo apply_first_attempt_to_question_stats
      // recalcula global_difficulty incremental). El DROP COLUMN está
      // pendiente — esta query ya no la lee para no romper cuando se
      // dropee. Ver docs/ARCHITECTURE_ROADMAP.md sección Fase 2-bis.
      db.execute(sql`
        SELECT
          count(*) FILTER (WHERE stats_dirty = true) AS stats_pending,
          EXTRACT(EPOCH FROM (now() - min(updated_at) FILTER (WHERE stats_dirty = true)))::int / 60 AS stats_oldest_min
        FROM questions WHERE stats_dirty = true
      `),
      // Crons: último run + agregados última hora por cron.
      //
      // ⚠️ LEE `observable_events`, NO la tabla `cron_runs` (T-442). Los crons se mudaron a los
      // `@Cron` del backend, que emiten `event_type='cron_run'`; la tabla se quedó sin escritor
      // el 24/05/2026 y nadie lo notó porque esta consulta no fallaba: devolvía CERO filas, y el
      // panel pintaba cero crons y cero incidencias — que se lee igual que «todo bien». Dos meses.
      //
      // El nombre del cron va en `endpoint`: `metadata->>'cron'` falta en algunos y agrupar por él
      // los perdería en silencio, que es justo el fallo que esto viene a cerrar.
      db.execute(sql`
        WITH latest AS (
          SELECT DISTINCT ON (endpoint)
            endpoint AS cron_name, created_at AS started_at, severity,
            metadata->>'status' AS status,
            COALESCE((metadata->>'executionTimeMs')::numeric,
                     (metadata->>'durationSeconds')::numeric * 1000)::int AS duration_ms,
            (metadata->>'processed')::int AS processed,
            error_message
          FROM observable_events
          WHERE event_type = 'cron_run' AND created_at > now() - interval '6 hours'
          ORDER BY endpoint, created_at DESC
        ),
        hourly AS (
          SELECT endpoint AS cron_name,
                 count(*) AS runs,
                 count(*) FILTER (WHERE severity = 'error'
                                    OR metadata->>'status' NOT IN ('success','completed','heartbeat')) AS errors
          FROM observable_events
          WHERE event_type = 'cron_run' AND created_at > now() - interval '1 hour'
          GROUP BY endpoint
        )
        SELECT l.cron_name,
               l.started_at AS last_run,
               l.status AS last_status,
               l.duration_ms AS last_duration_ms,
               l.processed AS last_processed,
               l.error_message AS last_error,
               COALESCE(h.runs, 0) AS runs_last_hour,
               COALESCE(h.errors, 0) AS errors_last_hour
        FROM latest l
        LEFT JOIN hourly h ON h.cron_name = l.cron_name
        ORDER BY l.cron_name
      `),
      // Incidencias de crons (T-442: también desde `observable_events`).
      //
      // `long_running` se queda VACÍO a propósito y no se sustituye por una aproximación: los
      // `@Cron` emiten UN evento al terminar, así que no existe el estado «arrancó y sigue
      // corriendo» que la tabla vieja modelaba con `status='running'`. Inventar un equivalente
      // (p.ej. «lleva mucho sin emitir») mezclaría «tarda demasiado» con «se murió», que son
      // averías distintas — eso lo dice el canario del registro, no este panel.
      db.execute(sql`
        SELECT
          '[]'::json AS long_running,
          (SELECT json_agg(row_to_json(r)) FROM (
            SELECT endpoint AS cron_name, created_at AS ended_at, error_message
            FROM observable_events
            WHERE event_type = 'cron_run'
              AND (severity = 'error'
                   OR metadata->>'status' NOT IN ('success','completed','heartbeat'))
              AND created_at > now() - interval '24 hours'
            ORDER BY created_at DESC LIMIT 10
          ) r) AS recent_errors
      `),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbRow = (dbStats as any)[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dirtyRow = (dirtyStats as any)[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cronsRows = (cronStats as any[]) ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const incRow = (incidents as any)[0]

    const dbLatency = Date.now() - t0
    const statsPending = Number(dirtyRow?.stats_pending ?? 0)
    const totalDirty = statsPending

    // Determinar status global
    let status: 'ok' | 'degraded' | 'critical' = 'ok'
    if (totalDirty >= DIRTY_CRITICAL || Number(dbRow?.pending_locks ?? 0) > 5) status = 'critical'
    else if (totalDirty >= DIRTY_WARNING || Number(dbRow?.idle_tx ?? 0) > 5) status = 'degraded'
    if (Number(dirtyRow?.stats_oldest_min ?? 0) > STALE_DIRTY_WARNING_MIN) status = status === 'ok' ? 'degraded' : status

    const body: HealthMetrics = {
      status,
      timestamp: new Date().toISOString(),
      uptime_check: 'pong',
      metrics: {
        db: {
          connected: true,
          latency_ms: dbLatency,
          active_connections: Number(dbRow?.active ?? 0),
          idle_connections: Number(dbRow?.idle ?? 0),
          total_connections: Number(dbRow?.total ?? 0),
          max_connections: Number(dbRow?.max_conn ?? 0),
          idle_in_transaction: Number(dbRow?.idle_tx ?? 0),
          slow_queries: {
            count: Number(dbRow?.slow_count ?? 0),
            oldest_secs: dbRow?.oldest_slow_secs != null ? Number(dbRow.oldest_slow_secs) : null,
          },
          pending_locks: Number(dbRow?.pending_locks ?? 0),
        },
        queues: {
          stats_dirty_pending: statsPending,
          stats_oldest_age_minutes: dirtyRow?.stats_oldest_min != null ? Number(dirtyRow.stats_oldest_min) : null,
        },
        crons: cronsRows.map(r => ({
          cron_name: String(r.cron_name),
          last_run: r.last_run ? new Date(r.last_run as string).toISOString() : null,
          last_status: r.last_status as string | null,
          last_duration_ms: r.last_duration_ms != null ? Number(r.last_duration_ms) : null,
          last_processed: r.last_processed != null ? Number(r.last_processed) : null,
          last_error: r.last_error as string | null,
          runs_last_hour: Number(r.runs_last_hour ?? 0),
          errors_last_hour: Number(r.errors_last_hour ?? 0),
        })),
        incidents: {
          currently_running_long_crons: (incRow?.long_running as Array<{cron_name: string; started_at: string; secs_running: number}> | null) ?? [],
          recent_errors: (incRow?.recent_errors as Array<{cron_name: string; ended_at: string; error_message: string | null}> | null) ?? [],
        },
      },
    }

    return NextResponse.json(body, {
      status: status === 'critical' ? 503 : 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Health check failed' },
      { status: 503 }
    )
  }
}

export const GET = withErrorLogging('/api/admin/health', _GET)
