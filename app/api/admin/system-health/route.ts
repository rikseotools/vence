// app/api/admin/system-health/route.ts
// Endpoint admin: estado de salud del sistema en 3 indicadores.
//
//   1) Errores 5xx últimas 24h (desde validation_error_logs)
//   2) Drift de contadores materializados (desde stats_drift_log)
//   3) Latencia INSERT a test_questions (desde v_insert_test_questions_latency)
//
// Esto es lo que mira un humano (o Claude vía el runbook
// docs/runbooks/health-check.md) cuando quiere saber si hay fuego.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

const ADMIN_EMAILS = [
  'admin@vencemitfg.es',
  'manuel@vencemitfg.es',
  'manueltrader@gmail.com',
]
function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email) || email.endsWith('@vencemitfg.es')
}

// Umbrales — duplicados también en docs/runbooks/health-check.md.
// Si cambian, actualizar el runbook.
const ERROR_24H_AMBER = 1
const ERROR_24H_RED = 5
const DRIFT_AMBER = 1  // cualquier drift significativo enciende ámbar
const DRIFT_RED = 5    // 5+ filas con drift_pct>5 enciende rojo
// Umbrales para INSERT a test_questions, basados en `mean_ms` de
// pg_stat_statements (más estable que proxy_p95, que es muy sensible al
// stddev por outliers de contención).
//
// Baseline post-DROP de NO-OPs (2026-05-23): mean histórico ≈44ms (incluye
// RTT cliente→pooler→DB y eventos de contención). El INSERT puro dentro
// de la BD es ~1.5ms p50 medido en bucle plpgsql. La diferencia es
// fundamentalmente RTT, no triggers.
//
// Ámbar: degradación clara vs baseline actual.
// Rojo: muy fuera de lo normal — probable contención del pool o trigger
// nuevo escaneando.
const INSERT_MEAN_AMBER_MS = 80
const INSERT_MEAN_RED_MS = 250

type Status = 'green' | 'amber' | 'red' | 'unknown'

function classifyErrors(count: number): Status {
  if (count >= ERROR_24H_RED) return 'red'
  if (count >= ERROR_24H_AMBER) return 'amber'
  return 'green'
}
function classifyDrift(count: number): Status {
  if (count >= DRIFT_RED) return 'red'
  if (count >= DRIFT_AMBER) return 'amber'
  return 'green'
}
function classifyInsertLatency(mean_ms: number | null): Status {
  if (mean_ms === null) return 'unknown'
  if (mean_ms >= INSERT_MEAN_RED_MS) return 'red'
  if (mean_ms >= INSERT_MEAN_AMBER_MS) return 'amber'
  return 'green'
}

