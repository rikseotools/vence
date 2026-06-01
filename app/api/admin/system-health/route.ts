// app/api/admin/system-health/route.ts
// Endpoint admin: estado de salud del sistema.
//
// ─── Indicadores CRÍTICOS (cabecera del panel) ───
//   1) Errores 5xx servidor (http_status>=500 en validation_error_logs)
//   2) UI congelada cliente (Watchdog en ExamLayout/TestLayout)
//   3) Drift de contadores materializados (desde stats_drift_log)
//   4) Latencia INSERT a test_questions (desde v_insert_test_questions_latency)
//   5) Cron de drift vivo
//
// El 1 (errores 5xx) y el 2 (UI congelada) estaban en el mismo bucket
// "severity=critical" hasta el 31/05/2026 — el watchdog client emite eventos
// con http_status=null pero severity=critical, lo cual distorsionaba el
// indicador 5xx mezclando fallos del servidor con UI freezes del cliente.
//
// ─── Indicadores SECUNDARIOS derivados de observable_events ───
//   5) Canary uptime agregado (6 canarios Fargate)
//   6) Errores 4xx burst
//   7) React hydration mismatch
//   8) Latencia request_completed p95
//   9) Volumen tráfico (sanity check — caída drástica = problema)
//
// Soporta `?window=1h|6h|12h|24h|7d`. Default 24h (compat runbook).
//
// Esto es lo que mira un humano (o Claude vía el runbook
// docs/runbooks/health-check.md) cuando quiere saber si hay fuego.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import {
  classifyEndpoint,
  ERROR_5XX_THRESHOLDS,
} from '@/lib/api/admin/endpoint-classification'

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
//
// Los umbrales user-facing/admin se importan de
// `@/lib/api/admin/endpoint-classification` (fuente única de verdad).
// Mantenemos ERROR_AMBER/RED por compat con el campo `errors_5xx.thresholds`
// del JSON de respuesta (UI los muestra como "umbral genérico"). El verdict
// real ya está sub-categorizado por `byCategory`.
const ERROR_AMBER = ERROR_5XX_THRESHOLDS.user_facing.amber
const ERROR_RED = ERROR_5XX_THRESHOLDS.user_facing.red
// UI congelada (Watchdog). Alineado con RULE_ANSWER_WATCHDOG_BURST en backend
// (≥3 events en 30min → fire). En ventana 24h: ámbar ≥3 = burst confirmable;
// rojo ≥10 = incidente sostenido afectando múltiples users (ver pico
// 30/05/2026 17-21h UTC: 9 watchdog events).
const UI_FROZEN_AMBER = 3
const UI_FROZEN_RED = 10
const DRIFT_AMBER = 1
const DRIFT_RED = 5
const INSERT_MEAN_AMBER_MS = 80
const INSERT_MEAN_RED_MS = 250

// Indicadores nuevos
const ERRORS_4XX_AMBER = 50  // 4xx baseline normal (~bots), pico real ≥50
const ERRORS_4XX_RED = 200
const HYDRATION_AMBER = 5
const HYDRATION_RED = 20
const REQ_LATENCY_P95_AMBER_MS = 800
const REQ_LATENCY_P95_RED_MS = 1500
const CANARY_UPTIME_GREEN_PCT = 99
const CANARY_UPTIME_AMBER_PCT = 95
// Sanity check tráfico: si hay menos de X requests en la ventana,
// probablemente sink de observability roto, no caída real de tráfico.
const TRAFFIC_MIN_AMBER = 10
const TRAFFIC_MIN_RED = 1

type Status = 'green' | 'amber' | 'red' | 'unknown'
type WindowKey = '1h' | '6h' | '12h' | '24h' | '7d'

const WINDOW_HOURS: Record<WindowKey, number> = {
  '1h': 1,
  '6h': 6,
  '12h': 12,
  '24h': 24,
  '7d': 24 * 7,
}

function parseWindow(raw: string | null): WindowKey {
  if (raw && raw in WINDOW_HOURS) return raw as WindowKey
  return '24h'
}

function classifyErrors(count: number): Status {
  if (count >= ERROR_RED) return 'red'
  if (count >= ERROR_AMBER) return 'amber'
  return 'green'
}

