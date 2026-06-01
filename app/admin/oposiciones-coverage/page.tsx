'use client'

/**
 * Sprint E del roadmap docs/roadmap/oposiciones-coverage-level-y-promocion-automatica.md.
 *
 * Dashboard /admin/oposiciones-coverage para visualizar:
 *  - Distribución actual del catálogo por coverage_level.
 *  - Distribución por administración × nivel.
 *  - Últimos saltos automáticos (cron auto-promote-coverage Sprint D).
 *  - Catalogadas sin seguimiento_url (deuda Sprint C.6).
 *
 * Una mirada al dashboard responde "¿el sistema vivo está progresando?".
 */

import { useEffect, useState } from 'react'

interface CoverageStats {
  byLevel: Array<{ level: string; total: number; active: number; inactive: number }>
  byAdminLevel: Array<{ administracion: string; level: string; total: number }>
  recentJumps: Array<{
    slug: string
    nombre: string
    from_level: string
    to_level: string
    reason: string
    changed_by: string
    changed_at: string
  }>
  sinSeguimientoUrl: Array<{ slug: string; nombre: string; administracion: string; coverage_level: string }>
  totals: { total: number; con_url: number; sin_url: number }
}

const LEVEL_LABEL: Record<string, string> = {
  catalogada: '📋 Catalogada',
  monitorizada: '🔍 Monitorizada',
  con_temario: '📚 Con temario',
  con_tests: '🎯 Con tests',
  con_landing: '✨ Con landing',
  full: '⭐ Full',
}

const LEVEL_COLOR: Record<string, string> = {
  catalogada: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  monitorizada: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  con_temario: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  con_tests: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  con_landing: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  full: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const m = Math.floor(diffMs / 60000)
  if (m < 1) return 'hace segundos'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  const days = Math.floor(h / 24)
  if (days < 30) return `hace ${days}d`
  return d.toLocaleDateString('es-ES')
}

export default function OposicionesCoveragePage() {
  const [data, setData] = useState<CoverageStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/oposiciones-coverage')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch(e => setError(String(e)))
  }, [])

  if (error) return <div className="p-8 text-red-600">Error: {error}</div>
  if (!data) return <div className="p-8">Cargando…</div>

  // Agrupar byAdminLevel para tabla cruzada
  const adminGrouped: Record<string, Record<string, number>> = {}
  for (const row of data.byAdminLevel) {
    if (!adminGrouped[row.administracion]) adminGrouped[row.administracion] = {}
    adminGrouped[row.administracion][row.level] = row.total
  }
  const adminRows = Object.entries(adminGrouped).sort()
  const ORDER = ['catalogada', 'monitorizada', 'con_temario', 'con_tests', 'con_landing', 'full']

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Oposiciones — coverage_level</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Estado del catálogo y saltos automáticos del cron <code>auto-promote-coverage</code>.
          Roadmap: <code>docs/roadmap/oposiciones-coverage-level-y-promocion-automatica.md</code>
        </p>
      </header>

      {/* Totales globales */}
      <section className="grid grid-cols-3 gap-4">
        <Stat label="Total oposiciones" value={data.totals.total} />
        <Stat label="Con seguimiento_url" value={data.totals.con_url} accent="green" />
        <Stat label="Sin seguimiento_url" value={data.totals.sin_url} accent="orange" />
      </section>

      {/* Distribución por nivel */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Distribución por coverage_level</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {data.byLevel.map(b => (
            <div key={b.level} className={`p-3 rounded ${LEVEL_COLOR[b.level] ?? ''}`}>
              <div className="text-xs font-medium">{LEVEL_LABEL[b.level] ?? b.level}</div>
              <div className="text-2xl font-bold mt-1">{b.total}</div>
              <div className="text-xs mt-1 opacity-75">
                {b.active} activas · {b.inactive} catalog.
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Saltos recientes */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Últimos saltos automáticos</h2>
        {data.recentJumps.length === 0 ? (
          <p className="text-sm text-gray-500">Aún sin saltos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b dark:border-gray-700">
                  <th className="py-2 pr-4">Cuándo</th>
                  <th className="py-2 pr-4">Slug</th>
                  <th className="py-2 pr-4">Salto</th>
                  <th className="py-2 pr-4">Razón</th>
                  <th className="py-2 pr-4">Por</th>
                </tr>
              </thead>
              <tbody>
                {data.recentJumps.map((j, i) => (
                  <tr key={i} className="border-b dark:border-gray-800">
                    <td className="py-2 pr-4 text-gray-500">{formatRelative(j.changed_at)}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{j.slug}</td>
                    <td className="py-2 pr-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${LEVEL_COLOR[j.from_level] ?? ''}`}>{j.from_level}</span>
                      {' → '}
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${LEVEL_COLOR[j.to_level] ?? ''}`}>{j.to_level}</span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{j.reason}</td>
                    <td className="py-2 pr-4 text-gray-500">{j.changed_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Cruz por administración */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Distribución administración × nivel</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b dark:border-gray-700">
                <th className="py-2 pr-4">Administración</th>
                {ORDER.map(lvl => (
                  <th key={lvl} className="py-2 px-2 text-center text-xs">
                    {LEVEL_LABEL[lvl] ?? lvl}
                  </th>
                ))}
                <th className="py-2 px-2 text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {adminRows.map(([adm, levels]) => {
                const total = ORDER.reduce((sum, lvl) => sum + (levels[lvl] ?? 0), 0)
                return (
                  <tr key={adm} className="border-b dark:border-gray-800">
                    <td className="py-2 pr-4 font-medium">{adm}</td>
                    {ORDER.map(lvl => (
                      <td key={lvl} className="py-2 px-2 text-center">
                        {levels[lvl] ?? <span className="text-gray-300">·</span>}
                      </td>
                    ))}
                    <td className="py-2 px-2 text-center font-semibold">{total}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Catalogadas sin seguimiento_url */}
      <section>
        <h2 className="text-lg font-semibold mb-3">
          Catalogadas sin <code>seguimiento_url</code> ({data.sinSeguimientoUrl.length})
        </h2>
        {data.sinSeguimientoUrl.length === 0 ? (
          <p className="text-sm text-green-600">✅ Todas las catalogadas tienen URL.</p>
        ) : (
          <p className="text-xs text-gray-600 mb-3">
            Deuda Sprint C.6 — la mayoría son meta-categorías genéricas (bombero, policía-local, etc.) sin organismo concreto.
          </p>
        )}
        <ul className="text-sm space-y-1">
          {data.sinSeguimientoUrl.map(s => (
            <li key={s.slug} className="font-mono text-xs">
              <span className="text-gray-500">[{s.administracion}]</span> {s.slug}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: 'green' | 'orange' }) {
  const color =
    accent === 'green'
      ? 'text-green-600 dark:text-green-400'
      : accent === 'orange'
      ? 'text-orange-600 dark:text-orange-400'
      : 'text-gray-900 dark:text-gray-100'
  return (
    <div className="border rounded p-4 dark:border-gray-700">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  )
}
