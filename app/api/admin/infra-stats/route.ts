// app/api/admin/infra-stats/route.ts - Estadísticas de infraestructura BD y carga
import { NextRequest, NextResponse } from 'next/server'
import { Client as PgClient } from 'pg'
import { getDb } from '@/db/client'
import { sql, eq, gte, or, like, desc } from 'drizzle-orm'
import {
  userSessions,
  dailyQuestionUsage,
  validationErrorLogs,
} from '@/db/schema'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

// Timeout 30s para que Vercel no haga timeout antes de devolver al menos
// resultados parciales si hay congestion en Supavisor.
export const maxDuration = 30

/**
 * Conecta a la admin DB de PgBouncer (puerto 6543, dbname=pgbouncer) y
 * ejecuta SHOW POOLS / SHOW STATS_TOTALS / SHOW MEM. Devuelve null si la
 * conexión o cualquier query falla — no bloquea el endpoint.
 *
 * Solo funciona si DATABASE_URL_SELF_POOLER está configurada (modo canary
 * activo). Si no, devolvemos null y el frontend muestra "no disponible".
 */
async function getPgbouncerAdminStats(): Promise<{
  pools: Array<{
    database: string; user: string;
    cl_active: number; cl_waiting: number;
    sv_active: number; sv_idle: number; sv_used: number;
    maxwait: number; maxwait_us: number;
    pool_mode: string;
  }>
  stats: Array<{
    database: string; xact_count: number; query_count: number;
    bytes_received: number; bytes_sent: number;
    query_time_us: number; wait_time_us: number;
  }>
  memory: Array<{ name: string; used: number; total: number }>
} | null> {
  const url = process.env.DATABASE_URL_SELF_POOLER
  if (!url) return null

  // Reescribimos el DSN para apuntar a la admin DB pgbouncer
  const adminUrl = url.replace(/\/postgres(\?|$)/, '/pgbouncer$1')

  // CRÍTICO: usamos pg (node-postgres) en lugar de postgres-js porque
  // pgbouncer admin console NO soporta extended query protocol (que postgres-js
  // usa por defecto incluso con prepare:false). El pg client usa simple
  // protocol que pgbouncer admin sí acepta. Verificado 2026-05-10.
  const client = new PgClient({
    connectionString: adminUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 3000,
    statement_timeout: 3000,
  })

  try {
    await client.connect()
    // Queries secuenciales — el admin console de pgbouncer no maneja paralelismo
    // bien (errores 08P01 protocol violation con queries concurrentes).
    const pools = await client.query('SHOW POOLS')
    const statsRows = await client.query('SHOW STATS_TOTALS')
    const memRows = await client.query('SHOW MEM')

    return {
      pools: pools.rows.map((r: any) => ({
        database: r.database,
        user: r.user,
        cl_active: Number(r.cl_active ?? 0),
        cl_waiting: Number(r.cl_waiting ?? 0),
        sv_active: Number(r.sv_active ?? 0),
        sv_idle: Number(r.sv_idle ?? 0),
        sv_used: Number(r.sv_used ?? 0),
        maxwait: Number(r.maxwait ?? 0),
        maxwait_us: Number(r.maxwait_us ?? 0),
        pool_mode: r.pool_mode ?? 'transaction',
      })),
      stats: statsRows.rows.map((r: any) => ({
        database: r.database,
        xact_count: Number(r.xact_count ?? 0),
        query_count: Number(r.query_count ?? 0),
        bytes_received: Number(r.bytes_received ?? 0),
        bytes_sent: Number(r.bytes_sent ?? 0),
        query_time_us: Number(r.query_time ?? 0),
        wait_time_us: Number(r.wait_time ?? 0),
      })),
      memory: memRows.rows.map((r: any) => ({
        name: r.name,
        used: Number(r.used ?? 0),
        total: Number(r.size ?? 0),
      })),
    }
  } catch (err) {
    console.warn('[infra-stats] getPgbouncerAdminStats failed:', err instanceof Error ? err.message : err)
    return null
  } finally {
    await client.end().catch(() => {})
  }
}

// Cada query del Promise.all tiene su propio timeout. Si una cuelga,
// devolvemos null para esa y el resto se sirve normalmente. Mejor mostrar
// dashboard parcial que infinite spinner.
async function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T | null> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn(`[infra-stats] timeout en query: ${label}`)
        resolve(null)
      }, ms),
    ),
  ])
}

const ADMIN_EMAILS = [
  'admin@vencemitfg.es',
  'manuel@vencemitfg.es',
  'manueltrader@gmail.com',
]

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email) || email.endsWith('@vencemitfg.es')
}

