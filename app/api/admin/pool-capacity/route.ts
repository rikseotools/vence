// app/api/admin/pool-capacity/route.ts
//
// Endpoint admin: estado del pool capacity sampler.
//
// Fuente: tabla `pool_capacity_samples` alimentada por el cron Fargate
// `pool-capacity-sampler` (1×/min). Vista auxiliar
// `v_pool_capacity_last_15min` para uso rápido + queries directas a
// tabla para ventanas más largas.
//
// Devuelve:
//   - samples[]: últimas N muestras con todas las métricas + status calculado.
//   - aggregate: counts agregados de la ventana + max + flags rojas observadas.
//   - timeseries (opcional con ?timeseries=true): array agrupado por bucket
//     (5min o 15min según window) para gráfico time-series en UI.
//
// Roadmap: docs/roadmap/observability-capacity.md Acción 2.

import { NextRequest, NextResponse } from 'next/server'
import { getReadDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

const ADMIN_EMAILS = [
  'admin@vencemitfg.es',
  'manuel@vencemitfg.es',
  'manueltrader@gmail.com',
]
function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email) || email.endsWith('@vencemitfg.es')
}

type WindowKey = '15m' | '1h' | '6h' | '24h' | '7d'
const WINDOW_MIN: Record<WindowKey, number> = {
  '15m': 15,
  '1h': 60,
  '6h': 6 * 60,
  '24h': 24 * 60,
  '7d': 7 * 24 * 60,
}
const TIMESERIES_BUCKET_MIN: Record<WindowKey, number> = {
  '15m': 1,    // muestra cada minuto
  '1h': 1,     // muestra cada minuto
  '6h': 5,     // bucket 5min
  '24h': 15,   // bucket 15min
  '7d': 60,    // bucket 1h
}

function parseWindow(raw: string | null): WindowKey {
  if (raw && raw in WINDOW_MIN) return raw as WindowKey
  return '1h'
}

type Status = 'green' | 'amber' | 'red'

function computeStatus(sample: {
  idle_in_tx_over_5s: number
  hung_clientread_over_10s: number
  long_active_over_5s: number
  active_conns: number
  frontend_active_conns: number
}): Status {
  if (
    sample.idle_in_tx_over_5s > 0 ||
    sample.hung_clientread_over_10s > 0 ||
    sample.frontend_active_conns >= 13
  ) {
    return 'red'
  }
  if (sample.long_active_over_5s > 0 || sample.active_conns > 20) {
    return 'amber'
  }
  return 'green'
}

interface SampleRow {
  sample_at: string
  total_conns: number
  active_conns: number
  idle_conns: number
  idle_in_tx_conns: number
  idle_in_tx_over_5s: number
  long_active_over_5s: number
  hung_clientread_over_10s: number
  frontend_active_conns: number
  by_app: Record<string, number>
}

