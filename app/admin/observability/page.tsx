// app/admin/observability/page.tsx
// Dashboard admin de observabilidad — Bloque 4 Gap 9.
//
// Vista panorámica de qué pasa en el sistema. Complementa /admin/salud-sistema
// (semáforos críticos) con datos exploratorios:
//
//   - Volumen de eventos por source/severity/event_type
//   - Timeseries por hora (errors, 5xx, 2xx)
//   - Top errores recientes con sample del mensaje
//   - Endpoints más lentos (p50/p95/p99)
//   - Eventos client-side capturados (tts, hydration_mismatch, etc.)
//
// Selector de ventana temporal: 1h, 6h, 24h, 7d.

'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/lib/api/adminFetch'
import { getAuthHeaders } from '@/lib/api/authHeaders'

type WindowKey = '1h' | '6h' | '24h' | '7d'

interface ObservabilityResponse {
  success: boolean
  generatedAt: string
  window: WindowKey
  windowHours: number
  total: number
  bySourceAndSeverity: Array<{ source: string; severity: string; n: number }>
  byEventType: Array<{ event_type: string; severity: string; n: number; last_ts: string }>
  topErrors: Array<{
    endpoint: string | null
    event_type: string
    severity: string
    http_status: number | null
    n: number
    last_ts: string
    sample_message: string | null
  }>
  slowEndpoints: Array<{
    endpoint: string
    n: number
    avg_ms: number
    p50_ms: number
    p95_ms: number
    p99_ms: number
    max_ms: number
  }>
  clientSideEvents: Array<{ event_type: string; severity: string; n: number; last_ts: string }>
  timeseries: Array<{
    hour: string
    total: number
    errors: number
    critical: number
    s5xx: number
    s2xx: number
  }>
}

