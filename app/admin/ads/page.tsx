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
  registrations: number
  costPerRegistrationEur: number | null
  revenueEur: number
  payments: number
  cpaEur: number | null
  roi: number | null
  examDate: string | null
  examApproximate: boolean | null
  daysToExam: number | null
  budgetEur: number
  budgetUtilizationPct: number | null
  budgetLostIS: number
  rankLostIS: number
  organicPosition: number | null
  organicClicks: number | null
}

interface AdsResponse {
  range: Range
  totals: {
    costEur: number
    clicks: number
    impressions: number
    registrations: number
    avgCostPerRegistration: number | null
    revenueEur: number
    payments: number
    roi: number | null
    cpaEur: number | null
  }
  campaigns: Campaign[]
}

const eur = (n: number) => `${n.toFixed(2)}€`

// Color del coste/registro RELATIVO a la media de la cuenta: verde = barato
// (escalar), rojo = caro (recortar). Se adapta solo a cada cuenta/periodo.
function cprClass(c: Campaign, avg: number | null): string {
  if (c.costEur > 0 && c.registrations === 0) return 'text-red-600 dark:text-red-400 font-semibold'
  if (c.costPerRegistrationEur == null || avg == null) return 'text-gray-400'
  const ratio = c.costPerRegistrationEur / avg
  if (ratio <= 0.8) return 'text-green-600 dark:text-green-400 font-semibold'
  if (ratio >= 1.5) return 'text-red-600 dark:text-red-400 font-semibold'
  return 'text-amber-600 dark:text-amber-400'
}

function roiBadge(c: Campaign) {
  if (c.costEur > 0 && c.payments === 0)
    return <span className="text-red-600 dark:text-red-400">🔴 0 ventas</span>
  if (c.roi != null && c.roi >= 1)
    return <span className="text-green-600 dark:text-green-400">🟢 {c.roi.toFixed(2)}×</span>
  if (c.roi != null)
    return <span className="text-amber-600 dark:text-amber-400">🟡 {c.roi.toFixed(2)}×</span>
  return <span className="text-gray-400">—</span>
}

type SortKey =
  | 'name' | 'daysToExam' | 'budgetEur' | 'budgetUtilizationPct' | 'costEur' | 'clicks'
  | 'avgCpcEur' | 'organicClicks' | 'registrations' | 'costPerRegistrationEur' | 'payments'
  | 'revenueEur' | 'roi'

function sortValue(c: Campaign, key: SortKey): number | string | null {
  switch (key) {
    case 'name': return c.name.toLowerCase()
    case 'daysToExam': return c.daysToExam
    case 'budgetEur': return c.budgetEur
    case 'budgetUtilizationPct': return c.budgetUtilizationPct
    case 'costEur': return c.costEur
    case 'clicks': return c.clicks
    case 'avgCpcEur': return c.avgCpcEur
    case 'organicClicks': return c.organicClicks
    case 'registrations': return c.registrations
    case 'costPerRegistrationEur': return c.costPerRegistrationEur
    case 'payments': return c.payments
    case 'revenueEur': return c.revenueEur
    case 'roi': return c.roi
  }
}

// Orgánico: posición media + clics gratis. Verde si rankea alto (pos ≤3),
// gris si no. Dato, no veredicto: alto orgánico + ads = ojo a canibalización.
function organicCell(c: Campaign): { text: string; cls: string } {
  if (c.organicClicks == null) return { text: '—', cls: 'text-gray-400' }
  const pos = c.organicPosition
  const cls =
    pos != null && pos <= 3 ? 'text-green-600 dark:text-green-400 font-semibold'
    : 'text-gray-600 dark:text-gray-300'
  return { text: `${pos != null ? 'pos ' + pos.toFixed(0) : '—'} · ${c.organicClicks}`, cls }
}

// Celda de examen: rojo si ya pasó, verde si inminente (ventana de venta),
// gris si lejano o sin fecha. Los datos dicen que se vende cerca del examen.
function examCell(c: Campaign): { text: string; cls: string } {
  if (c.daysToExam == null) return { text: '—', cls: 'text-gray-400' }
  const d = c.daysToExam
  if (d < 0) return { text: `pasó hace ${-d}d`, cls: 'text-red-600 dark:text-red-400 font-semibold' }
  if (d <= 45) return { text: `en ${d}d`, cls: 'text-green-600 dark:text-green-400 font-semibold' }
  return { text: `en ${d}d`, cls: 'text-gray-500 dark:text-gray-400' }
}

