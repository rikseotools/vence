// app/admin/salud-sistema/page.tsx
// Panel admin de salud del sistema: 4 indicadores con semáforo.
//
//   1) Errores 5xx últimas 24h
//   2) Drift de contadores materializados últimas 24h
//   3) Latencia INSERT a test_questions (proxy_p95 desde pg_stat_statements)
//   4) Salud del cron de drift (¿corrió en últimas 36h?)
//
// El runbook docs/runbooks/health-check.md explica qué hacer cuando un
// indicador se pone ámbar o rojo.
'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAuthHeaders } from '@/lib/api/authHeaders'

type Status = 'green' | 'amber' | 'red' | 'unknown'

interface SystemHealthResponse {
  success: boolean
  generatedAt: string
  indicators: {
    errors_5xx: {
      status: Status
      count: number | null
      samples: Array<{ endpoint: string; error_type: string; created_at: string }>
      thresholds: { amber: number; red: number }
    }
    drift: {
      status: Status
      count: number | null
      samples: Array<{
        target_table: string
        field_name: string
        drift_pct: number | null
        user_id: string
        checked_at: string
        notes: string | null
      }>
      thresholds: { amber: number; red: number }
    }
    insert_latency: {
      status: Status
      mean_ms: number | null
      variants: Array<{
        mean_ms: number | string
        proxy_p95_ms: number | string
        max_ms: number | string
        stddev_ms: number | string
        calls: number
        query_snippet: string
      }>
      thresholds: { amber: number; red: number }
      note: string
    }
    drift_cron: {
      status: Status
      last_run_at: string | null
      stale_hours: number | null
      thresholds: { amber: string; red: string }
    }
  }
  error?: string
}

const STATUS_BADGE: Record<Status, string> = {
  green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300',
  amber: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100 border-yellow-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 border-red-400',
  unknown: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 border-gray-300',
}

const STATUS_LABEL: Record<Status, string> = {
  green: 'OK',
  amber: 'Atención',
  red: 'Problema',
  unknown: 'Sin datos',
}

export default function SaludSistemaPage() {
  const [data, setData] = useState<SystemHealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/admin/system-health', { headers })
      const json = (await res.json()) as SystemHealthResponse
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    // Auto-refresh cada 60s para que el panel esté siempre actualizado
    // sin tener que recargar a mano
    const t = setInterval(fetchHealth, 60_000)
    return () => clearInterval(t)
  }, [fetchHealth])

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Salud del sistema
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            4 indicadores en tiempo real. Auto-refresh cada 60s. Runbook:{' '}
            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
              docs/runbooks/health-check.md
            </code>
          </p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded transition-colors"
        >
          {loading ? 'Cargando…' : 'Refrescar ahora'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
          Error: {error}
        </div>
      )}

      {data && (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Generado: {new Date(data.generatedAt).toLocaleString('es-ES')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1) Errores 5xx */}
            <IndicatorCard
              title="Errores 5xx últimas 24h"
              status={data.indicators.errors_5xx.status}
              metric={String(data.indicators.errors_5xx.count ?? '—')}
              hint={`Umbrales: ámbar ≥${data.indicators.errors_5xx.thresholds.amber}, rojo ≥${data.indicators.errors_5xx.thresholds.red}`}
            >
              {data.indicators.errors_5xx.samples.length > 0 ? (
                <ul className="text-xs space-y-1 mt-2 max-h-48 overflow-y-auto">
                  {data.indicators.errors_5xx.samples.map((s, i) => (
                    <li key={i} className="text-gray-600 dark:text-gray-300">
                      <span className="font-mono">{s.endpoint}</span> · {s.error_type} ·{' '}
                      {new Date(s.created_at).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Sin errores críticos en 24h.</p>
              )}
            </IndicatorCard>

            {/* 2) Drift */}
            <IndicatorCard
              title="Drift contadores 24h (>5%)"
              status={data.indicators.drift.status}
              metric={String(data.indicators.drift.count ?? '—')}
              hint={`Umbrales: ámbar ≥${data.indicators.drift.thresholds.amber}, rojo ≥${data.indicators.drift.thresholds.red}`}
            >
              {data.indicators.drift.samples.length > 0 ? (
                <ul className="text-xs space-y-1 mt-2 max-h-48 overflow-y-auto">
                  {data.indicators.drift.samples.map((s, i) => (
                    <li key={i} className="text-gray-600 dark:text-gray-300">
                      <span className="font-mono">{s.target_table}.{s.field_name}</span>{' '}
                      · drift {s.drift_pct}% · user {s.user_id.slice(0, 8)}…
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Sin drift significativo en 24h.
                </p>
              )}
            </IndicatorCard>

            {/* 3) Latencia INSERT */}
            <IndicatorCard
              title="Latencia INSERT test_questions"
              status={data.indicators.insert_latency.status}
              metric={
                data.indicators.insert_latency.mean_ms != null
                  ? `${data.indicators.insert_latency.mean_ms.toFixed(1)}ms`
                  : '—'
              }
              hint={`Umbrales mean: ámbar ≥${data.indicators.insert_latency.thresholds.amber}ms, rojo ≥${data.indicators.insert_latency.thresholds.red}ms`}
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                {data.indicators.insert_latency.note}
              </p>
              {data.indicators.insert_latency.variants.length > 0 && (
                <div className="mt-2 space-y-1 text-xs">
                  {data.indicators.insert_latency.variants.slice(0, 3).map((v, i) => (
                    <div key={i} className="text-gray-600 dark:text-gray-300">
                      <span className="font-mono">{Number(v.calls).toLocaleString()} calls</span>{' '}
                      · mean {Number(v.mean_ms).toFixed(2)}ms · max {Number(v.max_ms).toFixed(1)}ms
                    </div>
                  ))}
                </div>
              )}
            </IndicatorCard>

            {/* 4) Salud cron de drift */}
            <IndicatorCard
              title="Cron de drift (¿vivo?)"
              status={data.indicators.drift_cron.status}
              metric={
                data.indicators.drift_cron.stale_hours != null
                  ? `hace ${data.indicators.drift_cron.stale_hours}h`
                  : 'nunca'
              }
              hint={`Umbrales: ámbar ${data.indicators.drift_cron.thresholds.amber}, rojo ${data.indicators.drift_cron.thresholds.red}`}
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Última ejecución:{' '}
                {data.indicators.drift_cron.last_run_at
                  ? new Date(data.indicators.drift_cron.last_run_at).toLocaleString('es-ES')
                  : '—'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Workflow: <code>.github/workflows/check-stats-drift.yml</code> · 04:00 UTC diario
              </p>
            </IndicatorCard>
          </div>
        </>
      )}
    </div>
  )
}

function IndicatorCard({
  title,
  status,
  metric,
  hint,
  children,
}: {
  title: string
  status: Status
  metric: string
  hint: string
  children?: React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">{title}</h3>
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>
      <p className="text-3xl font-semibold text-gray-900 dark:text-gray-50 mt-3">
        {metric}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{hint}</p>
      {children}
    </div>
  )
}