/**
 * Clasifica errores 5xx por categoría de endpoint (admin vs user_facing).
 * Aplica umbrales distintos: user_facing es 4× más estricto (cualquier
 * error afecta a un user real) que admin (bajo tráfico, ocasional aceptable).
 */
function classifyErrorsByCategory(
  count: number,
  category: 'admin' | 'user_facing',
): Status {
  const t = ERROR_5XX_THRESHOLDS[category]
  if (count >= t.red) return 'red'
  if (count >= t.amber) return 'amber'
  return 'green'
}

/** Devuelve el peor status de un conjunto (red > amber > unknown > green). */
function worstStatus(...statuses: Status[]): Status {
  if (statuses.some((s) => s === 'red')) return 'red'
  if (statuses.some((s) => s === 'amber')) return 'amber'
  if (statuses.some((s) => s === 'unknown')) return 'unknown'
  return 'green'
}
function classifyUiFrozen(count: number): Status {
  if (count >= UI_FROZEN_RED) return 'red'
  if (count >= UI_FROZEN_AMBER) return 'amber'
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
function classify4xx(count: number): Status {
  if (count >= ERRORS_4XX_RED) return 'red'
  if (count >= ERRORS_4XX_AMBER) return 'amber'
  return 'green'
}
function classifyHydration(count: number): Status {
  if (count >= HYDRATION_RED) return 'red'
  if (count >= HYDRATION_AMBER) return 'amber'
  return 'green'
}
function classifyLatencyP95(ms: number | null): Status {
  if (ms === null) return 'unknown'
  if (ms >= REQ_LATENCY_P95_RED_MS) return 'red'
  if (ms >= REQ_LATENCY_P95_AMBER_MS) return 'amber'
  return 'green'
}
function classifyCanaryUptime(pct: number | null): Status {
  if (pct === null) return 'unknown'
  if (pct >= CANARY_UPTIME_GREEN_PCT) return 'green'
  if (pct >= CANARY_UPTIME_AMBER_PCT) return 'amber'
  return 'red'
}
function classifyTraffic(count: number): Status {
  if (count <= TRAFFIC_MIN_RED) return 'red'
  if (count <= TRAFFIC_MIN_AMBER) return 'amber'
  return 'green'
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]
}