async function _GET(request: NextRequest) {
  const auth = await verifyAuth(request, '/api/admin/system-health')
  if (!auth.success) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!isAdmin(auth.email)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Service role para leer tablas sensibles (validation_error_logs,
  // stats_drift_log, v_insert_test_questions_latency).
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Tres lecturas en paralelo
  const [errorsResult, driftResult, latencyResult, lastCronResult] = await Promise.all([
    // 1) Errores 5xx últimas 24h
    supabase
      .from('validation_error_logs')
      .select('endpoint, error_type, created_at', { count: 'exact', head: false })
      .eq('severity', 'critical')
      .gte('created_at', since24h)
      .order('created_at', { ascending: false })
      .limit(20),

    // 2) Drift activo (filas con drift_pct > 5 en últimas 24h).
    // Filtra explícitamente las filas técnicas '__cron_run__' y
    // '__exception__' por nombre (sin LIKE — los `_` son wildcards
    // single-char en LIKE y el escape de Postgres con `\_` no funciona
    // con PostgREST sin ESCAPE clause).
    supabase
      .from('stats_drift_log')
      .select('target_table, field_name, drift_pct, user_id, checked_at, notes', { count: 'exact', head: false })
      .gte('checked_at', since24h)
      .gt('drift_pct', 5)
      .not('target_table', 'in', '("__cron_run__","__exception__")')
      .order('drift_pct', { ascending: false })
      .limit(20),

    // 3) Latencia INSERT — top 1 variante por calls (la más representativa)
    supabase
      .from('v_insert_test_questions_latency')
      .select('*')
      .order('calls', { ascending: false })
      .limit(3),

    // 4) Última ejecución del cron de drift — usa el marker
    // '__cron_run__' que la función SQL inserta al final de cada
    // ejecución, independientemente de si hay drift. Sin esto, un cron
    // sano sin drift detectado parecería "muerto" al panel.
    supabase
      .from('stats_drift_log')
      .select('checked_at, notes')
      .eq('target_table', '__cron_run__')
      .order('checked_at', { ascending: false })
      .limit(1),
  ])

  // Procesar resultados con tolerancia a fallos parciales
  const errorCount = errorsResult.error ? null : (errorsResult.count ?? 0)
  const errorSamples = errorsResult.data ?? []

  const driftCount = driftResult.error ? null : (driftResult.count ?? 0)
  const driftSamples = driftResult.data ?? []

  const insertVariants = latencyResult.data ?? []
  const topInsert = insertVariants[0] ?? null
  // mean_ms viene como string por NUMERIC → coerce
  const topInsertMean = topInsert?.mean_ms != null ? Number(topInsert.mean_ms) : null

  const lastDriftCheckAt = lastCronResult.data?.[0]?.checked_at ?? null
  const cronStaleHours = lastDriftCheckAt
    ? (Date.now() - new Date(lastDriftCheckAt).getTime()) / 3_600_000
    : null
  // Si el último check tiene >36h, el cron está caído
  const cronStatus: Status = cronStaleHours == null
    ? 'unknown'
    : cronStaleHours > 36 ? 'red' : cronStaleHours > 26 ? 'amber' : 'green'

  return NextResponse.json({
    success: true,
    generatedAt: new Date().toISOString(),
    indicators: {
      errors_5xx_24h: {
        status: errorCount == null ? 'unknown' : classifyErrors(errorCount),
        count: errorCount,
        samples: errorSamples.map(e => ({
          endpoint: e.endpoint,
          error_type: e.error_type,
          created_at: e.created_at,
        })),
        thresholds: { amber: ERROR_24H_AMBER, red: ERROR_24H_RED },
      },
      drift_24h: {
        status: driftCount == null ? 'unknown' : classifyDrift(driftCount),
        count: driftCount,
        samples: driftSamples.map(d => ({
          target_table: d.target_table,
          field_name: d.field_name,
          drift_pct: d.drift_pct,
          user_id: d.user_id,
          checked_at: d.checked_at,
          notes: d.notes,
        })),
        thresholds: { amber: DRIFT_AMBER, red: DRIFT_RED },
      },
      insert_latency: {
        status: classifyInsertLatency(topInsertMean),
        mean_ms: topInsertMean,
        variants: insertVariants.map(v => ({
          mean_ms: v.mean_ms,
          proxy_p95_ms: v.proxy_p95_ms,
          max_ms: v.max_ms,
          stddev_ms: v.stddev_ms,
          calls: v.calls,
          query_snippet: v.query_snippet,
        })),
        thresholds: { amber: INSERT_MEAN_AMBER_MS, red: INSERT_MEAN_RED_MS },
        note: 'mean_ms histórico de pg_stat_statements (incluye RTT cliente→pooler→DB y eventos de contención). El INSERT puro en BD es ~1.5ms p50.',
      },
      drift_cron: {
        status: cronStatus,
        last_run_at: lastDriftCheckAt,
        stale_hours: cronStaleHours != null ? Math.round(cronStaleHours * 10) / 10 : null,
        thresholds: { amber: '>26h sin correr', red: '>36h sin correr' },
      },
    },
  })
}

export const GET = withErrorLogging('/api/admin/system-health', _GET)
