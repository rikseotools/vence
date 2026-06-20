// app/admin/canary/page.tsx
// Dashboard de salud de los canarios Fargate.
//
// Auto-refresh 60s. Lee /api/admin/canary que agrega observable_events.
// Por cada canary: status (verde/ámbar/rojo), uptime 24h+7d, latencia
// p50/p95, último ok y último fallo con mensaje.
'use client'

import { useCallback, useEffect, useState } from 'react'
import { getAuthHeaders } from '@/lib/api/authHeaders'

type Status = 'green' | 'amber' | 'red' | 'unknown'

interface CanarySummary {
  endpoint: string
  status: Status
  uptime24h: number | null
  uptime7d: number | null
  latencyP50_24h: number | null
  latencyP95_24h: number | null
  oks24h: number
  failures24h: number
  skipped24h: number
  warnings24h: number
  lastOkAt: string | null
  lastFailureAt: string | null
  lastFailureMessage: string | null
  lastEventAt: string | null
}

interface CanaryResponse {
  success: boolean
  generatedAt: string
  canaries: CanarySummary[]
}

const STATUS_COLOR: Record<Status, string> = {
  green: 'bg-green-100 text-green-900 border-green-400',
  amber: 'bg-amber-100 text-amber-900 border-amber-400',
  red: 'bg-red-100 text-red-900 border-red-400',
  unknown: 'bg-gray-100 text-gray-700 border-gray-300',
}

const STATUS_DOT: Record<Status, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  unknown: 'bg-gray-400',
}

const STATUS_LABEL: Record<Status, string> = {
  green: 'OK',
  amber: 'ATENCIÓN',
  red: 'FALLO',
  unknown: 'SIN DATOS',
}

// Descripción humana de cada canary (qué cubre).
const CANARY_DESCRIPTION: Record<string, string> = {
  'canary-smoke-auth':
    'GET /api/profile con JWT smoke firmado local. Cubre regresiones de Drizzle / RLS / JwtGuard / timeouts.',
  'canary-stripe-webhook':
    'POST /api/stripe/webhook con evento sintético firmado. Cubre SSM stale / handler 404 / signature code roto.',
  'canary-answer-save':
    'POST /api/v2/answer-and-save (endpoint MÁS caliente). Cubre antifraud / daily-limit / Drizzle transactional save.',
  'canary-database-pool':
    'SELECT 1 con timeout 1s. Detecta saturación PgBouncer / max_connections agotados / BD caída.',
  'canary-redis-upstash':
    'SET/GET/DEL ephemeral key contra Upstash. Detecta caída del cache compartido (cascada BD inminente).',
  'external-heartbeat':
    'Ping a Healthchecks.io (servicio EXTERNO). Si Fargate cae completo y este ping deja de llegar, Healthchecks.io alarma por email/SMS. Watcher del watcher — última línea de defensa.',
}

function fmtPct(v: number | null): string {
  if (v === null) return '—'
  return v.toFixed(2) + '%'
}

function fmtMs(v: number | null): string {
  if (v === null) return '—'
  return Math.round(v) + 'ms'
}

function fmtAge(iso: string | null): string {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'hace <1 min'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `hace ${diffH}h`
  return `hace ${Math.floor(diffH / 24)}d`
}

interface RunNowResult {
  name: string
  status: string
  durationMs?: number | null
  step?: string
  error?: string
  httpStatus?: number | null
  reason?: string
}

interface RunNowResponse {
  success: boolean
  totalMs: number
  ranAt: string
  ranBy: string
  summary: { total: number; ok: number; failed: number; skipped: number; other: number }
  results: RunNowResult[]
}