async function _GET(request: NextRequest) {
  const auth = await verifyAuth(request, '/api/admin/system-health')
  if (!auth.success) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!isAdmin(auth.email)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Parámetros
  const window = parseWindow(request.nextUrl.searchParams.get('window'))
  const windowHours = WINDOW_HOURS[window]
  const sinceMs = Date.now() - windowHours * 60 * 60 * 1000
  const since = new Date(sinceMs).toISOString()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // ─── 10 lecturas en paralelo ───
  const [
    errorsResult,
    uiFrozenResult,
    driftResult,
    latencyResult,
    lastCronResult,
    errors4xxResult,
    hydrationResult,
    requestLatencyResult,
    canaryEventsResult,
    trafficResult,
  ] = await Promise.all([
    // 1) Errores 5xx servidor (http_status >= 500).
    // El filtro por status excluye los Watchdog client-side (status=null,
    // pero severity=critical) que tienen su propio indicador en el grid.
    supabase
      .from('validation_error_logs')
      .select('endpoint, error_type, created_at, http_status', { count: 'exact', head: false })
      .eq('severity', 'critical')
      .gte('http_status', 500)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20),

    // 1b) UI congelada (Watchdog). Eventos emitidos por el hook
    // `useAnswerWatchdog` cuando el estado `processingAnswer`/`isSaving`
    // de ExamLayout/TestLayout no se resetea en 12s. Cada evento = un
    // user con UI bloqueada (no es un fallo del servidor, es un síntoma
    // del cliente, a menudo correlacionado con latencia del backend).
    supabase
      .from('validation_error_logs')
      .select('endpoint, error_message, duration_ms, user_id, created_at', { count: 'exact', head: false })
      .ilike('error_message', '%Watchdog%')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20),

    // 2) Drift activo en window (drift_pct > 5).
    // Filtra markers técnicos (__cron_run__, __exception__).
    supabase
      .from('stats_drift_log')
      .select('target_table, field_name, drift_pct, user_id, checked_at, notes', { count: 'exact', head: false })
      .gte('checked_at', since)
      .gt('drift_pct', 5)
      .not('target_table', 'in', '("__cron_run__","__exception__")')
      .order('drift_pct', { ascending: false })
      .limit(20),

    // 3) Latencia INSERT — histórico pg_stat_statements (NO window-able).
    supabase
      .from('v_insert_test_questions_latency')
      .select('*')
      .order('calls', { ascending: false })
      .limit(3),

    // 4) Última ejecución cron drift — fijo (no window-able).
    supabase
      .from('stats_drift_log')
      .select('checked_at, notes')
      .eq('target_table', '__cron_run__')
      .order('checked_at', { ascending: false })
      .limit(1),

    // 5) Errores 4xx (NO 401/403 que son user-error normal)
    supabase
      .from('validation_error_logs')
      .select('endpoint, http_status', { count: 'exact', head: false })
      .gte('http_status', 400)
      .lt('http_status', 500)
      .not('http_status', 'in', '(401,403)')
      .gte('created_at', since)
      .limit(20),

    // 6) Hydration mismatch
    supabase
      .from('observable_events')
      .select('endpoint, created_at, metadata', { count: 'exact', head: false })
      .eq('event_type', 'react_hydration_mismatch')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20),

    // 7) Latencia request_completed — sample para calcular p95
    supabase
      .from('observable_events')
      .select('duration_ms, metadata')
      .eq('event_type', 'request_completed')
      .not('duration_ms', 'is', null)
      .gte('created_at', since)
      .limit(5000),

    // 8) Canary events (todos canary_*_ok + _failed)
    supabase
      .from('observable_events')
      .select('endpoint, event_type')
      .like('endpoint', 'canary-%')
      .or('event_type.like.%_ok,event_type.like.%_failed')
      .gte('created_at', since)
      .limit(10000),

    // 9) Volumen tráfico (sanity check)
    supabase
      .from('observable_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'request_completed')
      .gte('created_at', since),
  ])

  // ─── Procesar 1-4 (existentes) ───
  const errorCount = errorsResult.error ? null : (errorsResult.count ?? 0)
  const errorSamples = errorsResult.data ?? []

  // Sub-categorización admin vs user_facing (cambio 2026-06-01 para evitar
  // falsos ROJOS por errores en admin tools como /api/verify-articles/sync-all
  // que cruzaban umbral user_facing pero no afectan UX). Ver
  // lib/api/admin/endpoint-classification.ts.
  //
  // Limitación honesta: el COUNT de errorsResult es el total global; los
  // samples solo son los 20 más recientes. El conteo por categoría se calcula
  // sobre los samples disponibles — preciso para incidentes pequeños, una
  // aproximación para incidentes masivos (>20 errores). Cuando se quiera
  // count exacto por categoría, hacer 2 queries separadas (futuro refactor
  // si el desglose pasa a ser indicador principal del panel).
  const samplesAdmin = errorSamples.filter(
    (e) => classifyEndpoint(e.endpoint) === 'admin',
  )
  const samplesUserFacing = errorSamples.filter(
    (e) => classifyEndpoint(e.endpoint) === 'user_facing',
  )
  const adminCount = samplesAdmin.length
  const userFacingCount = samplesUserFacing.length
  const adminStatus =
    errorCount === null ? 'unknown' : classifyErrorsByCategory(adminCount, 'admin')
  const userFacingStatus =
    errorCount === null
      ? 'unknown'
      : classifyErrorsByCategory(userFacingCount, 'user_facing')

  // ─── Procesar 1b (nuevo): watchdog client ───
  const uiFrozenCount = uiFrozenResult.error ? null : (uiFrozenResult.count ?? 0)
  const uiFrozenRows = uiFrozenResult.data ?? []
  const uiFrozenUniqueUsers = new Set(
    uiFrozenRows
      .map((r) => (r as { user_id: string | null }).user_id)
      .filter((u): u is string => typeof u === 'string'),
  ).size
  const uiFrozenMaxDurationMs = uiFrozenRows.reduce((max, r) => {
    const d = Number((r as { duration_ms: number | null }).duration_ms ?? 0)
    return d > max ? d : max
  }, 0) || null
  const uiFrozenSamples = uiFrozenRows.slice(0, 5).map((r) => ({
    endpoint: (r as { endpoint: string }).endpoint,
    duration_ms: (r as { duration_ms: number | null }).duration_ms,
    created_at: (r as { created_at: string }).created_at,
  }))

  const driftCount = driftResult.error ? null : (driftResult.count ?? 0)
  const driftSamples = driftResult.data ?? []

  const insertVariants = latencyResult.data ?? []
  const topInsert = insertVariants[0] ?? null
  const topInsertMean = topInsert?.mean_ms != null ? Number(topInsert.mean_ms) : null

  const lastDriftCheckAt = lastCronResult.data?.[0]?.checked_at ?? null
  const cronStaleHours = lastDriftCheckAt
    ? (Date.now() - new Date(lastDriftCheckAt).getTime()) / 3_600_000
    : null
  const cronStatus: Status = cronStaleHours == null
    ? 'unknown'
    : cronStaleHours > 36 ? 'red' : cronStaleHours > 26 ? 'amber' : 'green'

  // ─── Procesar 5: errores 4xx ───
  const errors4xxCount = errors4xxResult.error ? null : (errors4xxResult.count ?? 0)
  const errors4xxTopEndpoints = (() => {
    const byEndpoint: Record<string, number> = {}
    for (const r of errors4xxResult.data ?? []) {
      const k = (r as { endpoint: string }).endpoint ?? '(unknown)'
      byEndpoint[k] = (byEndpoint[k] ?? 0) + 1
    }
    return Object.entries(byEndpoint)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([endpoint, count]) => ({ endpoint, count }))
  })()

  // ─── Procesar 6: hydration ───
  const hydrationCount = hydrationResult.error ? null : (hydrationResult.count ?? 0)
  const hydrationSamples = (hydrationResult.data ?? []).map(h => ({
    endpoint: (h as { endpoint: string }).endpoint,
    created_at: (h as { created_at: string }).created_at,
  })).slice(0, 5)

  // ─── Procesar 7: latencia p95 ───
  const durations = (requestLatencyResult.data ?? [])
    .map(r => Number((r as { duration_ms: number }).duration_ms))
    .filter(n => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b)
  const p50 = percentile(durations, 50)
  const p95 = percentile(durations, 95)
  const p99 = percentile(durations, 99)

  // ─── Procesar 8: canary uptime agregado ───
  const canaryEvents = canaryEventsResult.data ?? []
  const canaryOks = canaryEvents.filter(e =>
    typeof (e as { event_type: string }).event_type === 'string' &&
    (e as { event_type: string }).event_type.endsWith('_ok'),
  ).length
  const canaryFails = canaryEvents.filter(e =>
    typeof (e as { event_type: string }).event_type === 'string' &&
    (e as { event_type: string }).event_type.endsWith('_failed'),
  ).length
  const canaryDecided = canaryOks + canaryFails
  const canaryUptimePct = canaryDecided > 0
    ? (canaryOks / canaryDecided) * 100
    : null

  // Desglose por canary endpoint
  const canaryByEndpoint: Record<string, { ok: number; failed: number }> = {}
  for (const e of canaryEvents) {
    const ep = (e as { endpoint: string }).endpoint
    const et = (e as { event_type: string }).event_type
    if (!canaryByEndpoint[ep]) canaryByEndpoint[ep] = { ok: 0, failed: 0 }
    if (et.endsWith('_ok')) canaryByEndpoint[ep].ok++
    if (et.endsWith('_failed')) canaryByEndpoint[ep].failed++
  }
  const canaryBreakdown = Object.entries(canaryByEndpoint).map(([endpoint, c]) => {
    const decided = c.ok + c.failed
    return {
      endpoint,
      ok: c.ok,
      failed: c.failed,
      uptimePct: decided > 0 ? (c.ok / decided) * 100 : null,
    }
  })

  // ─── Procesar 9: tráfico ───
  const trafficCount = trafficResult.error ? null : (trafficResult.count ?? 0)

  return NextResponse.json({
    success: true,
    generatedAt: new Date().toISOString(),
    window,
    windowHours,
    indicators: {
      // ─── CRÍTICOS (cabecera) ───
      errors_5xx: {
        // status global = peor de las 2 sub-categorías (evita falso ROJO
        // por errores admin que no afectan UX). Ver byCategory para detalle.
        status: errorCount == null ? 'unknown' : worstStatus(userFacingStatus, adminStatus),
        count: errorCount,
        samples: errorSamples.map(e => ({
          endpoint: e.endpoint,
          error_type: e.error_type,
          created_at: e.created_at,
          category: classifyEndpoint(e.endpoint),
        })),
        thresholds: { amber: ERROR_AMBER, red: ERROR_RED },
        // Sub-categorización (2026-06-01) — admin vs user_facing.
        byCategory: {
          user_facing: {
            status: userFacingStatus,
            count: userFacingCount,
            thresholds: ERROR_5XX_THRESHOLDS.user_facing,
            samples: samplesUserFacing.slice(0, 10).map(e => ({
              endpoint: e.endpoint,
              error_type: e.error_type,
              created_at: e.created_at,
            })),
          },
          admin: {
            status: adminStatus,
            count: adminCount,
            thresholds: ERROR_5XX_THRESHOLDS.admin,
            samples: samplesAdmin.slice(0, 10).map(e => ({
              endpoint: e.endpoint,
              error_type: e.error_type,
              created_at: e.created_at,
            })),
          },
        },
        note: 'Filtra http_status >= 500. Excluye Watchdog client-side (ver indicador ui_frozen). Sub-categorizado admin vs user_facing por endpoint (ver byCategory).',
      },
      ui_frozen: {
        status: uiFrozenCount == null ? 'unknown' : classifyUiFrozen(uiFrozenCount),
        count: uiFrozenCount,
        uniqueUsers: uiFrozenUniqueUsers,
        maxDurationMs: uiFrozenMaxDurationMs,
        samples: uiFrozenSamples,
        thresholds: { amber: UI_FROZEN_AMBER, red: UI_FROZEN_RED },
        note: 'Watchdog del hook useAnswerWatchdog (12s threshold). Cada evento = user con UI bloqueada en ExamLayout/TestLayout. Correlaciona con saturación BD/antifraud.',
      },
      drift: {
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
        note: 'mean_ms histórico pg_stat_statements (NO depende de window).',
      },
      drift_cron: {
        status: cronStatus,
        last_run_at: lastDriftCheckAt,
        stale_hours: cronStaleHours != null ? Math.round(cronStaleHours * 10) / 10 : null,
        thresholds: { amber: '>26h sin correr', red: '>36h sin correr' },
        note: 'Ventana fija — el cron corre cada 24h independiente del window seleccionado.',
      },

      // ─── SECUNDARIOS (derivados de observable_events) ───
      canary_uptime: {
        status: classifyCanaryUptime(canaryUptimePct),
        uptimePct: canaryUptimePct != null ? Math.round(canaryUptimePct * 100) / 100 : null,
        oks: canaryOks,
        failed: canaryFails,
        breakdown: canaryBreakdown,
        thresholds: { green: '≥99%', amber: '≥95%' },
      },
      errors_4xx: {
        status: errors4xxCount == null ? 'unknown' : classify4xx(errors4xxCount),
        count: errors4xxCount,
        topEndpoints: errors4xxTopEndpoints,
        thresholds: { amber: ERRORS_4XX_AMBER, red: ERRORS_4XX_RED },
        note: 'Excluye 401/403 (user-error normal de auth).',
      },
      hydration_mismatch: {
        status: hydrationCount == null ? 'unknown' : classifyHydration(hydrationCount),
        count: hydrationCount,
        samples: hydrationSamples,
        thresholds: { amber: HYDRATION_AMBER, red: HYDRATION_RED },
      },
      request_latency: {
        status: classifyLatencyP95(p95),
        p50_ms: p50,
        p95_ms: p95,
        p99_ms: p99,
        sampleCount: durations.length,
        thresholds: { amber: REQ_LATENCY_P95_AMBER_MS, red: REQ_LATENCY_P95_RED_MS },
        note: 'Sampling 10% de request_completed (server-side withErrorLogging).',
      },
      traffic_volume: {
        status: trafficCount == null ? 'unknown' : classifyTraffic(trafficCount),
        count: trafficCount,
        thresholds: { amber: `≤${TRAFFIC_MIN_AMBER} eventos`, red: `≤${TRAFFIC_MIN_RED} eventos` },
        note: 'Sanity check del sink de observability. Caída drástica vs baseline = sink roto, no caída de tráfico real.',
      },
    },
  })
}

export const GET = withErrorLogging('/api/admin/system-health', _GET)