function severityColor(sev: string): string {
  switch (sev) {
    case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
    case 'error': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200'
    case 'warn': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
    case 'info': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
    case 'debug': return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
    default: return 'bg-gray-100 text-gray-700'
  }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', hour12: false })
  } catch {
    return iso
  }
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export default function ObservabilityDashboard() {
  const [window, setWindow] = useState<WindowKey>('6h')
  const [data, setData] = useState<ObservabilityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await getAuthHeaders()
      const res = await adminFetch(`/api/admin/observability?window=${window}`, { headers })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }, [window])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const maxTotal = data ? Math.max(...data.timeseries.map(t => t.total), 1) : 1

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Observability Dashboard
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Vista panorámica de eventos del sistema (Bloque 4 Gap 9).{' '}
              <a href="/admin/salud-sistema" className="text-blue-600 hover:underline">
                ¿Está roto?
              </a>{' '}
              ·{' '}
              <a href="/admin/slos" className="text-blue-600 hover:underline">SLOs</a>
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
              {(['1h', '6h', '24h', '7d'] as WindowKey[]).map(w => (
                <button
                  key={w}
                  onClick={() => setWindow(w)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    window === w
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 disabled:opacity-50"
            >
              {loading ? '⟳' : '↻'} Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}

        {data && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total eventos</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data.total.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  últimas {data.windowHours}h
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Eventos críticos</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {data.bySourceAndSeverity
                    .filter(r => r.severity === 'critical')
                    .reduce((s, r) => s + r.n, 0)
                    .toLocaleString()}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Eventos error</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {data.bySourceAndSeverity
                    .filter(r => r.severity === 'error')
                    .reduce((s, r) => s + r.n, 0)
                    .toLocaleString()}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Client-side events</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {data.clientSideEvents.reduce((s, r) => s + r.n, 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Timeseries Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-6">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Volumen por hora ({data.timeseries.length} puntos)
              </h2>
              {data.timeseries.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Sin datos en la ventana.</p>
              ) : (
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-1 h-32 min-w-[400px]">
                    {data.timeseries.map((t, i) => {
                      const heightPct = (t.total / maxTotal) * 100
                      const errorPct = t.total > 0 ? ((t.errors + t.critical) / t.total) * 100 : 0
                      return (
                        <div
                          key={i}
                          className="flex-1 flex flex-col-reverse h-full group relative"
                          title={`${fmtDate(t.hour)}\n  total=${t.total}\n  errors=${t.errors}\n  critical=${t.critical}\n  5xx=${t.s5xx}\n  2xx=${t.s2xx}`}
                        >
                          <div
                            className="bg-blue-500 dark:bg-blue-400 rounded-t"
                            style={{ height: `${heightPct}%`, minHeight: '2px' }}
                          />
                          {errorPct > 0 && (
                            <div
                              className="bg-red-500 dark:bg-red-400 absolute bottom-0 left-0 right-0 rounded-t opacity-80"
                              style={{ height: `${heightPct * (errorPct / 100)}%`, minHeight: '2px' }}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                    <span>{fmtDate(data.timeseries[0]?.hour ?? '')}</span>
                    <span>{fmtDate(data.timeseries[data.timeseries.length - 1]?.hour ?? '')}</span>
                  </div>
                </div>
              )}
            </div>

            {/* By Source + Severity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Por source + severity
                </h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2">Source</th>
                      <th>Severity</th>
                      <th className="text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bySourceAndSeverity.map((r, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                        <td className="py-1.5 text-gray-900 dark:text-gray-100">{r.source}</td>
                        <td>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${severityColor(r.severity)}`}>
                            {r.severity}
                          </span>
                        </td>
                        <td className="text-right text-gray-700 dark:text-gray-300 font-mono">
                          {r.n.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Client-Side Events */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Client-side (source=frontend)
                </h2>
                {data.clientSideEvents.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Sin eventos client-side.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="py-2">Event type</th>
                        <th>Sev</th>
                        <th className="text-right">N</th>
                        <th className="text-right">Last</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.clientSideEvents.map((r, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="py-1.5 text-gray-900 dark:text-gray-100 font-mono text-xs">
                            {r.event_type}
                          </td>
                          <td>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${severityColor(r.severity)}`}>
                              {r.severity.charAt(0)}
                            </span>
                          </td>
                          <td className="text-right text-gray-700 dark:text-gray-300 font-mono text-xs">
                            {r.n}
                          </td>
                          <td className="text-right text-xs text-gray-500 dark:text-gray-400">
                            {fmtDate(r.last_ts).slice(11, 16)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Top Errors */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-6">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Top errores (severity error/critical)
              </h2>
              {data.topErrors.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ✅ Sin errores en la ventana seleccionada.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="py-2">Endpoint</th>
                        <th>Event type</th>
                        <th>Sev</th>
                        <th>HTTP</th>
                        <th className="text-right">N</th>
                        <th>Sample</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topErrors.map((r, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="py-1.5 text-gray-900 dark:text-gray-100 font-mono text-xs">
                            {r.endpoint ?? '-'}
                          </td>
                          <td className="text-xs text-gray-700 dark:text-gray-300">{r.event_type}</td>
                          <td>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${severityColor(r.severity)}`}>
                              {r.severity}
                            </span>
                          </td>
                          <td className="text-xs text-gray-700 dark:text-gray-300">
                            {r.http_status ?? '-'}
                          </td>
                          <td className="text-right text-gray-700 dark:text-gray-300 font-mono text-xs">
                            {r.n}
                          </td>
                          <td className="text-xs text-gray-600 dark:text-gray-400 max-w-md truncate">
                            {r.sample_message ?? '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Slow Endpoints */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-6">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Endpoints más lentos (p95 desc, duration_ms &gt; 200)
              </h2>
              {data.slowEndpoints.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ✅ Sin endpoints lentos en la ventana.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="py-2">Endpoint</th>
                        <th className="text-right">N</th>
                        <th className="text-right">avg</th>
                        <th className="text-right">p50</th>
                        <th className="text-right">p95</th>
                        <th className="text-right">p99</th>
                        <th className="text-right">max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.slowEndpoints.map((r, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="py-1.5 text-gray-900 dark:text-gray-100 font-mono text-xs">
                            {r.endpoint}
                          </td>
                          <td className="text-right text-gray-700 dark:text-gray-300 font-mono text-xs">
                            {r.n}
                          </td>
                          <td className="text-right text-gray-700 dark:text-gray-300 font-mono text-xs">
                            {fmtDuration(r.avg_ms)}
                          </td>
                          <td className="text-right text-gray-700 dark:text-gray-300 font-mono text-xs">
                            {fmtDuration(r.p50_ms)}
                          </td>
                          <td className="text-right text-gray-700 dark:text-gray-300 font-mono text-xs font-semibold">
                            {fmtDuration(r.p95_ms)}
                          </td>
                          <td className="text-right text-orange-600 dark:text-orange-400 font-mono text-xs">
                            {fmtDuration(r.p99_ms)}
                          </td>
                          <td className="text-right text-red-600 dark:text-red-400 font-mono text-xs">
                            {fmtDuration(r.max_ms)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Generado: {fmtDate(data.generatedAt)} · Ventana: {data.window}
            </p>
          </>
        )}

        {loading && !data && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Cargando...</p>
          </div>
        )}
      </div>
    </div>
  )
}