export default function CanaryDashboardPage() {
  const [data, setData] = useState<CanaryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null)
  const [runResult, setRunResult] = useState<RunNowResponse | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  const fetchCanaries = useCallback(async () => {
    try {
      setError(null)
      const headers = await getAuthHeaders()
      const res = await fetch('/api/admin/canary', { headers })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`)
      }
      const json = (await res.json()) as CanaryResponse
      setData(json)
      setLastFetchAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCanaries()
    const t = setInterval(fetchCanaries, 60_000)
    return () => clearInterval(t)
  }, [fetchCanaries])

  const runNow = useCallback(async () => {
    setRunning(true)
    setRunError(null)
    setRunResult(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/admin/canary/run-now', {
        method: 'POST',
        headers,
      })
      const body = await res.text()
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`)
      }
      const json = JSON.parse(body) as RunNowResponse
      setRunResult(json)
      // Refrescar dashboard tras run para reflejar eventos OK/fail nuevos.
      fetchCanaries()
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }, [fetchCanaries])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Canarios — Salud y latencia</h1>
          <p className="text-sm text-gray-600 mt-1">
            Auto-refresh cada 60s. Cada canary corre */5min en Fargate.
            Datos de los últimos 7 días desde <code>observable_events</code>.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={runNow}
            disabled={running}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            title="Dispara los 5 canarios ahora sin esperar al próximo */5min"
          >
            {running ? 'Ejecutando 5 canarios…' : '⚡ Run Now (todos)'}
          </button>
          <button
            onClick={fetchCanaries}
            disabled={loading}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? 'Cargando…' : 'Refrescar'}
          </button>
        </div>
      </div>

      {runError && (
        <div className="mb-4 p-3 rounded border border-red-300 bg-red-50 text-red-900 text-sm">
          <strong>Run Now falló:</strong> {runError}
        </div>
      )}

      {runResult && (
        <div className={`mb-4 p-3 rounded border ${runResult.success ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'} text-sm`}>
          <div className="font-semibold mb-1">
            Run Now {runResult.success ? '✅' : '⚠️'} — {runResult.summary.ok}/{runResult.summary.total} OK ({runResult.totalMs}ms total)
          </div>
          <ul className="text-xs space-y-0.5 font-mono">
            {runResult.results.map(r => (
              <li key={r.name}>
                {r.status === 'ok' && <span>✅</span>}
                {r.status === 'failed' && <span>❌</span>}
                {r.status === 'skipped' && <span>⏭️</span>}
                {r.status === 'question_invalid' && <span>⚠️</span>}
                {r.status === 'exception' && <span>💥</span>}
                {' '}
                <strong>{r.name}</strong> — {r.status}
                {r.durationMs != null && ` (${r.durationMs}ms)`}
                {r.error && <span className="text-red-700"> — {r.error.slice(0, 100)}</span>}
                {r.reason && <span className="text-gray-600"> ({r.reason})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded border border-red-300 bg-red-50 text-red-900 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {lastFetchAt && (
        <p className="text-xs text-gray-500 mb-4">
          Última actualización: {lastFetchAt.toLocaleTimeString('es-ES')} ·
          generado server: {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString('es-ES') : '—'}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-1">
        {(data?.canaries ?? []).map(c => (
          <div
            key={c.endpoint}
            className={`border-2 rounded-lg p-4 ${STATUS_COLOR[c.status]}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${STATUS_DOT[c.status]}`} />
                <h2 className="text-lg font-semibold font-mono">{c.endpoint}</h2>
              </div>
              <span className="text-xs font-bold px-2 py-1 bg-white/60 rounded">
                {STATUS_LABEL[c.status]}
              </span>
            </div>

            <p className="text-sm mb-3 opacity-80">
              {CANARY_DESCRIPTION[c.endpoint] ?? 'Canary sin descripción registrada.'}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-xs opacity-70">Uptime 24h</div>
                <div className="font-bold text-lg">{fmtPct(c.uptime24h)}</div>
                <div className="text-xs opacity-70">
                  {c.oks24h} OK / {c.failures24h} fail
                </div>
              </div>
              <div>
                <div className="text-xs opacity-70">Uptime 7d</div>
                <div className="font-bold text-lg">{fmtPct(c.uptime7d)}</div>
              </div>
              <div>
                <div className="text-xs opacity-70">Latencia 24h</div>
                <div className="font-bold">{fmtMs(c.latencyP50_24h)} <span className="opacity-60 text-xs">p50</span></div>
                <div className="text-xs">{fmtMs(c.latencyP95_24h)} <span className="opacity-60">p95</span></div>
              </div>
              <div>
                <div className="text-xs opacity-70">Último evento</div>
                <div className="font-bold">{fmtAge(c.lastEventAt)}</div>
                {c.skipped24h > 0 && (
                  <div className="text-xs">{c.skipped24h} skipped 24h</div>
                )}
                {c.warnings24h > 0 && (
                  <div className="text-xs">{c.warnings24h} warn 24h</div>
                )}
              </div>
            </div>

            {c.lastFailureAt && (
              <div className="mt-3 p-2 bg-white/60 rounded text-xs">
                <div>
                  <strong>Último fallo:</strong> {fmtAge(c.lastFailureAt)} —{' '}
                  <span className="font-mono">{c.lastFailureMessage ?? '(sin mensaje)'}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {!data && !error && !loading && (
        <p className="text-gray-500 text-center py-8">Sin datos.</p>
      )}
    </div>
  )
}
