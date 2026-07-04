// app/admin/radar-salud/page.tsx
// Observabilidad total del radar multi-capa: semáforo por adapter (boletín /
// agregador / competidor), señales encontradas, gaps abiertos y proveedores
// degradados. Auto-refresh 60s. Diseño: docs/roadmap/radar-multicapa.md §4.
'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/lib/api/adminFetch'
import { getAuthHeaders } from '@/lib/api/authHeaders'

type RadarStatus = 'green' | 'amber' | 'red'

interface AdapterHealth {
  adapterKey: string
  layer: string
  status: RadarStatus
  lastRunStatus: string
  lastRunAt: string
  durationMs: number | null
  signalsNew7d: number
  errorMessage: string | null
}
interface Gap {
  cuerpo: string | null
  boletinFaltante: string | null
  officialUrl: string | null
  at: string
}
interface RadarHealth {
  generatedAt: string
  overall: RadarStatus
  adapters: AdapterHealth[]
  gaps: Gap[]
  degraded: string[]
}

const DOT: Record<RadarStatus, string> = {
  green: 'bg-green-500',
  amber: 'bg-yellow-500',
  red: 'bg-red-500',
}
const LAYER_LABEL: Record<string, string> = {
  boletin: '📰 Capa 1 · Boletines oficiales',
  aggregator: '🏛️ Capa 2 · Agregador oficial',
  competitor: '🔎 Capa 3 · Competidores',
}
const OVERALL_LABEL: Record<RadarStatus, string> = { green: 'OK', amber: 'Atención', red: 'Problema' }

function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const h = Math.floor(ms / 3_600_000)
  if (h < 1) return `hace ${Math.max(1, Math.floor(ms / 60_000))} min`
  if (h < 48) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

export default function RadarSaludPage() {
  const [data, setData] = useState<RadarHealth | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchHealth = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const res = await adminFetch('/api/admin/radar-salud', { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    const t = setInterval(fetchHealth, 60_000)
    return () => clearInterval(t)
  }, [fetchHealth])

  const layers = ['boletin', 'aggregator', 'competitor']

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">📡 Salud del Radar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Observabilidad del radar multi-capa de convocatorias
          </p>
        </div>
        {data && (
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
            data.overall === 'green' ? 'bg-green-100 text-green-800' : data.overall === 'amber' ? 'bg-yellow-100 text-yellow-900' : 'bg-red-100 text-red-800'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${DOT[data.overall]}`} />
            {OVERALL_LABEL[data.overall]}
          </span>
        )}
      </div>

      {loading && <p className="text-gray-500">Cargando…</p>}
      {error && <p className="text-red-600">Error: {error}</p>}

      {data && data.adapters.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-gray-500">
          El radar aún no ha registrado ninguna ejecución. El cron corre a diario (07:00 UTC).
        </div>
      )}

      {data && layers.map((layer) => {
        const items = data.adapters.filter((a) => a.layer === layer)
        if (items.length === 0) return null
        return (
          <section key={layer} className="mb-6">
            <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">{LAYER_LABEL[layer] ?? layer}</h2>
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500">
                  <tr>
                    <th className="text-left px-3 py-2">Adapter</th>
                    <th className="text-left px-3 py-2">Último run</th>
                    <th className="text-right px-3 py-2">ms</th>
                    <th className="text-right px-3 py-2">Señales 7d</th>
                    <th className="text-left px-3 py-2">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {items.map((a) => (
                    <tr key={a.adapterKey}>
                      <td className="px-3 py-2 font-medium flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${DOT[a.status]}`} />
                        {a.adapterKey}
                      </td>
                      <td className="px-3 py-2 text-gray-500">{a.lastRunStatus} · {fmtAgo(a.lastRunAt)}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{a.durationMs ?? '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold">{a.signalsNew7d}</td>
                      <td className="px-3 py-2 text-red-600 truncate max-w-xs">{a.errorMessage ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}

      {data && data.gaps.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-2">
            ⚠️ Gaps abiertos ({data.gaps.length}) — convocatorias que solo vio un competidor
          </h2>
          <ul className="space-y-1 text-sm">
            {data.gaps.map((g, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-gray-400">{fmtAgo(g.at)}</span>
                <span className="font-medium">{g.cuerpo ?? '?'}</span>
                <span className="text-gray-500">falta {g.boletinFaltante ?? 'boletín ?'}</span>
                {g.officialUrl && (
                  <a href={g.officialUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">boletín</a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && (
        <p className="text-xs text-gray-400 mt-4">
          Actualizado {new Date(data.generatedAt).toLocaleTimeString('es-ES')} · auto-refresh 60s
        </p>
      )}
    </div>
  )
}