// Uso del presupuesto: % gastado del diario + por qué no gasta más.
// Verde = gasta casi todo · ámbar/gris = deja dinero sin usar.
function usoCell(c: Campaign): { text: string; cls: string; tag: string } {
  if (c.budgetUtilizationPct == null) return { text: '—', cls: 'text-gray-400', tag: '' }
  const u = c.budgetUtilizationPct
  const cls =
    u >= 80 ? 'text-green-600 dark:text-green-400 font-semibold'
    : u >= 40 ? 'text-amber-600 dark:text-amber-400'
    : 'text-gray-500 dark:text-gray-400'
  // Por qué no gasta más: presupuesto corto (subir) vs puja baja (CPC no gana)
  let tag = ''
  if (c.budgetLostIS >= 0.2) tag = '📉 subir presup'
  else if (c.rankLostIS >= 0.6) tag = '⬇ puja baja'
  return { text: `${u.toFixed(0)}%`, cls, tag }
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
  const [sortKey, setSortKey] = useState<SortKey>('costEur')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

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

  const sorted = [...(data?.campaigns ?? [])].sort((a, b) => {
    const av = sortValue(a, sortKey)
    const bv = sortValue(b, sortKey)
    if (av == null && bv == null) return 0
    if (av == null) return 1 // nulls siempre al final
    if (bv == null) return -1
    const cmp =
      typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const Th = ({ k, label, align = 'right' }: { k: SortKey; label: string; align?: 'left' | 'right' }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`px-3 py-2 font-medium cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 ${
        align === 'left' ? 'text-left' : 'text-right'
      }`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === k && <span className="text-blue-500">{sortDir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </th>
  )

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
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          <Kpi label="Gasto" value={eur(t.costEur)} />
          <Kpi label="Clics" value={t.clicks.toLocaleString('es-ES')} />
          <Kpi label="Registros" value={String(Math.round(t.registrations))} />
          <Kpi label="€/registro" value={t.avgCostPerRegistration != null ? eur(t.avgCostPerRegistration) : '—'} hint="media cuenta" />
          <Kpi label="Ingreso atribuido" value={eur(t.revenueEur)} />
          <Kpi label="ROI" value={t.roi != null ? `${t.roi.toFixed(2)}×` : '—'} />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500">
            <tr>
              <Th k="name" label="Campaña" align="left" />
              <Th k="daysToExam" label="Examen" />
              <Th k="costEur" label="Gasto" />
              <Th k="budgetEur" label="Presup" />
              <Th k="budgetUtilizationPct" label="Uso" />
              <Th k="clicks" label="Clics" />
              <Th k="avgCpcEur" label="CPC" />
              <Th k="organicClicks" label="Orgánico" />
              <Th k="registrations" label="Registros" />
              <Th k="costPerRegistrationEur" label="€/registro" />
              <Th k="payments" label="Ventas" />
              <Th k="revenueEur" label="Ingreso" />
              <Th k="roi" label="ROI" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading && (
              <tr><td colSpan={13} className="px-3 py-6 text-center text-gray-400">Cargando…</td></tr>
            )}
            {!loading && sorted.length === 0 && (
              <tr><td colSpan={13} className="px-3 py-6 text-center text-gray-400">Sin datos en {RANGE_LABEL[range]}.</td></tr>
            )}
            {!loading && sorted.map((c) => (
              <tr key={c.campaignId} className="text-gray-800 dark:text-gray-200">
                <td className="px-3 py-2">
                  {c.name}
                  {c.status !== 'ENABLED' && (
                    <span className="ml-2 text-xs text-gray-400">{c.status}</span>
                  )}
                </td>
                <td className={`px-3 py-2 text-right ${examCell(c).cls}`}>
                  {examCell(c).text}
                  {c.examDate && (
                    <span className="block text-xs font-normal text-gray-400">
                      {c.examApproximate ? '~' : ''}{c.examDate}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{eur(c.costEur)}</td>
                <td className="px-3 py-2 text-right">{c.budgetEur > 0 ? eur(c.budgetEur) : '—'}</td>
                <td className={`px-3 py-2 text-right ${usoCell(c).cls}`}>
                  {usoCell(c).text}
                  {usoCell(c).tag && (
                    <span className="block text-xs font-normal text-gray-400">{usoCell(c).tag}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{c.clicks}</td>
                <td className="px-3 py-2 text-right">{eur(c.avgCpcEur)}</td>
                <td className={`px-3 py-2 text-right ${organicCell(c).cls}`}>{organicCell(c).text}</td>
                <td className="px-3 py-2 text-right">{Math.round(c.registrations)}</td>
                <td className={`px-3 py-2 text-right ${cprClass(c, t?.avgCostPerRegistration ?? null)}`}>
                  {c.costPerRegistrationEur != null
                    ? eur(c.costPerRegistrationEur)
                    : c.costEur > 0 ? '0 reg' : '—'}
                </td>
                <td className="px-3 py-2 text-right">{c.payments}</td>
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
