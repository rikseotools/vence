// app/admin/infraestructura/page.tsx
// Vista general de infraestructura — resumen agregado de TODAS las áreas
// de salud del sistema. Cards clicables → panel detalle correspondiente.
//
// Lee /api/admin/system-health (9 indicadores: 4 críticos + 5 secundarios).
// Selector temporal: 1h / 6h / 12h / 24h / 7d.
// Mobile responsive con Tailwind grid (1 col mobile → 2 tablet → 4 desktop).
'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { getAuthHeaders } from '@/lib/api/authHeaders'

type Status = 'green' | 'amber' | 'red' | 'unknown'
type WindowKey = '1h' | '6h' | '12h' | '24h' | '7d'

const WINDOW_OPTIONS: Array<{ value: WindowKey; label: string }> = [
  { value: '1h', label: 'Última hora' },
  { value: '6h', label: 'Últimas 6h' },
  { value: '12h', label: 'Últimas 12h' },
  { value: '24h', label: 'Últimas 24h' },
  { value: '7d', label: 'Últimos 7d' },
]

interface SystemHealth {
  success: boolean
  generatedAt: string
  window: WindowKey
  windowHours: number
  indicators: {
    errors_5xx: { status: Status; count: number | null; samples: Array<{ endpoint: string; error_type: string; created_at: string }>; thresholds: { amber: number; red: number } }
    drift: { status: Status; count: number | null; samples: Array<{ target_table: string; field_name: string; drift_pct: number }>; thresholds: { amber: number; red: number } }
    insert_latency: { status: Status; mean_ms: number | null; thresholds: { amber: number; red: number }; note: string }
    drift_cron: { status: Status; last_run_at: string | null; stale_hours: number | null; thresholds: { amber: string; red: string }; note: string }
    canary_uptime: { status: Status; uptimePct: number | null; oks: number; failed: number; breakdown: Array<{ endpoint: string; ok: number; failed: number; uptimePct: number | null }> }
    errors_4xx: { status: Status; count: number | null; topEndpoints: Array<{ endpoint: string; count: number }>; thresholds: { amber: number; red: number } }
    hydration_mismatch: { status: Status; count: number | null; samples: Array<{ endpoint: string; created_at: string }>; thresholds: { amber: number; red: number } }
    request_latency: { status: Status; p50_ms: number | null; p95_ms: number | null; p99_ms: number | null; sampleCount: number; thresholds: { amber: number; red: number } }
    traffic_volume: { status: Status; count: number | null; thresholds: { amber: string; red: string }; note: string }
  }
}

const DOT: Record<Status, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  unknown: 'bg-gray-400',
}

const BORDER: Record<Status, string> = {
  green: 'border-green-400 bg-green-50',
  amber: 'border-amber-400 bg-amber-50',
  red: 'border-red-400 bg-red-50',
  unknown: 'border-gray-300 bg-gray-50',
}

const TEXT: Record<Status, string> = {
  green: 'text-green-900',
  amber: 'text-amber-900',
  red: 'text-red-900',
  unknown: 'text-gray-700',
}

const LABEL: Record<Status, string> = {
  green: 'OK',
  amber: 'ATENCIÓN',
  red: 'FALLO',
  unknown: '—',
}

function fmtAge(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'hace <1 min'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `hace ${diffH}h`
  return `hace ${Math.floor(diffH / 24)}d`
}

function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return '—'
  return Math.round(ms) + 'ms'
}

