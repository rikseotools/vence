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
  // 1. Canary CloudWatch — success rate últimas 24h
  // ============================================================
  try {
    const cw = new CloudWatchClient({ region: 'eu-west-2' })
    const cwResp = await cw.send(
      new GetMetricStatisticsCommand({
        Namespace: 'CloudWatchSynthetics',
        MetricName: 'SuccessPercent',
        Dimensions: [{ Name: 'CanaryName', Value: 'vence-preview' }],
        StartTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        EndTime: new Date(),
        Period: 3600,
        Statistics: ['Average'],
      }),
    )
    const points = cwResp.Datapoints ?? []
    const avg =
      points.length > 0
        ? points.reduce((sum: number, p) => sum + (p.Average ?? 0), 0) / points.length / 100
        : null
    rawData.canaryUptime = { points: points.length, avg }
    indicators.push({
      label: 'Canary CloudWatch (24h)',
      status: avg == null ? 'unknown' : gradeUptime(avg),
      value: avg == null ? '—' : `${(avg * 100).toFixed(2)}%`,
      detail: `${points.length} períodos de 1h evaluados`,
      slo: '≥99.9% verde, ≥99% ámbar',
    })
  } catch (e) {
    indicators.push({
      label: 'Canary CloudWatch (24h)',
      status: 'unknown',
      value: '—',
      detail: `Error: ${(e as Error).message}`,
      slo: '≥99.9% verde, ≥99% ámbar',
    })
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

  // 5. Errores 5xx (24h)
  const { data: errs5xx } = await supabase
    .from('observable_events')
    .select('id', { count: 'exact', head: true })
    .gte('ts', SINCE)
    .gte('http_status', 500)
  const total5xxCount = (errs5xx as unknown as { count?: number })?.count ?? 0
  const rate5xx = totalCount > 0 ? total5xxCount / totalCount : 0
  rawData.errors5xx = { count: total5xxCount, rate: rate5xx }
  indicators.push({
    label: 'Errores 5xx (24h)',
    status: gradeErrorRate5xx(rate5xx),
    value: fmtPct(rate5xx),
    detail: `${total5xxCount} eventos http_5xx`,
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