async function _GET(request: NextRequest) {
  try {
    // Auth (wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuth(request, '/api/admin/infra-stats')
    if (!auth.success) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!isAdmin(auth.email)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Migración 27/05/2026 (Fase 3 strangler fig agnosticismo-supabase):
    // antes este endpoint mantenía un cliente Supabase paralelo a Drizzle para
    // 3 queries específicas (user_sessions, daily_question_usage,
    // validation_error_logs). Ahora todo usa Drizzle (single source of truth)
    // y elimina el último uso de SERVICE_ROLE_KEY en este archivo.
    const db = getDb()
    const today = new Date().toISOString().split('T')[0]
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Queries en paralelo, cada una con su propio timeout para resiliencia.
    // Si una cuelga (Supavisor blip), devolvemos null y las demás siguen.
    const [
      connResult,
      connByStateResult,
      connByAppResult,
      sessionsResult,
      usageResult,
      errorsResult,
      peakResult,
      canaryStatsResult,
      endpointStatsResult,
      pgbouncerStats,
    ] = await Promise.all([
      // 1. Max connections + total (5s — pg_stat_activity puede ser pesada)
      withTimeout(db.execute(sql`
        SELECT
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
          (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database()) as total_connections
      `), 5000, 'max_connections'),

      // 2. Connections by state (5s)
      withTimeout(db.execute(sql`
        SELECT state, count(*)::int as count
        FROM pg_stat_activity
        WHERE datname = current_database()
        GROUP BY state
        ORDER BY count DESC
      `), 5000, 'connections_by_state'),

      // 3. Connections by application (5s)
      withTimeout(db.execute(sql`
        SELECT
          COALESCE(application_name, '(none)') as app,
          state,
          count(*)::int as count
        FROM pg_stat_activity
        WHERE datname = current_database()
        GROUP BY application_name, state
        ORDER BY count DESC
        LIMIT 15
      `), 5000, 'connections_by_app'),

      // 4. Sessions today — count via Drizzle (5s)
      withTimeout(db.select({ count: sql<number>`count(*)::int` })
        .from(userSessions)
        .where(gte(userSessions.sessionStart, sql`${`${today}T00:00:00`}::timestamptz`)),
        5000, 'sessions_today'),

      // 5. Users and questions today — Drizzle (5s)
      withTimeout(db.select({
        userId: dailyQuestionUsage.userId,
        questionsAnswered: dailyQuestionUsage.questionsAnswered,
      })
        .from(dailyQuestionUsage)
        .where(eq(dailyQuestionUsage.usageDate, today)),
        5000, 'usage_today'),

      // 6. Recent connection errors — Drizzle con OR + ILIKE (5s)
      withTimeout(db.select({
        endpoint: validationErrorLogs.endpoint,
        errorMessage: validationErrorLogs.errorMessage,
        createdAt: validationErrorLogs.createdAt,
      })
        .from(validationErrorLogs)
        .where(or(
          like(validationErrorLogs.errorMessage, '%timeout%'),
          like(validationErrorLogs.errorMessage, '%too many%'),
          like(validationErrorLogs.errorMessage, '%connect%'),
        ))
        .orderBy(desc(validationErrorLogs.createdAt))
        .limit(10),
        5000, 'recent_errors'),

      // 7. Peak concurrent sessions today — calculado en SQL en vez de
      // traer todas las sesiones a memoria (5k+ rows hacían timeout @8s).
      // Usa window function: marca eventos +1 (start) / -1 (end), suma corriente, MAX.
      withTimeout(db.execute(sql`
        SELECT COALESCE(MAX(concurrent_count), 0)::int AS peak FROM (
          SELECT SUM(delta) OVER (ORDER BY moment) AS concurrent_count
          FROM (
            SELECT session_start AS moment, 1 AS delta FROM public.user_sessions
              WHERE session_start >= ${`${today}T00:00:00Z`}::timestamptz
            UNION ALL
            SELECT session_end AS moment, -1 AS delta FROM public.user_sessions
              WHERE session_end IS NOT NULL AND session_start >= ${`${today}T00:00:00Z`}::timestamptz
          ) events
        ) s
      `), 5000, 'peak_concurrent'),

      // 8. Canary stats — 5xx por endpoint (1h y 24h) (5s)
      withTimeout(db.execute(sql`
        SELECT endpoint,
               count(*) FILTER (WHERE created_at >= ${oneHourAgo}::timestamptz)::int AS errors_1h,
               count(*) FILTER (WHERE created_at >= ${twentyFourHoursAgo}::timestamptz)::int AS errors_24h
        FROM public.validation_error_logs
        WHERE http_status >= 500
          AND created_at >= ${twentyFourHoursAgo}::timestamptz
        GROUP BY endpoint
        ORDER BY errors_24h DESC
      `), 5000, 'canary_stats'),

      // 9. Stats por endpoint (todos los logueados, no solo 5xx) — 24h.
      // Timeout 8s porque validation_error_logs puede tener miles de rows en 24h
      // (incluye 4xx que son frecuentes — validaciones de clientes/bots).
      // duration_ms solo se loguea en errores, así que esto es duración de errores.
      withTimeout(db.execute(sql`
        SELECT endpoint,
               count(*)::int AS total_errors_24h,
               count(*) FILTER (WHERE http_status >= 500)::int AS errors_5xx_24h,
               count(*) FILTER (WHERE http_status >= 400 AND http_status < 500)::int AS errors_4xx_24h,
               coalesce(round(avg(duration_ms))::int, 0) AS avg_duration_ms,
               coalesce(max(duration_ms), 0) AS max_duration_ms
        FROM public.validation_error_logs
        WHERE created_at >= ${twentyFourHoursAgo}::timestamptz
          AND endpoint IS NOT NULL
        GROUP BY endpoint
        ORDER BY errors_5xx_24h DESC, total_errors_24h DESC
        LIMIT 30
      `), 8000, 'endpoint_stats'),

      // 10. PgBouncer admin stats (SHOW POOLS / STATS / MEM) — 4s
      withTimeout(getPgbouncerAdminStats(), 4000, 'pgbouncer_admin'),
    ])

    // Parse results — tolerante a null si alguna query timeoutó (con valores fallback "—")
    const connRows = connResult ? (Array.isArray(connResult) ? connResult : (connResult as any).rows || []) : []
    const maxConnections = connRows[0]?.max_connections ?? 0
    const totalConnections = connRows[0]?.total_connections ?? 0

    const stateRows = connByStateResult ? (Array.isArray(connByStateResult) ? connByStateResult : (connByStateResult as any).rows || []) : []
    const connectionsByState = stateRows.map((r: any) => ({
      state: r.state || 'null',
      count: r.count,
    }))

    const appRows = connByAppResult ? (Array.isArray(connByAppResult) ? connByAppResult : (connByAppResult as any).rows || []) : []
    const connectionsByApp = appRows.map((r: any) => ({
      app: (r.app || '(none)').substring(0, 40),
      state: r.state || 'null',
      count: r.count,
    }))

    // Drizzle devuelve arrays directos (no { data, count, error } como Supabase).
    // sessionsResult ahora es Array<{ count: number }>.
    const sessionsToday = sessionsResult?.[0]?.count ?? 0
    const usersToday = usageResult?.length ?? 0
    const questionsToday = usageResult?.reduce(
      (sum: number, a) => sum + (a.questionsAnswered || 0),
      0,
    ) ?? 0

    const recentErrors = (errorsResult || []).map((e) => ({
      endpoint: e.endpoint,
      message: e.errorMessage?.substring(0, 100),
      date: e.createdAt,
    }))

    // Peak concurrent sessions — ya calculado en SQL (refactor 2026-05-10)
    const peakRows = peakResult ? (Array.isArray(peakResult) ? peakResult : (peakResult as any).rows || []) : []
    const peakConcurrent = peakRows[0]?.peak ?? 0

    // Canary endpoints: lista de endpoints migrados al self-hosted pooler.
    // Cualquier endpoint NO listado aquí va contra Supavisor (path histórico).
    // Mantener sincronizado con docs/roadmap/self-hosted-pooler.md.
    //
    // ⚠️ Métodos parciales: validation_error_logs no guarda el método HTTP, así que
    // los contadores 5xx aquí agregan TODOS los métodos del endpoint. Endpoints
    // marcados aquí son aquellos donde la mayoría del tráfico (o el path crítico)
    // está en pooler. Endpoints con migración parcial significativa (ej:
    // /api/questions/filtered cuyo POST domina y aún no está migrado) se EXCLUYEN
    // hasta migrar todo, para no falsear el panel con 5xx ajenos al pooler.
    const CANARY_ENDPOINTS = new Set([
      '/api/ranking',                              // GET único
      '/api/medals',                               // GET migrado; POST minoritario
      '/api/questions/law-stats',                  // GET único
      '/api/v2/topic-progress/theme-stats',        // GET único
      '/api/notifications/problematic-articles',   // GET único
      '/api/v2/topic-progress/weak-articles',      // GET único
      '/api/topics/[numero]',                      // GET único (path canonical con [numero])
      '/api/v2/oposiciones-compatibles/progress',  // GET único (oleada 3, 2026-05-10)
      '/api/v2/user-stats',                        // GET único (oleada 4 urgente — blip 20:35)
      '/api/v2/answer-and-save',                   // WRITE (oleada 4 urgente — blip 20:35)
      '/api/answer/psychometric',                  // WRITE (oleada 4 urgente — blip 20:35)
      '/api/v2/official-exams/answer',             // WRITE (oleada 4 urgente — blip 20:35)
      '/api/questions/filtered',                   // POST + GET count (oleada 4 sweep — 240 5xx 24h)
      // Sweep masivo oleada 4 (lib/api migrated batch):
      '/api/v2/random-test-data',                  // (random-test-data/queries.ts)
      '/api/exam/[any]',                           // (exam/queries.ts cubre resume/discard/pending)
      '/api/v2/feedback/[any]',                    // (feedback/queries.ts)
      '/api/daily-limit',                          // (daily-limit/queries.ts)
      '/api/teoria/[any]',                         // (teoria/queries.ts)
      // Helpers transversales (oposicion-scope, topic-names): no son endpoints
      // pero sus queries van por el pooler ahora. No se listan en CANARY_ENDPOINTS
      // porque no aparecen como endpoints en validation_error_logs.
    ])

    const canaryRows = canaryStatsResult
      ? (Array.isArray(canaryStatsResult) ? canaryStatsResult : (canaryStatsResult as any).rows || [])
      : []
    const canaryStats = canaryRows.map((r: any) => ({
      endpoint: r.endpoint,
      errors1h: r.errors_1h ?? 0,
      errors24h: r.errors_24h ?? 0,
      inCanary: CANARY_ENDPOINTS.has(r.endpoint),
    }))

    // Resumen agregado: total 5xx canary vs total 5xx non-canary últimas 24h
    const canarySummary = canaryStats.reduce(
      (acc: { canaryErrors24h: number; canaryErrors1h: number; nonCanaryErrors24h: number; nonCanaryErrors1h: number }, r: any) => {
        if (r.inCanary) {
          acc.canaryErrors24h += r.errors24h
          acc.canaryErrors1h += r.errors1h
        } else {
          acc.nonCanaryErrors24h += r.errors24h
          acc.nonCanaryErrors1h += r.errors1h
        }
        return acc
      },
      { canaryErrors24h: 0, canaryErrors1h: 0, nonCanaryErrors24h: 0, nonCanaryErrors1h: 0 },
    )

    // Endpoint stats (errores + duración) — 24h
    const endpointRows = endpointStatsResult
      ? (Array.isArray(endpointStatsResult) ? endpointStatsResult : (endpointStatsResult as any).rows || [])
      : []
    const endpointStats = endpointRows.map((r: any) => ({
      endpoint: r.endpoint,
      totalErrors24h: r.total_errors_24h ?? 0,
      errors5xx24h: r.errors_5xx_24h ?? 0,
      errors4xx24h: r.errors_4xx_24h ?? 0,
      avgDurationMs: r.avg_duration_ms ?? 0,
      maxDurationMs: r.max_duration_ms ?? 0,
      inCanary: CANARY_ENDPOINTS.has(r.endpoint),
    }))

    // Pgbouncer summary — solo el pool postgres/postgres que es el real (descartamos pgbouncer/pgbouncer admin)
    const poolerSummary = pgbouncerStats?.pools.find((p: any) => p.database === 'postgres' && p.user === 'postgres')
    const poolerStatsRow = pgbouncerStats?.stats.find((s: any) => s.database === 'postgres')

    return NextResponse.json({
      database: {
        maxConnections,
        totalConnections,
        usagePercent: maxConnections > 0 ? Math.round((totalConnections / maxConnections) * 100) : 0,
        connectionsByState,
        connectionsByApp,
      },
      traffic: {
        sessionsToday,
        usersToday,
        questionsToday,
        peakConcurrent,
      },
      errors: recentErrors,
      canary: {
        endpointsInPooler: Array.from(CANARY_ENDPOINTS).sort(),
        statsByEndpoint: canaryStats,
        summary: canarySummary,
      },
      endpoints: endpointStats,
      pooler: pgbouncerStats ? {
        available: true,
        clActive: poolerSummary?.cl_active ?? 0,
        clWaiting: poolerSummary?.cl_waiting ?? 0,
        svActive: poolerSummary?.sv_active ?? 0,
        svIdle: poolerSummary?.sv_idle ?? 0,
        svUsed: poolerSummary?.sv_used ?? 0,
        maxwaitMs: Math.round((poolerSummary?.maxwait_us ?? 0) / 1000),
        poolMode: poolerSummary?.pool_mode ?? 'transaction',
        queryCount: poolerStatsRow?.query_count ?? 0,
        bytesReceived: poolerStatsRow?.bytes_received ?? 0,
        bytesSent: poolerStatsRow?.bytes_sent ?? 0,
        avgQueryTimeMs: poolerStatsRow && poolerStatsRow.query_count > 0
          ? Math.round(poolerStatsRow.query_time_us / poolerStatsRow.query_count / 1000 * 100) / 100
          : 0,
        avgWaitTimeMs: poolerStatsRow && poolerStatsRow.query_count > 0
          ? Math.round(poolerStatsRow.wait_time_us / poolerStatsRow.query_count / 1000 * 100) / 100
          : 0,
      } : { available: false },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error in infra-stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/admin/infra-stats', _GET)
