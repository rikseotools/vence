'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminFetch } from '@/lib/api/adminFetch'
import { getAuthHeaders } from '@/lib/api/authHeaders'

interface ContenidoRow {
  slug: string
  nombre: string | null
  short_name: string | null
  disponibles: number
  en_desarrollo: number
  finos: number
  ok: number
  total_preguntas: number
}

interface Overview {
  success: boolean
  oposiciones: ContenidoRow[]
  summary: { total: number; conEnDesarrollo: number; conFinos: number; completas: number }
}

type Filter = 'todas' | 'en_desarrollo' | 'finos' | 'completas'

function estado(o: ContenidoRow): { label: string; cls: string } {
  if (o.en_desarrollo > 0)
    return { label: '🔴 En desarrollo', cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' }
  if (o.finos > 0)
    return { label: '🟡 Temas finos', cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' }
  return { label: '🟢 Completa', cls: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' }
}

function fmt(n: number): string {
  return new Intl.NumberFormat('es-ES').format(n)
}

export default function ContenidoPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('todas')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await adminFetch('/api/admin/contenido', { headers })
      setData(await res.json())
    } catch (err) {
      console.error('contenido load error', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(() => {
    const all = data?.oposiciones ?? []
    if (filter === 'en_desarrollo') return all.filter((o) => o.en_desarrollo > 0)
    if (filter === 'finos') return all.filter((o) => o.finos > 0 && o.en_desarrollo === 0)
    if (filter === 'completas') return all.filter((o) => o.en_desarrollo === 0 && o.finos === 0)
    return all
  }, [data, filter])

  const s = data?.summary

  const chips: { key: Filter; label: string; n: number | undefined }[] = [
    { key: 'todas', label: 'Todas', n: s?.total },
    { key: 'en_desarrollo', label: '🔴 En desarrollo', n: s?.conEnDesarrollo },
    { key: 'finos', label: '🟡 Temas finos', n: s?.conFinos },
    { key: 'completas', label: '🟢 Completas', n: s?.completas },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">📊 Contenido por oposición</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        De un vistazo, qué oposiciones están completas y cuáles necesitan trabajo. Un tema es{' '}
        <strong>fino</strong> si tiene menos de 20 preguntas; <strong>en desarrollo</strong> si tiene 0
        (sale "En desarrollo" al usuario).
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
              filter === c.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
            }`}
          >
            {c.label} {c.n != null && <span className="opacity-70">({c.n})</span>}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-500">Cargando…</p>}

      {!loading && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="text-left px-3 py-2">Oposición</th>
                <th className="text-center px-2 py-2">Estado</th>
                <th className="text-right px-2 py-2" title="temas disponibles">Temas</th>
                <th className="text-right px-2 py-2" title="temas con 0 preguntas">🔴</th>
                <th className="text-right px-2 py-2" title="temas con <20 preguntas">🟡</th>
                <th className="text-right px-2 py-2" title="temas con ≥20 preguntas">🟢</th>
                <th className="text-right px-3 py-2">Preguntas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((o) => {
                const e = estado(o)
                return (
                  <tr key={o.slug} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2">
                      <a
                        href={`/${o.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {o.short_name || o.nombre || o.slug}
                      </a>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${e.cls}`}>{e.label}</span>
                    </td>
                    <td className="px-2 py-2 text-right text-gray-500">{o.disponibles}</td>
                    <td className="px-2 py-2 text-right font-medium text-red-600 dark:text-red-400">
                      {o.en_desarrollo || '·'}
                    </td>
                    <td className="px-2 py-2 text-right font-medium text-amber-600 dark:text-amber-400">
                      {o.finos || '·'}
                    </td>
                    <td className="px-2 py-2 text-right text-green-600 dark:text-green-400">{o.ok || '·'}</td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">{fmt(o.total_preguntas)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {!loading && rows.length === 0 && (
        <p className="text-gray-500 mt-4">Sin oposiciones en este filtro.</p>
      )}
    </div>
  )
}
