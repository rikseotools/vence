// app/api/admin/slos/route.ts
//
// Endpoint admin: SLO dashboard para decidir cutover Vercel→AWS (Bloque 5
// Fase E.4.5). Devuelve 7 indicadores con semáforo verde/ámbar/rojo:
//
//   1) Canary CloudWatch success rate últimas 24h
//   2) p50 / p95 / p99 latencia preview AWS (24h)
//   3) p50 / p95 / p99 latencia prod Vercel (24h, baseline)
//   4) Error rate 4xx preview AWS (24h)
//   5) Error rate 5xx preview AWS (24h)
//   6) React hydration mismatch rate
//   7) Cutover readiness gauge (verde si todos los SLOs en verde)
//
// SLOs documentados (umbrales que deciden cutover GO/NO-GO):
//   - p95 < 800ms (verde) / < 1500ms (ámbar) / >= 1500ms (rojo)
//   - error rate 5xx < 0.1% (verde) / < 1% (ámbar) / >= 1% (rojo)
//   - error rate 4xx < 5% (verde) / < 10% (ámbar) / >= 10% (rojo)
//   - canary uptime > 99.9% (verde) / > 99% (ámbar) / <= 99% (rojo)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
} from '@aws-sdk/client-cloudwatch'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const ADMIN_EMAILS = [
  'admin@vencemitfg.es',
  'manuel@vencemitfg.es',
  'manueltrader@gmail.com',
]
function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email) || email.endsWith('@vencemitfg.es')
}

type Status = 'green' | 'amber' | 'red' | 'unknown'

interface Indicator {
  label: string
  status: Status
  value: string
  detail?: string
  slo: string
}

interface SLOResponse {
  success: boolean
  generatedAt: string
  cutoverReady: boolean
  indicators: Indicator[]
  rawData: Record<string, unknown>
}

// ============================================================
// Helpers de umbrales
// ============================================================

function gradeLatencyP95(ms: number): Status {
  if (ms < 800) return 'green'
  if (ms < 1500) return 'amber'
  return 'red'
}

function gradeErrorRate5xx(rate: number): Status {
  if (rate < 0.001) return 'green' // <0.1%
  if (rate < 0.01) return 'amber' // <1%
  return 'red'
}

function gradeErrorRate4xx(rate: number): Status {
  if (rate < 0.05) return 'green'
  if (rate < 0.10) return 'amber'
  return 'red'
}

function gradeUptime(rate: number): Status {
  if (rate >= 0.999) return 'green'
  if (rate >= 0.99) return 'amber'
  return 'red'
}

function fmtMs(n: number | null): string {
  if (n == null || isNaN(n)) return '—'
  return `${Math.round(n)}ms`
}

function fmtPct(n: number | null): string {
  if (n == null || isNaN(n)) return '—'
  return `${(n * 100).toFixed(2)}%`
}

// ============================================================
// Handler
// ============================================================

