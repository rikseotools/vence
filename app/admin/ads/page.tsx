'use client'

// app/admin/ads/page.tsx
// Panel resumido de Google Ads: campañas ordenadas por gasto, con coste, clics,
// CPC, ventas atribuidas, CPA, ingreso y ROI. Para decidir dónde meter dinero
// manteniendo puja por clic. Datos: Google Ads API (coste) + BD (ingreso real).

import { useCallback, useEffect, useState } from 'react'
import { getAuthHeaders } from '@/lib/api/authHeaders'

type Range = 'LAST_7_DAYS' | 'LAST_14_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'LAST_MONTH'

const RANGE_LABEL: Record<Range, string> = {
  LAST_7_DAYS: '7 días',
  LAST_14_DAYS: '14 días',
  LAST_30_DAYS: '30 días',
  THIS_MONTH: 'Este mes',
  LAST_MONTH: 'Mes pasado',
}

interface Campaign {
  campaignId: string
  name: string
  status: string
  costEur: number
  clicks: number
  impressions: number
  avgCpcEur: number
  revenueEur: number
  payments: number
  cpaEur: number | null
  roi: number | null
}

interface AdsResponse {
  range: Range
  totals: {
    costEur: number
    clicks: number
    impressions: number
    revenueEur: number
    payments: number
    roi: number | null
    cpaEur: number | null
  }
  campaigns: Campaign[]
}

const eur = (n: number) => `${n.toFixed(2)}€`

function roiBadge(c: Campaign) {
  if (c.costEur > 0 && c.payments === 0)
    return <span className="text-red-600 dark:text-red-400">🔴 0 ventas</span>
  if (c.roi != null && c.roi >= 1)
    return <span className="text-green-600 dark:text-green-400">🟢 {c.roi.toFixed(2)}×</span>
  if (c.roi != null)
    return <span className="text-amber-600 dark:text-amber-400">🟡 {c.roi.toFixed(2)}×</span>
  return <span className="text-gray-400">—</span>
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

export default function AdsPage() {
  const [range, setRange] = useState<Range>('LAST_7_DAYS')
  const [data, setData] = useState<AdsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/admin/ads?range=${range}`, { headers })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      setData(json)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    load()
  }, [load])

  const t = data?.totals

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">📣 Google Ads</h1>
        <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
          {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                range === r
                  ? 'bg-white dark:bg-gray-700 shadow font-semibold text-gray-900 dark:text-gray-100'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {t && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Kpi label="Gasto" value={eur(t.costEur)} />
          <Kpi label="Clics" value={t.clicks.toLocaleString('es-ES')} />
          <Kpi label="Ingreso atribuido" value={eur(t.revenueEur)} />
          <Kpi label="Ventas" value={String(t.payments)} hint={t.cpaEur != null ? `CPA ${eur(t.cpaEur)}` : undefined} />
          <Kpi label="ROI" value={t.roi != null ? `${t.roi.toFixed(2)}×` : '—'} />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Campaña</th>
              <th className="text-right px-3 py-2 font-medium">Gasto</th>
              <th className="text-right px-3 py-2 font-medium">Clics</th>
              <th className="text-right px-3 py-2 font-medium">CPC</th>
              <th className="text-right px-3 py-2 font-medium">Ventas</th>
              <th className="text-right px-3 py-2 font-medium">CPA</th>
              <th className="text-right px-3 py-2 font-medium">Ingreso</th>
              <th className="text-right px-3 py-2 font-medium">ROI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">Cargando…</td></tr>
            )}
            {!loading && data?.campaigns.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">Sin datos en {RANGE_LABEL[range]}.</td></tr>
            )}
            {!loading && data?.campaigns.map((c) => (
              <tr key={c.campaignId} className="text-gray-800 dark:text-gray-200">
                <td className="px-3 py-2">
                  {c.name}
                  {c.status !== 'ENABLED' && (
                    <span className="ml-2 text-xs text-gray-400">{c.status}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{eur(c.costEur)}</td>
                <td className="px-3 py-2 text-right">{c.clicks}</td>
                <td className="px-3 py-2 text-right">{eur(c.avgCpcEur)}</td>
                <td className="px-3 py-2 text-right">{c.payments}</td>
                <td className="px-3 py-2 text-right">{c.cpaEur != null ? eur(c.cpaEur) : '—'}</td>
                <td className="px-3 py-2 text-right">{eur(c.revenueEur)}</td>
                <td className="px-3 py-2 text-right">{roiBadge(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {t && t.revenueEur === 0 && (
        <p className="mt-4 text-xs text-gray-400">
          ℹ️ Ingreso 0: la atribución por campaña solo cuenta registros nuevos desde el
          despliegue del tracking. Irá llenándose con el tráfico de anuncios.
        </p>
      )}
    </div>
  )
}