async function _GET(request: NextRequest) {
  const auth = await verifyAuth(request, '/api/admin/pool-capacity')
  if (!auth.success) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!isAdmin(auth.email)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const window = parseWindow(request.nextUrl.searchParams.get('window'))
  const includeTimeseries =
    request.nextUrl.searchParams.get('timeseries') === 'true'
  const windowMin = WINDOW_MIN[window]
  const sinceIso = new Date(Date.now() - windowMin * 60_000).toISOString()
  const bucketMin = TIMESERIES_BUCKET_MIN[window]

  const db = getReadDb()

  // ─── Samples raw (limitado a 200 para no inflar respuesta) ───
  // Para ventanas grandes, los samples raw NO se sirven; el cliente
  // usa la timeseries agregada.
  const SAMPLES_LIMIT = window === '15m' || window === '1h' ? 200 : 0

  // pool_capacity_samples NO está en el schema Drizzle -> raw SQL.
  const samplesQuery: Promise<any[]> =
    SAMPLES_LIMIT > 0
      ? (db.execute(sql`
          SELECT sample_at, total_conns, active_conns, idle_conns, idle_in_tx_conns,
                 idle_in_tx_over_5s, long_active_over_5s, hung_clientread_over_10s,
                 frontend_active_conns, by_app
          FROM pool_capacity_samples
          WHERE sample_at >= ${sinceIso}
          ORDER BY sample_at DESC
          LIMIT ${SAMPLES_LIMIT}
        `) as unknown as Promise<any[]>)
      : Promise.resolve([] as any[])

  // ─── Aggregate (counts + max + flags rojas) ───
  // Se calcula en cliente sobre los samples de la ventana.
  const aggregateQuery = db.execute(sql`
    SELECT sample_at, total_conns, active_conns, idle_in_tx_over_5s,
           long_active_over_5s, hung_clientread_over_10s, frontend_active_conns
    FROM pool_capacity_samples
    WHERE sample_at >= ${sinceIso}
    ORDER BY sample_at DESC
  `) as unknown as Promise<any[]>

  // Último sample SIEMPRE (para "estado actual")
  const lastSampleQuery = db.execute(sql`
    SELECT * FROM pool_capacity_samples ORDER BY sample_at DESC LIMIT 1
  `) as unknown as Promise<any[]>

  const [samplesRows, aggregateRows, lastSampleRows] = await Promise.all([
    samplesQuery,
    aggregateQuery,
    lastSampleQuery,
  ])

  const samples = (samplesRows ?? []) as SampleRow[]
  const aggSamples = (aggregateRows ?? []) as Pick<
    SampleRow,
    | 'sample_at'
    | 'total_conns'
    | 'active_conns'
    | 'idle_in_tx_over_5s'
    | 'long_active_over_5s'
    | 'hung_clientread_over_10s'
    | 'frontend_active_conns'
  >[]
  const lastSample = (lastSampleRows[0] ?? null) as SampleRow | null

  // ─── Aggregate metrics ───
  const samplesCount = aggSamples.length
  let redCount = 0
  let amberCount = 0
  let maxActiveConns = 0
  let maxFrontendActive = 0
  let totalIdleInTxFlags = 0
  let totalHungCrFlags = 0
  let totalLongActiveFlags = 0
  for (const s of aggSamples) {
    const status = computeStatus(s)
    if (status === 'red') redCount++
    else if (status === 'amber') amberCount++
    if (s.active_conns > maxActiveConns) maxActiveConns = s.active_conns
    if (s.frontend_active_conns > maxFrontendActive)
      maxFrontendActive = s.frontend_active_conns
    totalIdleInTxFlags += s.idle_in_tx_over_5s
    totalHungCrFlags += s.hung_clientread_over_10s
    totalLongActiveFlags += s.long_active_over_5s
  }
  const greenCount = samplesCount - redCount - amberCount

  // ─── Status agregado de la ventana ───
  const aggregateStatus: Status =
    redCount > 0 ? 'red' : amberCount >= 3 ? 'amber' : 'green'

  // ─── Status actual (último sample) ───
  const currentStatus: Status | null = lastSample
    ? computeStatus(lastSample)
    : null

  // ─── Timeseries opcional (bucketed) ───
  let timeseries: Array<{
    bucket_at: string
    samples: number
    avg_total: number
    max_active: number
    max_frontend_active: number
    red_count: number
  }> | null = null

  if (includeTimeseries && aggSamples.length > 0) {
    const bucketMs = bucketMin * 60_000
    const map = new Map<
      string,
      {
        samples: number
        sumTotal: number
        maxActive: number
        maxFrontend: number
        red: number
      }
    >()
    for (const s of aggSamples) {
      const tsMs = new Date(s.sample_at).getTime()
      const bucketStart = new Date(Math.floor(tsMs / bucketMs) * bucketMs).toISOString()
      const cur = map.get(bucketStart) ?? {
        samples: 0,
        sumTotal: 0,
        maxActive: 0,
        maxFrontend: 0,
        red: 0,
      }
      cur.samples++
      cur.sumTotal += s.total_conns
      if (s.active_conns > cur.maxActive) cur.maxActive = s.active_conns
      if (s.frontend_active_conns > cur.maxFrontend)
        cur.maxFrontend = s.frontend_active_conns
      const status = computeStatus(s)
      if (status === 'red') cur.red++
      map.set(bucketStart, cur)
    }
    timeseries = [...map.entries()]
      .map(([bucket_at, agg]) => ({
        bucket_at,
        samples: agg.samples,
        avg_total: Math.round((agg.sumTotal / agg.samples) * 10) / 10,
        max_active: agg.maxActive,
        max_frontend_active: agg.maxFrontend,
        red_count: agg.red,
      }))
      .sort((a, b) => a.bucket_at.localeCompare(b.bucket_at))
  }

  return NextResponse.json(
    {
      success: true,
      generatedAt: new Date().toISOString(),
      window,
      windowMin,
      bucketMin,
      currentStatus,
      currentSample: lastSample
        ? {
            sample_at: lastSample.sample_at,
            total_conns: lastSample.total_conns,
            active_conns: lastSample.active_conns,
            idle_in_tx_over_5s: lastSample.idle_in_tx_over_5s,
            long_active_over_5s: lastSample.long_active_over_5s,
            hung_clientread_over_10s: lastSample.hung_clientread_over_10s,
            frontend_active_conns: lastSample.frontend_active_conns,
            by_app: lastSample.by_app,
            status: currentStatus,
            ageSec: Math.round(
              (Date.now() - new Date(lastSample.sample_at).getTime()) / 1000,
            ),
          }
        : null,
      aggregate: {
        status: aggregateStatus,
        samplesCount,
        greenCount,
        amberCount,
        redCount,
        maxActiveConns,
        maxFrontendActive,
        totalIdleInTxFlags,
        totalHungCrFlags,
        totalLongActiveFlags,
        // Estimación de saturación máxima del pool del frontend (max:8 × 2 tasks = 16).
        peakFrontendSaturationPct:
          Math.round((maxFrontendActive / 16) * 100),
      },
      samples: samples.map((s) => ({
        ...s,
        status: computeStatus(s),
      })),
      timeseries,
      // Salud del sampler en sí — si lastSample es null o muy antiguo, hay
      // problema en el cron pool-capacity-sampler.
      samplerHealth: {
        lastSampleAt: lastSample?.sample_at ?? null,
        ageSec: lastSample
          ? Math.round(
              (Date.now() - new Date(lastSample.sample_at).getTime()) / 1000,
            )
          : null,
        // Cron corre cada 1 min. Si ageSec > 180, el cron está muerto.
        stale: lastSample
          ? Date.now() - new Date(lastSample.sample_at).getTime() > 180_000
          : true,
      },
    },
    {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    },
  )
}

export const GET = withErrorLogging('/api/admin/pool-capacity', _GET as unknown as () => Promise<Response>)
