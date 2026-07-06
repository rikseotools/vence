'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/lib/api/adminFetch'
import { getAuthHeaders } from '@/lib/api/authHeaders'

type Tab = 'oposiciones' | 'competidores' | 'cambios'

interface Overview {
  totals: { competitors: number; courses: number; urls: number; gaps: number; recent_changes: number }
  oposiciones: {
    oposicion_id: string; nombre: string; slug: string | null
    n_competidores: number; competidores: string[]; cuota_min: number | null; cuota_max: number | null
  }[]
  competitors: {
    id: string; slug: string; name: string; tipo: string | null; region: string | null
    tech: Record<string, unknown> | null; last_synced_at: string | null
    urls: number; courses: number; matched: number; gaps: number
  }[]
  changes: {
    id: string; change_type: string; url: string | null
    detail: Record<string, unknown> | null; detected_at: string; competitor: string
  }[]
}

interface PriceLine { kind: string; audience: string | null; amount_cents: number | null; period: string | null; plan: string | null; includes: string[] }
interface OpoDetail {
  oposicion: { id: string; nombre: string; slug: string | null } | null
  competitors: {
    competitor_id: string; competitor: string; tipo: string | null; region: string | null
    modalidad: string | null; course_url: string | null; raw_name: string; prices: PriceLine[]
  }[]
}

const eur = (c: number | null | undefined) =>
  c == null ? '—' : (c / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })

const CHANGE_STYLE: Record<string, string> = {
  url_added: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  course_added: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  price_changed: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  url_modified: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  url_removed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  course_removed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
      <div className={`text-2xl font-bold ${accent ?? 'text-gray-900 dark:text-white'}`}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  )
}

function TechBadges({ tech }: { tech: Record<string, unknown> | null }) {
  if (!tech) return null
  const keys = ['cms', 'sitemapGenerator', 'server', 'cdnWaf', 'rendering', 'lms']
  return (
    <span className="flex flex-wrap gap-1">
      {keys.map((k) => {
        const v = tech[k]
        if (!v) return null
        return (
          <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {String(v)}
          </span>
        )
      })}
    </span>
  )
}