async function _GET(request: NextRequest) {
  const auth = await verifyAuth(request, '/api/admin/slos')
  if (!auth.success) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status })
  }
  if (!isAdmin(auth.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const SINCE = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const indicators: Indicator[] = []
  const rawData: Record<string, unknown> = {}

  // ============================================================
  // 1. Canarios Fargate — uptime últimas 24h por canary
  //    Lee observable_events.event_type='canary_*_ok' vs '_failed'.
  //    Reemplaza al ex-SLO-01 CloudWatch Synthetics (nunca desplegado).
  // ============================================================
  const FARGATE_CANARIES: Array<{ endpoint: string; label: string }> = [
    { endpoint: 'canary-smoke-auth', label: 'Canary auth (GET /api/profile)' },
    { endpoint: 'canary-stripe-webhook', label: 'Canary Stripe webhook' },
    { endpoint: 'canary-answer-save', label: 'Canary answer-save (endpoint hot)' },
  ]
  try {
    const { data: canaryEvents } = await supabase
      .from('observable_events')
      .select('endpoint, event_type, created_at')
      .in('endpoint', FARGATE_CANARIES.map(c => c.endpoint))
      .gte('created_at', SINCE)
      .or('event_type.like.%_ok,event_type.like.%_failed')
      .limit(20000)

    rawData.canaryEventsCount = canaryEvents?.length ?? 0

    for (const c of FARGATE_CANARIES) {
      const evs = (canaryEvents ?? []).filter(e => e.endpoint === c.endpoint)
      const oks = evs.filter(e => e.event_type.endsWith('_ok')).length
      const failures = evs.filter(e => e.event_type.endsWith('_failed')).length
      const decided = oks + failures
      const uptime = decided > 0 ? oks / decided : null

      indicators.push({
        label: `${c.label} — uptime 24h`,
        status: uptime == null ? 'unknown' : gradeUptime(uptime),
        value: uptime == null ? '—' : `${(uptime * 100).toFixed(2)}%`,
        detail:
          uptime == null
            ? 'Sin eventos en 24h — ¿cron parado o modo idle?'
            : `${oks} OK / ${failures} fail (${decided} ticks decididos)`,
        slo: '≥99.9% verde, ≥99% ámbar',
      })
    }
  } catch (e) {
    for (const c of FARGATE_CANARIES) {
      indicators.push({
        label: `${c.label} — uptime 24h`,
        status: 'unknown',
        value: '—',
        detail: `Error lectura observable_events: ${(e as Error).message}`,
        slo: '≥99.9% verde, ≥99% ámbar',
      })
    }
  }

  // ============================================================
  // 2/3. Latencia p50/p95/p99 — observable_events event_type='request_completed'
  //      Bloque 5 Fase E.4.5.b: withErrorLogging ahora emite 10% de
  //      requests 2xx/3xx con duration_ms + host. Agrupamos en JS por host.
  // ============================================================
  function percentile(sorted: number[], p: number): number | null {
    if (sorted.length === 0) return null
    const idx = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]
  }

  try {
    const { data: timing } = await supabase
      .from('observable_events')
      .select('duration_ms, metadata')
      .eq('event_type', 'request_completed')
      .gte('ts', SINCE)
      .limit(50000)

    const byHost: Record<string, number[]> = {}
    for (const e of timing ?? []) {
      const meta =
        typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata
      const host = meta?.host || 'unknown'
      const d = e.duration_ms
      if (d == null) continue
      if (!byHost[host]) byHost[host] = []
      byHost[host].push(d)
    }

    const latencyByHost: Record<string, { samples: number; p50: number | null; p95: number | null; p99: number | null }> = {}

    // Hosts esperados: preview-aws.vence.es (AWS) y www.vence.es (Vercel)
    for (const host of ['www.vence.es', 'preview-aws.vence.es']) {
      const arr = byHost[host] ?? []
      arr.sort((a, b) => a - b)
      const p50 = percentile(arr, 50)
      const p95 = percentile(arr, 95)
      const p99 = percentile(arr, 99)
      latencyByHost[host] = { samples: arr.length, p50, p95, p99 }

      const status: Status =
        p95 == null ? 'unknown' : gradeLatencyP95(p95)
      indicators.push({
        label: `Latencia ${host} (24h)`,
        status,
        value:
          p95 == null
            ? '—'
            : `p50 ${fmtMs(p50)} · p95 ${fmtMs(p95)} · p99 ${fmtMs(p99)}`,
        detail: `${arr.length} muestras (sampling 10% de éxitos)`,
        slo: 'p95 <800ms verde, <1500ms ámbar',
      })
    }

    rawData.latencyByHost = latencyByHost
  } catch (e) {
    indicators.push({
      label: 'Latencia p50/p95/p99',
      status: 'unknown',
      value: '—',
      detail: `Error consultando: ${(e as Error).message}`,
      slo: 'p95 <800ms',
    })
  }

  // ============================================================
  // Resto: errores 4xx / 5xx / hydration / volumen
  // ============================================================

  // 4. Errores 4xx (24h)
  const { data: errs4xx } = await supabase
    .from('observable_events')
    .select('source, severity, event_type', { count: 'exact', head: true })
    .gte('ts', SINCE)
    .gte('http_status', 400)
    .lt('http_status', 500)
  const total4xxCount = (errs4xx as unknown as { count?: number })?.count ?? 0

  const { data: total } = await supabase
    .from('observable_events')
    .select('id', { count: 'exact', head: true })
    .gte('ts', SINCE)
  const totalCount = (total as unknown as { count?: number })?.count ?? 1
  const rate4xx = totalCount > 0 ? total4xxCount / totalCount : 0
  rawData.errors4xx = { count: total4xxCount, total: totalCount, rate: rate4xx }
  indicators.push({
    label: 'Errores 4xx (24h, todos sources)',
    status: gradeErrorRate4xx(rate4xx),
    value: fmtPct(rate4xx),
    detail: `${total4xxCount} de ${totalCount} eventos`,
    slo: '<5% verde, <10% ámbar',
  })

  // 5. Errores 5xx (24h) — SEPARADO en user-facing vs internal/debug.
  //
  // Razón (2026-05-26 audit): los smoke tests `/api/debug/*` deliberados
  // con throw y los timeouts de crons `/api/cron/*` contaminaban el SLO
  // como falsos positivos ámbar. El cutover real depende SOLO de los
  // 5xx que ven usuarios — los crons fallidos son problema operativo
  // pero no rompen la UX.
  const INTERNAL_PREFIXES = ['/api/cron/', '/api/debug/', '/api/admin/']

  const { data: all5xx } = await supabase
    .from('observable_events')
    .select('endpoint, error_message')
    .gte('ts', SINCE)
    .gte('http_status', 500)
    .limit(200)

  let userFacing5xx = 0
  let loadShedding = 0 // 503 con mensaje "reintenta" — deliberado
  let internal5xx = 0
  let real5xx = 0

  for (const e of all5xx ?? []) {
    const ep = e.endpoint ?? ''
    const isInternal = INTERNAL_PREFIXES.some((p) => ep.startsWith(p))
    if (isInternal) {
      internal5xx++
      continue
    }
    const msg = (e.error_message ?? '').toLowerCase()
    if (msg.includes('reintenta') || msg.includes('saturad') || msg.includes('temporalmente')) {
      loadShedding++
      continue
    }
    userFacing5xx++
    real5xx++
  }

  const rateReal = totalCount > 0 ? real5xx / totalCount : 0
  rawData.errors5xx = {
    total: all5xx?.length ?? 0,
    real: real5xx,
    loadShedding,
    internal: internal5xx,
    rate: rateReal,
  }
  indicators.push({
    label: '5xx user-facing reales (24h)',
    status: gradeErrorRate5xx(rateReal),
    value: fmtPct(rateReal),
    detail: `${real5xx} reales · ${loadShedding} load-shedding (503 reintenta) · ${internal5xx} crons/debug`,
    slo: '<0.1% verde, <1% ámbar',
  })

  // 6. React hydration mismatch
  const { data: hyd } = await supabase
    .from('observable_events')
    .select('id', { count: 'exact', head: true })
    .gte('ts', SINCE)
    .eq('event_type', 'react_hydration_mismatch')
  const hydCount = (hyd as unknown as { count?: number })?.count ?? 0
  const hydRate = totalCount > 0 ? hydCount / totalCount : 0
  rawData.hydrationMismatch = { count: hydCount, rate: hydRate }
  indicators.push({
    label: 'React hydration mismatch (24h)',
    status:
      hydCount === 0 ? 'green' : hydCount < 50 ? 'amber' : 'red',
    value: `${hydCount} eventos`,
    detail: 'handled-by-React (CSR fallback), no degrada UX visible',
    slo: '0 verde, <50/d ámbar',
  })

  // 7. Volumen total (sanity)
  indicators.push({
    label: 'Volumen total eventos (24h)',
    status: totalCount > 100 ? 'green' : totalCount > 10 ? 'amber' : 'red',
    value: `${totalCount} eventos`,
    detail: 'Si muy bajo, observabilidad rota o tráfico nulo',
    slo: '>100/d verde',
  })

  // ============================================================
  // Cutover readiness
  // ============================================================
  const reds = indicators.filter((i) => i.status === 'red').length
  const ambers = indicators.filter((i) => i.status === 'amber').length
  const cutoverReady = reds === 0 && ambers === 0

  const response: SLOResponse = {
    success: true,
    generatedAt: new Date().toISOString(),
    cutoverReady,
    indicators,
    rawData,
  }
  return NextResponse.json(response)
}

export const GET = withErrorLogging('/api/admin/slos', _GET)
