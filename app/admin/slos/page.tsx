// app/admin/slos/page.tsx
//
// Panel admin SLO — readiness de SLOs (Bloque 5 Fase E.4.5).
//
// 7 indicadores con semáforo verde/ámbar/rojo. Si TODOS verdes →
// "CUTOVER GO". Cualquier rojo → "NO CUTOVER, investigar".
//
// Auto-refresh cada 30s.
'use client'

import { useState, useEffect, useCallback } from 'react'
import { adminFetch } from '@/lib/api/adminFetch'
import { getAuthHeaders } from '@/lib/api/authHeaders'

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

const STATUS_COLOR: Record<Status, string> = {
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  unknown: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
}

const STATUS_DOT: Record<Status, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  unknown: 'bg-gray-400',
}

const STATUS_LABEL: Record<Status, string> = {
  green: '✓ Verde',
  amber: '⚠ Ámbar',
  red: '✗ Rojo',
  unknown: '? Sin datos',
}

export default function SLODashboardPage() {
  const [data, setData] = useState<SLOResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const resp = await adminFetch('/api/admin/slos', { headers, cache: 'no-store' })
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          setError('No autorizado — solo admins.')
        } else {
          setError(`HTTP ${resp.status}`)
        }
        return
      }
      const json = (await resp.json()) as SLOResponse
      setData(json)
      setLastFetch(new Date())
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30_000) // 30s auto-refresh
    return () => clearInterval(interval)
  }, [fetchData])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            SLO Dashboard — Cutover Readiness
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Bloque 5 Fase E.4.5 · 7 indicadores semáforo + decisión GO/NO-GO
            SLOs de producción · auto-refresh 30s
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200">Error: {error}</p>
          </div>
        )}

        {loading && !data && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">Cargando indicadores…</p>
          </div>
        )}

        {data && (
          <>
            {/* Veredicto */}
            <div
              className={`rounded-xl p-6 mb-6 border ${
                data.cutoverReady
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700'
                  : 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700'
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${
                    data.cutoverReady ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                >
                  {data.cutoverReady ? '✓' : '✗'}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {data.cutoverReady ? 'CUTOVER GO' : 'NO CUTOVER — investigar'}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Todos los SLOs en verde →{' '}
                    {data.cutoverReady
                      ? 'puedes hacer el switch DNS con confianza'
                      : 'al menos un indicador necesita atención antes del switch'}
                  </p>
                </div>
              </div>
            </div>

            {/* Indicadores */}
            <div className="grid gap-4 md:grid-cols-2">
              {data.indicators.map((ind, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {ind.label}
                    </h3>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[ind.status]}`}
                    >
                      <span
                        className={`inline-block w-2 h-2 rounded-full mr-1.5 ${STATUS_DOT[ind.status]}`}
                      />
                      {STATUS_LABEL[ind.status]}
                    </span>
                  </div>
                  <div className="text-2xl font-mono font-bold text-gray-900 dark:text-gray-100 mb-1">
                    {ind.value}
                  </div>
                  {ind.detail && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {ind.detail}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 italic">
                    SLO: {ind.slo}
                  </p>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-6 text-xs text-gray-500 dark:text-gray-500 text-center">
              Generado: {new Date(data.generatedAt).toLocaleString('es-ES')} ·
              Última actualización local: {lastFetch?.toLocaleTimeString('es-ES') ?? '—'}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