export default function CompetidoresPage() {
  const [tab, setTab] = useState<Tab>('oposiciones')
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<OpoDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await adminFetch('/api/admin/competidores', { headers })
      const json = await res.json()
      if (json.success) setData(json)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openOposicion = useCallback(async (id: string) => {
    setDetailLoading(true)
    setSelected(null)
    try {
      const headers = await getAuthHeaders()
      const res = await adminFetch(`/api/admin/competidores/oposicion?id=${id}`, { headers })
      const json = await res.json()
      if (json.success) setSelected(json)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const filtered = (data?.oposiciones ?? []).filter((o) =>
    o.nombre.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">🏫 Competidores</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Qué oposiciones preparan, a qué precio, y qué han cambiado. La oposición es el nexo con el radar de señales.
      </p>

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <Stat label="Competidores" value={data.totals.competitors} />
          <Stat label="Cursos" value={data.totals.courses} />
          <Stat label="URLs vigiladas" value={data.totals.urls} />
          <Stat label="Gaps (sin catalogar)" value={data.totals.gaps} accent="text-purple-600 dark:text-purple-400" />
          <Stat label="Cambios (7d)" value={data.totals.recent_changes} accent="text-orange-600 dark:text-orange-400" />
        </div>
      )}

      <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
        {([['oposiciones', 'Por oposición'], ['competidores', 'Competidores'], ['cambios', 'Cambios']] as [Tab, string][]).map(
          ([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-3 py-2 text-sm font-medium -mb-px border-b-2 ${
                tab === id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {label}
              {id === 'cambios' && data && data.totals.recent_changes > 0 && (
                <span className="ml-1.5 bg-orange-500 text-white text-xs rounded-full px-1.5">{data.totals.recent_changes}</span>
              )}
            </button>
          ),
        )}
      </div>

      {loading && <p className="text-gray-500">Cargando…</p>}

      {/* POR OPOSICIÓN — el pivote */}
      {!loading && tab === 'oposiciones' && data && (
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar oposición (p.ej. auxiliar administrativo Huelva)…"
              className="w-full mb-3 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            />
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {filtered.length === 0 && (
                <p className="text-sm text-gray-500">
                  Ninguna oposición con competidores emparejados todavía (el matcher es conservador;
                  los cursos sin match cuentan como <b>gaps</b>).
                </p>
              )}
              {filtered.map((o) => (
                <button
                  key={o.oposicion_id}
                  onClick={() => openOposicion(o.oposicion_id)}
                  className={`w-full text-left px-3 py-2 rounded-md border text-sm ${
                    selected?.oposicion?.id === o.oposicion_id
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300'
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-white">{o.nombre}</div>
                  <div className="text-xs text-gray-500">
                    {o.n_competidores} competidor{o.n_competidores === 1 ? '' : 'es'} · cuota{' '}
                    {eur(o.cuota_min)}{o.cuota_min !== o.cuota_max ? `–${eur(o.cuota_max)}` : ''}/mes
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detalle: quién la prepara y COSTE de cada uno */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 min-h-[200px]">
            {detailLoading && <p className="text-gray-500">Cargando detalle…</p>}
            {!detailLoading && !selected && (
              <p className="text-sm text-gray-400">Elige una oposición para ver quién la prepara y a qué precio.</p>
            )}
            {!detailLoading && selected && (
              <>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{selected.oposicion?.nombre}</h3>
                {selected.competitors.length === 0 && <p className="text-sm text-gray-500">Sin competidores emparejados.</p>}
                <div className="space-y-3">
                  {selected.competitors.map((c) => (
                    <div key={c.competitor_id} className="border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0">
                      <div className="flex items-center justify-between">
                        <a href={c.course_url ?? '#'} target="_blank" rel="noreferrer" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                          {c.competitor}
                        </a>
                        <span className="text-xs text-gray-400">{c.modalidad ?? ''}{c.region ? ` · ${c.region}` : ''}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {c.prices.length === 0 && <span className="text-xs text-gray-400">sin precio detectado</span>}
                        {c.prices.map((p, i) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200" title={p.includes?.length ? `incluye: ${p.includes.join(', ')}` : undefined}>
                            {p.plan ? <b className="text-blue-600 dark:text-blue-400">{p.plan}</b> : p.kind}
                            {p.audience ? ` (${p.audience})` : ''}: <b>{eur(p.amount_cents)}</b>{p.period === 'mensual' ? '/mes' : ''}
                            {p.includes?.length ? <span className="text-gray-400"> · {p.includes.join('+')}</span> : null}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* COMPETIDORES */}
      {!loading && tab === 'competidores' && data && (
        <div className="space-y-3">
          {data.competitors.map((c) => (
            <div key={c.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-gray-900 dark:text-white">{c.name}</div>
                <span className="text-xs text-gray-400">
                  {c.tipo ?? ''}{c.region ? ` · ${c.region}` : ''}
                  {c.last_synced_at ? ` · sync ${new Date(c.last_synced_at).toLocaleDateString('es-ES')}` : ''}
                </span>
              </div>
              <div className="mt-1"><TechBadges tech={c.tech} /></div>
              <div className="text-xs text-gray-500 mt-2">
                {c.courses} cursos · {c.matched} emparejados ·{' '}
                <span className="text-purple-600 dark:text-purple-400">{c.gaps} gaps</span> · {c.urls} URLs
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CAMBIOS */}
      {!loading && tab === 'cambios' && data && (
        <div className="space-y-1.5">
          {data.changes.length === 0 && <p className="text-sm text-gray-500">Sin cambios registrados aún.</p>}
          {data.changes.map((ch) => (
            <div key={ch.id} className="flex items-center gap-2 text-sm bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 px-3 py-1.5">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CHANGE_STYLE[ch.change_type] ?? 'bg-gray-100 text-gray-700'}`}>
                {ch.change_type}
              </span>
              <span className="text-gray-500">{ch.competitor}</span>
              {ch.url && (
                <a href={ch.url} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline truncate flex-1">
                  {ch.url.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
              )}
              <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(ch.detected_at).toLocaleString('es-ES')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