function Card({
  title,
  status,
  value,
  detail,
  href,
  hint,
}: {
  title: string
  status: Status
  value: string
  detail?: React.ReactNode
  href?: string
  hint?: string
}) {
  const cls = `border-2 rounded-lg p-3 sm:p-4 ${BORDER[status]} ${TEXT[status]} ${href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`
  const body = (
    <div className={cls}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT[status]}`} />
          <h3 className="font-semibold text-sm sm:text-base truncate">{title}</h3>
        </div>
        <span className="text-xs font-bold bg-white/60 px-1.5 py-0.5 rounded flex-shrink-0">
          {LABEL[status]}
        </span>
      </div>
      <div className="text-xl sm:text-2xl font-bold mb-1">{value}</div>
      {detail && <div className="text-xs opacity-80">{detail}</div>}
      {hint && <div className="text-xs opacity-60 mt-1.5">{hint}</div>}
      {href && (
        <div className="text-xs font-medium mt-2 opacity-70 hover:opacity-100">
          Ver detalle →
        </div>
      )}
    </div>
  )
  return href ? <Link href={href}>{body}</Link> : body
}

export default function InfraestructuraOverviewPage() {
  const [data, setData] = useState<SystemHealth | null>(null)
  const [windowKey, setWindowKey] = useState<WindowKey>('24h')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null)

  const fetchHealth = useCallback(async () => {
    try {
      setError(null)
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/admin/system-health?window=${windowKey}`, {
        headers,
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`)
      }
      const json = (await res.json()) as SystemHealth
      setData(json)
      setLastFetchAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [windowKey])

  useEffect(() => {
    fetchHealth()
    const t = setInterval(fetchHealth, 60_000)
    return () => clearInterval(t)
  }, [fetchHealth])

  const ind = data?.indicators

  // Status global = peor de todos los críticos
  const overallStatus: Status = (() => {
    if (!ind) return 'unknown'
    const all = [
      ind.errors_5xx.status,
      ind.drift.status,
      ind.insert_latency.status,
      ind.drift_cron.status,
      ind.canary_uptime.status,
      ind.errors_4xx.status,
      ind.hydration_mismatch.status,
      ind.request_latency.status,
      ind.traffic_volume.status,
    ]
    if (all.includes('red')) return 'red'
    if (all.includes('amber')) return 'amber'
    if (all.every((s) => s === 'green')) return 'green'
    return 'unknown'
  })()

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      {/* Cabecera */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-2">
          <h1 className="text-xl sm:text-2xl font-bold">
            <span className={`inline-block w-3 h-3 rounded-full mr-2 ${DOT[overallStatus]}`} />
            Infraestructura — vista general
          </h1>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 self-start sm:self-auto"
          >
            {loading ? 'Cargando…' : 'Refrescar'}
          </button>
        </div>

        {/* Selector de ventana — responsive: scroll horizontal en mobile */}
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setWindowKey(opt.value)}
              className={`px-3 py-1 text-xs sm:text-sm rounded border whitespace-nowrap flex-shrink-0 ${
                windowKey === opt.value
                  ? 'bg-blue-600 text-white border-blue-700'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {lastFetchAt && (
          <p className="text-xs text-gray-500 mt-2">
            Actualizado: {lastFetchAt.toLocaleTimeString('es-ES')} · ventana {windowKey} · auto-refresh 60s
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded border border-red-300 bg-red-50 text-red-900 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!ind && loading && (
        <p className="text-gray-500 text-center py-8">Cargando indicadores…</p>
      )}

      {ind && (
        <>
          {/* ─── Indicadores CRÍTICOS ─── */}
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2 mt-4">
            🔥 Críticos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Card
              title="Errores 5xx"
              status={ind.errors_5xx.status}
              value={String(ind.errors_5xx.count ?? '—')}
              hint={`Umbrales: ámbar ≥${ind.errors_5xx.thresholds.amber}, rojo ≥${ind.errors_5xx.thresholds.red}`}
              href={ind.errors_5xx.status === 'green' ? '/admin/errores-validacion' : '/admin/errores-validacion'}
              detail={
                ind.errors_5xx.samples.length > 0 && (
                  <div className="font-mono text-xs truncate">
                    {ind.errors_5xx.samples[0].endpoint.slice(0, 30)}
                  </div>
                )
              }
            />
            <Card
              title="Drift contadores"
              status={ind.drift.status}
              value={String(ind.drift.count ?? '—')}
              hint={`Umbrales: ámbar ≥${ind.drift.thresholds.amber}, rojo ≥${ind.drift.thresholds.red}`}
              detail={
                ind.drift.samples.length > 0 && (
                  <div className="font-mono text-xs truncate">
                    {ind.drift.samples[0].target_table}.{ind.drift.samples[0].field_name}
                  </div>
                )
              }
            />
            <Card
              title="Latencia INSERT BD"
              status={ind.insert_latency.status}
              value={fmtMs(ind.insert_latency.mean_ms)}
              hint={`Ámbar ≥${ind.insert_latency.thresholds.amber}ms · rojo ≥${ind.insert_latency.thresholds.red}ms`}
              href="/admin/infraestructura/detalles-pooler"
              detail="mean histórico pg_stat_statements"
            />
            <Card
              title="Cron drift vivo"
              status={ind.drift_cron.status}
              value={fmtAge(ind.drift_cron.last_run_at)}
              hint="Ámbar >26h sin correr · rojo >36h"
              detail={ind.drift_cron.stale_hours != null && `${ind.drift_cron.stale_hours}h desde último run`}
            />
          </div>

          {/* ─── Indicadores SECUNDARIOS ─── */}
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2 mt-4">
            📊 Observabilidad (window {windowKey})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Card
              title="Canary uptime"
              status={ind.canary_uptime.status}
              value={ind.canary_uptime.uptimePct != null ? `${ind.canary_uptime.uptimePct.toFixed(2)}%` : '—'}
              hint="6 canarios Fargate */5min"
              href="/admin/canary"
              detail={
                <span>
                  {ind.canary_uptime.oks} OK / {ind.canary_uptime.failed} fail
                </span>
              }
            />
            <Card
              title="Errores 4xx"
              status={ind.errors_4xx.status}
              value={String(ind.errors_4xx.count ?? '—')}
              hint={`Ámbar ≥${ind.errors_4xx.thresholds.amber} · rojo ≥${ind.errors_4xx.thresholds.red}`}
              href="/admin/errores-validacion"
              detail={
                ind.errors_4xx.topEndpoints.length > 0 && (
                  <div className="font-mono text-xs truncate">
                    {ind.errors_4xx.topEndpoints[0].endpoint.slice(0, 30)} ({ind.errors_4xx.topEndpoints[0].count})
                  </div>
                )
              }
            />
            <Card
              title="Hydration mismatch"
              status={ind.hydration_mismatch.status}
              value={String(ind.hydration_mismatch.count ?? '—')}
              hint={`Ámbar ≥${ind.hydration_mismatch.thresholds.amber} · rojo ≥${ind.hydration_mismatch.thresholds.red}`}
              href="/admin/errores-validacion"
              detail={
                ind.hydration_mismatch.samples.length > 0 && (
                  <div className="font-mono text-xs truncate">
                    {ind.hydration_mismatch.samples[0].endpoint.slice(0, 30)}
                  </div>
                )
              }
            />
            <Card
              title="Latencia p95 requests"
              status={ind.request_latency.status}
              value={fmtMs(ind.request_latency.p95_ms)}
              hint={`Ámbar ≥${ind.request_latency.thresholds.amber}ms · rojo ≥${ind.request_latency.thresholds.red}ms`}
              href="/admin/infraestructura/detalles-pooler"
              detail={
                <span>
                  p50 {fmtMs(ind.request_latency.p50_ms)} · p99 {fmtMs(ind.request_latency.p99_ms)} · n={ind.request_latency.sampleCount}
                </span>
              }
            />
          </div>

          {/* ─── Volumen tráfico (full width) ─── */}
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2 mt-4">
            📈 Sanity
          </h2>
          <div className="grid grid-cols-1 gap-3 mb-6">
            <Card
              title={`Volumen request_completed (window ${windowKey})`}
              status={ind.traffic_volume.status}
              value={String(ind.traffic_volume.count ?? '—')}
              hint={ind.traffic_volume.note}
              detail={`Ámbar: ${ind.traffic_volume.thresholds.amber} · Rojo: ${ind.traffic_volume.thresholds.red}`}
            />
          </div>

          {/* ─── Atajos a paneles especializados ─── */}
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2 mt-4">
            🔗 Paneles especializados
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <Link href="/admin/canary" className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-50 text-center">
              Canarios (6 + heartbeat)
            </Link>
            <Link href="/admin/infraestructura/detalles-pooler" className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-50 text-center">
              Detalles BD / Pooler
            </Link>
            <Link href="/admin/salud-sistema" className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-50 text-center">
              Salud sistema (legacy)
            </Link>
            <Link href="/admin/errores-validacion" className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-50 text-center">
              Errores validación
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
