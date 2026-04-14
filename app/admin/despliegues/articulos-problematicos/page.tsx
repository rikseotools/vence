'use client'
// app/admin/despliegues/articulos-problematicos/page.tsx
// Panel de monitoreo del despliegue gradual (FASE 5 refactor oposicion-scope).
// Ver docs/maintenance/despliegue-articulos-problematicos.md

import { useCallback, useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase'

type BucketStats = {
  calls: number
  distinctUsers: number
  avgArticles: number
  zeroCount: number
  zeroPct: number
  avgDurationMs: number | null
}

type LogRow = {
  path: 'new' | 'old'
  articles_count: number
  duration_ms: number | null
  user_id: string | null
  position_type: string | null
  law_names: string[] | null
  created_at: string
}

type Response = {
  success: boolean
  hours: number
  summary: { new: BucketStats; old: BucketStats }
  rows: LogRow[]
  error?: string
}

const WINDOWS = [
  { label: 'Última hora', value: 1 },
  { label: 'Últimas 24h', value: 24 },
  { label: 'Últimos 7 días', value: 168 },
]

export default function DespliegueArticulosProblematicosPage() {
  const [data, setData] = useState<Response | null>(null)
  const [hours, setHours] = useState(24)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Sesión no encontrada')

      const resp = await fetch(
        `/api/v2/admin/problematic-articles-rollout?hours=${hours}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const body: Response = await resp.json()
      if (!resp.ok || !body.success) throw new Error(body.error || `HTTP ${resp.status}`)
      setData(body)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [hours])

  useEffect(() => { load() }, [load])

  const renderBucket = (label: string, stats: BucketStats, isNew: boolean) => (
    <div className={`rounded-lg border p-4 ${isNew ? 'border-green-300 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 bg-gray-50 dark:bg-gray-800'}`}>
      <div className="text-sm font-semibold mb-2">{label}</div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-gray-600 dark:text-gray-400">Llamadas</dt>
        <dd className="font-mono">{stats.calls}</dd>
        <dt className="text-gray-600 dark:text-gray-400">Usuarios únicos</dt>
        <dd className="font-mono">{stats.distinctUsers}</dd>
        <dt className="text-gray-600 dark:text-gray-400">Media artículos</dt>
        <dd className="font-mono">{stats.avgArticles}</dd>
        <dt className="text-gray-600 dark:text-gray-400">Con 0 artículos</dt>
        <dd className={`font-mono ${stats.zeroPct > 50 && isNew ? 'text-red-600 font-bold' : ''}`}>
          {stats.zeroCount} ({stats.zeroPct}%)
        </dd>
        <dt className="text-gray-600 dark:text-gray-400">Latencia media</dt>
        <dd className="font-mono">{stats.avgDurationMs !== null ? `${stats.avgDurationMs}ms` : '—'}</dd>
      </dl>
    </div>
  )

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Despliegue: artículos problemáticos</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Monitoreo del reemplazo de la RPC <code>get_user_problematic_articles_weekly</code>.
        Ver runbook en <code>docs/maintenance/despliegue-articulos-problematicos.md</code>.
      </p>

      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm text-gray-600 dark:text-gray-400">Ventana:</label>
        <select
          value={hours}
          onChange={(e) => setHours(parseInt(e.target.value, 10))}
          className="rounded border px-2 py-1 bg-white dark:bg-gray-800 text-sm"
        >
          {WINDOWS.map((w) => (
            <option key={w.value} value={w.value}>{w.label}</option>
          ))}
        </select>
        <button
          onClick={load}
          disabled={loading}
          className="rounded bg-blue-600 text-white px-3 py-1 text-sm disabled:opacity-50"
        >
          {loading ? 'Cargando…' : 'Refrescar'}
        </button>
      </div>

      {error && <div className="rounded bg-red-100 text-red-800 p-3 mb-4 text-sm">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {renderBucket('Path NUEVO (Drizzle + scope)', data.summary.new, true)}
            {renderBucket('Path VIEJO (RPC legacy)', data.summary.old, false)}
          </div>

          {data.summary.new.calls === 0 && (
            <div className="rounded bg-yellow-100 text-yellow-800 p-3 mb-4 text-sm">
              Aún no hay llamadas al path nuevo. Sube <code>NEXT_PUBLIC_PROBLEMATIC_ARTICLES_ROLLOUT_PCT</code> en Vercel.
            </div>
          )}
          {data.summary.new.zeroPct > 50 && data.summary.new.calls > 10 && (
            <div className="rounded bg-red-100 text-red-800 p-3 mb-4 text-sm font-semibold">
              ⚠️ {data.summary.new.zeroPct}% de llamadas al path nuevo devuelven 0 artículos.
              Posible regresión — considera rollback (PCT=0).
            </div>
          )}

          <h2 className="text-lg font-semibold mb-2">Últimas llamadas (max 100)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b bg-gray-50 dark:bg-gray-800">
                  <th className="text-left p-2">Fecha</th>
                  <th className="text-left p-2">Path</th>
                  <th className="text-left p-2">Usuario</th>
                  <th className="text-left p-2">Oposición</th>
                  <th className="text-right p-2">#</th>
                  <th className="text-left p-2">Leyes</th>
                  <th className="text-right p-2">ms</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="p-2 font-mono">{new Date(r.created_at).toLocaleString('es-ES')}</td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${r.path === 'new' ? 'bg-green-200 text-green-900' : 'bg-gray-200 text-gray-800'}`}>
                        {r.path}
                      </span>
                    </td>
                    <td className="p-2 font-mono">{r.user_id?.slice(0, 8) ?? '—'}</td>
                    <td className="p-2">{r.position_type ?? '—'}</td>
                    <td className={`p-2 text-right font-mono ${r.articles_count === 0 && r.path === 'new' ? 'text-red-600 font-bold' : ''}`}>
                      {r.articles_count}
                    </td>
                    <td className="p-2">{(r.law_names ?? []).join(', ') || '—'}</td>
                    <td className="p-2 text-right font-mono">{r.duration_ms ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
