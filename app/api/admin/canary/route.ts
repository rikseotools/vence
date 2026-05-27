// app/api/admin/canary/route.ts
// Resumen agregado de los canarios Fargate: uptime + latencia por canary.
//
// Lee `observable_events` filtrado por endpoint='canary-*' y últimas 24h.
// Devuelve por cada canary: uptime %, p50/p95 latencia, último ok/fail.
//
// Consumido por /admin/canary/page.tsx.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const ADMIN_EMAILS = [
  'admin@vencemitfg.es',
  'manuel@vencemitfg.es',
  'manueltrader@gmail.com',
]

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email) || email.endsWith('@vencemitfg.es')
}

// Canarios activos a mostrar. Añadir aquí cuando se cree uno nuevo.
const CANARY_ENDPOINTS = [
  'canary-smoke-auth',
  'canary-stripe-webhook',
  'canary-answer-save',
  'canary-database-pool',
  'canary-redis-upstash',
  'external-heartbeat', // ping a Healthchecks.io — watcher del watcher
] as const

type Status = 'green' | 'amber' | 'red' | 'unknown'

interface CanarySummary {
  endpoint: string
  status: Status
  uptime24h: number | null // % (0-100)
  uptime7d: number | null
  latencyP50_24h: number | null // ms
  latencyP95_24h: number | null
  oks24h: number
  failures24h: number
  skipped24h: number
  warnings24h: number // question_invalid u otros warn
  lastOkAt: string | null
  lastFailureAt: string | null
  lastFailureMessage: string | null
  lastEventAt: string | null
}

interface CanaryEvent {
  endpoint: string
  event_type: string
  severity: string
  duration_ms: number | null
  error_message: string | null
  created_at: string
}

function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null
  const idx = Math.ceil(sorted.length * p) - 1
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))]
}

function aggregate(events: CanaryEvent[], endpoint: string, windowH: number): {
  uptime: number | null
  p50: number | null
  p95: number | null
  oks: number
  failures: number
  skipped: number
  warnings: number
  lastOkAt: string | null
  lastFailureAt: string | null
  lastFailureMessage: string | null
  lastEventAt: string | null
} {
  const sinceMs = Date.now() - windowH * 60 * 60 * 1000
  const filtered = events.filter(
    e => e.endpoint === endpoint && new Date(e.created_at).getTime() >= sinceMs
  )

  let oks = 0
  let failures = 0
  let skipped = 0
  let warnings = 0
  let lastOkAt: string | null = null
  let lastFailureAt: string | null = null
  let lastFailureMessage: string | null = null
  let lastEventAt: string | null = null
  const okLatencies: number[] = []

  for (const e of filtered) {
    if (!lastEventAt || e.created_at > lastEventAt) lastEventAt = e.created_at
    if (e.event_type.endsWith('_ok')) {
      oks++
      if (typeof e.duration_ms === 'number') okLatencies.push(e.duration_ms)
      if (!lastOkAt || e.created_at > lastOkAt) lastOkAt = e.created_at
    } else if (e.event_type.endsWith('_failed')) {
      failures++
      if (!lastFailureAt || e.created_at > lastFailureAt) {
        lastFailureAt = e.created_at
        lastFailureMessage = e.error_message
      }
    } else if (e.event_type.endsWith('_skipped')) {
      skipped++
    } else if (e.severity === 'warn') {
      warnings++
    }
  }

  const decided = oks + failures
  const uptime = decided > 0 ? (oks / decided) * 100 : null

  okLatencies.sort((a, b) => a - b)

  return {
    uptime,
    p50: percentile(okLatencies, 0.5),
    p95: percentile(okLatencies, 0.95),
    oks,
    failures,
    skipped,
    warnings,
    lastOkAt,
    lastFailureAt,
    lastFailureMessage,
    lastEventAt,
  }
}

function classify(uptime24h: number | null, oks24h: number, lastEventAt: string | null): Status {
  if (lastEventAt === null) return 'unknown'
  // Sin datos OK en 24h pero hay eventos (skipped/failed) → red.
  if (uptime24h === null) {
    return oks24h === 0 ? 'amber' : 'unknown'
  }
  if (uptime24h >= 99) return 'green'
  if (uptime24h >= 95) return 'amber'
  return 'red'
}

async function _GET(request: NextRequest) {
  const auth = await verifyAuth(request, '/api/admin/canary')
  if (!auth.success || !isAdmin(auth.email)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Una sola query trae todos los eventos relevantes últimas 7d.
  // Volumen estimado: 3 canarios × 288 ticks/día × ~2 eventos/tick × 7 días ≈ 12k filas. OK.
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('observable_events')
    .select('endpoint, event_type, severity, duration_ms, error_message, created_at')
    .in('endpoint', CANARY_ENDPOINTS as readonly string[] as string[])
    .gte('created_at', since7d)
    .order('created_at', { ascending: false })
    .limit(15000)

  if (error) {
    return NextResponse.json(
      { error: `Lectura observable_events falló: ${error.message}` },
      { status: 500 }
    )
  }

  const events = (data ?? []) as CanaryEvent[]

  const canaries: CanarySummary[] = CANARY_ENDPOINTS.map(endpoint => {
    const a24 = aggregate(events, endpoint, 24)
    const a7d = aggregate(events, endpoint, 7 * 24)
    return {
      endpoint,
      status: classify(a24.uptime, a24.oks, a24.lastEventAt),
      uptime24h: a24.uptime,
      uptime7d: a7d.uptime,
      latencyP50_24h: a24.p50,
      latencyP95_24h: a24.p95,
      oks24h: a24.oks,
      failures24h: a24.failures,
      skipped24h: a24.skipped,
      warnings24h: a24.warnings,
      lastOkAt: a24.lastOkAt,
      lastFailureAt: a24.lastFailureAt,
      lastFailureMessage: a24.lastFailureMessage,
      lastEventAt: a24.lastEventAt,
    }
  })

  return NextResponse.json({
    success: true,
    generatedAt: new Date().toISOString(),
    canaries,
  })
}

export const GET = withErrorLogging('/api/admin/canary', _GET)
