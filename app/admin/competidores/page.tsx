'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/lib/api/adminFetch'
import { getAuthHeaders } from '@/lib/api/authHeaders'

type Tab = 'oposiciones' | 'competidores' | 'cambios' | 'revision'

interface ReviewItem {
  course_id: string; competitor: string; raw_name: string; course_url: string | null
  ambito: string | null; region_slug: string | null; confidence: number | null
  candidate_id: string | null; candidate_nombre: string | null; candidate_slug: string | null
}

interface SearchResult {
  oposiciones: { oposicion_id: string; nombre: string; slug: string | null; coverage_level: string | null; n_competidores: number }[]
  gaps: { course_id: string; competitor: string; raw_name: string; course_url: string | null; ambito: string | null }[]
}

interface Overview {
  totals: { competitors: number; courses: number; urls: number; gaps: number; needs_review: number; recent_changes: number }
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
  const [review, setReview] = useState<ReviewItem[] | null>(null)
  const [busyCourse, setBusyCourse] = useState<string | null>(null)
  const [searchRes, setSearchRes] = useState<SearchResult | null>(null)

  const loadReview = useCallback(async () => {
    const headers = await getAuthHeaders()
    const res = await adminFetch('/api/admin/competidores/review', { headers })
    const json = await res.json()
    if (json.success) setReview(json.items)
  }, [])

  const resolveReview = useCallback(
    async (courseId: string, oposicionId: string | null) => {
      setBusyCourse(courseId)
      try {
        const headers = await getAuthHeaders()
        await adminFetch('/api/admin/competidores/review', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId, oposicionId }),
        })
        setReview((r) => (r ? r.filter((x) => x.course_id !== courseId) : r))
      } finally {
        setBusyCourse(null)
      }
    },
    [],
  )

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
  useEffect(() => { if (tab === 'revision' && review === null) loadReview() }, [tab, review, loadReview])

  // Búsqueda global (todas las catalogadas + gaps) cuando hay término. Debounce 250ms.
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setSearchRes(null); return }
    let cancelled = false
    const t = setTimeout(async () => {
      const headers = await getAuthHeaders()
      const res = await adminFetch(`/api/admin/competidores/search?q=${encodeURIComponent(term)}`, { headers })
      const json = await res.json()
      if (!cancelled && json.success) setSearchRes({ oposiciones: json.oposiciones, gaps: json.gaps })
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [q])

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

  // Búsqueda insensible a acentos y mayúsculas ("informatica" encuentra "Informática").
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  const filtered = (data?.oposiciones ?? []).filter((o) => norm(o.nombre).includes(norm(q)))

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">🏫 Competidores</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Qué oposiciones preparan, a qué precio, y qué han cambiado. La oposición es el nexo con el radar de señales.
      </p>

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6">
          <Stat label="Competidores" value={data.totals.competitors} />
          <Stat label="Cursos" value={data.totals.courses} />
          <Stat label="URLs vigiladas" value={data.totals.urls} />
          <Stat label="Gaps (sin catalogar)" value={data.totals.gaps} accent="text-purple-600 dark:text-purple-400" />
          <Stat label="A revisar" value={data.totals.needs_review} accent="text-amber-600 dark:text-amber-400" />
          <Stat label="Cambios (7d)" value={data.totals.recent_changes} accent="text-orange-600 dark:text-orange-400" />
        </div>
      )}

      <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
        {([['oposiciones', 'Por oposición'], ['competidores', 'Competidores'], ['revision', 'Revisión'], ['cambios', 'Cambios']] as [Tab, string][]).map(
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
              {id === 'revision' && data && data.totals.needs_review > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5">{data.totals.needs_review}</span>
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
              placeholder="Buscar cualquier oposición o curso de competidor (p.ej. informatica, subalterno)…"
              className="w-full mb-3 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            />
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {/* Con término → búsqueda GLOBAL (todas las catalogadas + gaps). Sin término → lista de las que tienen competidor. */}
              {searchRes ? (
                <>
                  {searchRes.oposiciones.length === 0 && searchRes.gaps.length === 0 && (
                    <p className="text-sm text-gray-500">Nada encontrado para “{q}”.</p>
                  )}
                  {searchRes.oposiciones.map((o) => (
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
                        {o.n_competidores > 0
                          ? `${o.n_competidores} competidor${o.n_competidores === 1 ? '' : 'es'}`
                          : 'sin competidor'}
                        {o.coverage_level ? ` · ${o.coverage_level}` : ''}
                      </div>
                    </button>
                  ))}
                  {searchRes.gaps.length > 0 && (
                    <div className="pt-2">
                      <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-1">
                        Sin catalogar ({searchRes.gaps.length}) — lo preparan y no lo tenemos
                      </div>
                      {searchRes.gaps.map((g) => (
                        <div key={g.course_id} className="px-3 py-1.5 rounded-md border border-dashed border-purple-200 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-900/10 text-sm mb-1">
                          <a href={g.course_url ?? '#'} target="_blank" rel="noreferrer" className="text-purple-700 dark:text-purple-300 hover:underline">{g.raw_name}</a>
                          <span className="text-xs text-gray-500"> · {g.competitor}{g.ambito && g.ambito !== 'desconocido' ? ` · ${g.ambito}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {filtered.length === 0 && (
                    <p className="text-sm text-gray-500">
                      Escribe ≥2 letras para buscar <b>cualquier</b> oposición (catalogada o no) y también
                      los cursos de competidores <b>sin catalogar</b>.
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
                </>
              )}
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
                  {selected.competitors.map((c, ci) => (
                    <div key={c.course_url ?? `${c.competitor_id}-${ci}`} className="border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0">
                      <div className="flex items-center justify-between">
                        <a href={c.course_url ?? '#'} target="_blank" rel="noreferrer" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                          {c.competitor}
                        </a>
                        <span className="text-xs text-gray-400">{c.modalidad ?? ''}{c.region ? ` · ${c.region}` : ''}</span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={c.raw_name}>{c.raw_name}</div>
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

      {/* REVISIÓN — matches dudosos: el humano confirma con 1 clic (queda sticky) */}
      {!loading && tab === 'revision' && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            El matcher tiene una apuesta pero sin confianza suficiente para enlazar solo (ambigüedad o
            falta de ámbito/región). Confirma o descarta — tu decisión es <b>definitiva</b> y el re-match
            automático nunca la pisa.
          </p>
          {review === null && <p className="text-gray-500">Cargando…</p>}
          {review && review.length === 0 && (
            <p className="text-sm text-gray-500">Nada pendiente de revisión. 🎉</p>
          )}
          {review?.map((r) => (
            <div key={r.course_id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    <span className="text-gray-500">{r.competitor}:</span>{' '}
                    <a href={r.course_url ?? '#'} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                      {r.raw_name}
                    </a>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    ámbito: {r.ambito ?? '—'}{r.region_slug ? ` · ${r.region_slug}` : ''} · confianza {r.confidence != null ? Math.round(r.confidence * 100) + '%' : '—'}
                  </div>
                  <div className="text-sm mt-1">
                    ¿Es <b className="text-gray-900 dark:text-white">{r.candidate_nombre ?? '(sin candidato)'}</b>?
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {r.candidate_id && (
                    <button
                      disabled={busyCourse === r.course_id}
                      onClick={() => resolveReview(r.course_id, r.candidate_id)}
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      ✓ Sí, es esta
                    </button>
                  )}
                  <button
                    disabled={busyCourse === r.course_id}
                    onClick={() => resolveReview(r.course_id, null)}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    ✗ No / gap
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
