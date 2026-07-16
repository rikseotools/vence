'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminFetch } from '@/lib/api/adminFetch'
import { getAuthHeaders } from '@/lib/api/authHeaders'
import { epigrafeBadge, EPIGRAFE_TONE_CLS } from '@/lib/api/admin-contenido/epigrafeBadge'
import { coverageBadge, COVERAGE_TONE_CLS } from '@/lib/api/admin-contenido/coverageBadge'

type Vendibilidad = 'vendible' | 'no_vendible' | 'sin_verificar'

interface ContenidoRow {
  slug: string
  nombre: string | null
  short_name: string | null
  disponibles: number
  en_desarrollo: number
  finos: number
  ok: number
  total_preguntas: number
  usuarios: number
  premium: number
  vendibilidad: Vendibilidad
  plazas_libres: number | null
  exam_date: string | null
  epi_topics: number
  epi_literal: number
  epi_drift: number
  epi_provisional: number
  epi_stale: number
  epi_never: number
  arts_sin_preguntas: number
  temas_sin_cobertura: number
  proceso_state: string | null
}

interface EpigrafeDetailRow {
  topic_number: number
  title: string | null
  epigrafe: string | null
  effective_state: string
  note: string | null
  verified_at: string | null
  source_url: string | null
  source_notes: string | null
}

interface CoverageDetailRow {
  topic_number: number
  title: string | null
  ley: string
  article_number: string
  preview: string | null
}

interface Overview {
  success: boolean
  oposiciones: ContenidoRow[]
  summary: { total: number; conEnDesarrollo: number; conFinos: number; completas: number }
}

type Filter = 'todas' | 'en_desarrollo' | 'finos' | 'completas'
type SortKey =
  | 'nombre'
  | 'disponibles'
  | 'en_desarrollo'
  | 'finos'
  | 'ok'
  | 'total_preguntas'
  | 'usuarios'
  | 'premium_pct'

function estado(o: ContenidoRow): { label: string; cls: string } {
  if (o.en_desarrollo > 0)
    return { label: '🔴 En desarrollo', cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' }
  if (o.finos > 0)
    return { label: '🟡 Temas finos', cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' }
  return { label: '🟢 Completa', cls: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' }
}

// Eje ORTOGONAL al de contenido: ¿hay oportunidad viva con ingreso libre?
// Derivado en la API desde oposiciones_ssot (plazas_libres + examen). Ver
// project_modelo_oportunidad_vendibilidad.
function vendible(o: ContenidoRow): { label: string; cls: string; title: string } {
  switch (o.vendibilidad) {
    case 'vendible':
      return {
        label: `🟢 Vendible${o.plazas_libres ? ` (${o.plazas_libres})` : ''}`,
        cls: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
        title: `Oportunidad viva con ${o.plazas_libres} plazas libres${o.exam_date ? ` · examen ${o.exam_date.slice(0, 10)}` : ' · sin convocatoria formal aún'}`,
      }
    case 'no_vendible':
      return {
        label: '⛔ No vendible',
        cls: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
        title: o.exam_date ? `Examen pasado (${o.exam_date.slice(0, 10)}) sin OEP nueva` : 'Sin plazas de ingreso libre',
      }
    default:
      return {
        label: '⚪ Sin verificar',
        cls: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-700',
        title: 'plazas_libres desconocido — nunca verificado contra fuente oficial',
      }
  }
}

// Estado efectivo por tema (drill-down de epígrafe).
const EPI_STATE_UI: Record<string, { label: string; cls: string }> = {
  verified_literal: { label: '✓ literal', cls: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
  drift_detected: { label: '⚠ drift', cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' },
  stale: { label: '⚠ stale', cls: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' },
  provisional_anterior: { label: '✎ editorial/prov.', cls: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  never_sourced: { label: '— sin verificar', cls: 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400' },
  default: { label: '?', cls: 'bg-gray-100 dark:bg-gray-700 text-gray-500' },
}

const fmt = (n: number) => new Intl.NumberFormat('es-ES').format(n)
const pct = (o: ContenidoRow) => (o.usuarios > 0 ? o.premium / o.usuarios : 0)

function sortVal(o: ContenidoRow, k: SortKey): number | string {
  if (k === 'nombre') return (o.short_name || o.nombre || o.slug).toLowerCase()
  if (k === 'premium_pct') return pct(o)
  return o[k]
}

// Estado del PROCESO (convocatoria vigente verificada de principio a fin contra el
// documento oficial). Fuente: convocatoria_verification_effective.
function procesoBadge(state: string | null): { label: string; cls: string; title: string } {
  switch (state) {
    case 'verified_correct':
      return { label: '✅ Verificado', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', title: 'Proceso verificado de principio a fin contra el documento oficial (fecha, plazas, calendario)' }
    case 'verified_issues':
    case 'needs_human':
      return { label: '⚠️ Revisar', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', title: 'Verificado con incidencias / pendiente de revisión humana' }
    case 'never_verified':
    case 'stale':
      return { label: '⏳ Pendiente', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', title: 'Convocatoria sin verificar (o cambió tras verificar) contra el documento oficial' }
    default:
      return { label: '—', cls: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500', title: 'Sin convocatoria vigente que verificar' }
  }
}

export default function ContenidoPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('todas')
  const [sortKey, setSortKey] = useState<SortKey>('usuarios')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  // Drill-down de epígrafe (S2): modal con el detalle tema a tema.
  const [epiSlug, setEpiSlug] = useState<string | null>(null)
  const [epiNombre, setEpiNombre] = useState<string>('')
  const [epiDetail, setEpiDetail] = useState<EpigrafeDetailRow[] | null>(null)
  const [epiLoading, setEpiLoading] = useState(false)

  const openEpi = useCallback(async (slug: string, nombre: string) => {
    setEpiSlug(slug)
    setEpiNombre(nombre)
    setEpiDetail(null)
    setEpiLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await adminFetch(`/api/admin/contenido/epigrafe/${slug}`, { headers })
      const json = await res.json()
      setEpiDetail(json.success ? json.temas : [])
    } catch (err) {
      console.error('epigrafe detail error', err)
      setEpiDetail([])
    } finally {
      setEpiLoading(false)
    }
  }, [])

  // Drill-down de cobertura de artículos: modal con los artículos en scope sin preguntas.
  const [covSlug, setCovSlug] = useState<string | null>(null)
  const [covNombre, setCovNombre] = useState<string>('')
  const [covDetail, setCovDetail] = useState<CoverageDetailRow[] | null>(null)
  const [covLoading, setCovLoading] = useState(false)

  const openCov = useCallback(async (slug: string, nombre: string) => {
    setCovSlug(slug)
    setCovNombre(nombre)
    setCovDetail(null)
    setCovLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await adminFetch(`/api/admin/contenido/cobertura/${slug}`, { headers })
      const json = await res.json()
      setCovDetail(json.success ? json.articulos : [])
    } catch (err) {
      console.error('coverage detail error', err)
      setCovDetail([])
    } finally {
      setCovLoading(false)
    }
  }, [])

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

  const clickSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else {
      setSortKey(k)
      setSortDir(k === 'nombre' ? 'asc' : 'desc')
    }
  }

  const rows = useMemo(() => {
    let all = data?.oposiciones ?? []
    if (filter === 'en_desarrollo') all = all.filter((o) => o.en_desarrollo > 0)
    else if (filter === 'finos') all = all.filter((o) => o.finos > 0 && o.en_desarrollo === 0)
    else if (filter === 'completas') all = all.filter((o) => o.en_desarrollo === 0 && o.finos === 0)
    const sorted = [...all].sort((a, b) => {
      const va = sortVal(a, sortKey)
      const vb = sortVal(b, sortKey)
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
      return sortDir === 'desc' ? -cmp : cmp
    })
    return sorted
  }, [data, filter, sortKey, sortDir])

  const s = data?.summary
  const chips: { key: Filter; label: string; n: number | undefined }[] = [
    { key: 'todas', label: 'Todas', n: s?.total },
    { key: 'en_desarrollo', label: '🔴 En desarrollo', n: s?.conEnDesarrollo },
    { key: 'finos', label: '🟡 Temas finos', n: s?.conFinos },
    { key: 'completas', label: '🟢 Completas', n: s?.completas },
  ]

  const arrow = (k: SortKey) => (sortKey === k ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '')
  const Th = ({ k, label, cls = '', title }: { k: SortKey; label: string; cls?: string; title?: string }) => (
    <th
      className={`px-2 py-2 cursor-pointer select-none hover:text-gray-900 dark:hover:text-white ${cls} ${
        sortKey === k ? 'text-gray-900 dark:text-white' : ''
      }`}
      onClick={() => clickSort(k)}
      title={title}
    >
      {label}
      {arrow(k)}
    </th>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">📊 Contenido por oposición</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Prioriza de un vistazo: cruza <strong>usuarios</strong> y <strong>% premium</strong> con el estado del
        contenido. Un tema es <strong>fino</strong> con menos de 20 preguntas; <strong>en desarrollo</strong> con 0.
        Pincha una columna para ordenar.
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
                <Th k="nombre" label="Oposición" cls="text-left" />
                <th className="text-center px-2 py-2" title="¿contenido/tests listos?">Contenido</th>
                <th className="text-center px-2 py-2" title="¿hay oportunidad viva con ingreso libre? (derivado)">Vendible</th>
                <th className="text-center px-2 py-2" title="¿el proceso (convocatoria vigente: fecha de examen, plazas, calendario) está verificado de principio a fin contra el documento oficial, o pendiente?">Proceso</th>
                <Th k="usuarios" label="Usuarios" cls="text-right" title="usuarios con esta oposición" />
                <Th k="premium_pct" label="% Prem." cls="text-right" title="% de usuarios premium" />
                <Th k="disponibles" label="Temas" cls="text-right" title="temas disponibles" />
                <Th k="en_desarrollo" label="🔴" cls="text-right" title="temas con 0 preguntas" />
                <Th k="finos" label="🟡" cls="text-right" title="temas con <20 preguntas" />
                <Th k="ok" label="🟢" cls="text-right" title="temas con ≥20 preguntas" />
                <Th k="total_preguntas" label="Preguntas" cls="text-right" />
                <th
                  className="text-center px-2 py-2"
                  title="Literalidad del epígrafe de BD vs el temario oficial de la convocatoria (Sistema 2). Pincha para el detalle tema a tema."
                >
                  Epígrafe
                </th>
                <th
                  className="text-center px-2 py-2"
                  title="Artículos que están en el temario (topic_scope) con contenido pero SIN ninguna pregunta → al usuario nunca le salen en los tests. Pincha para ver cuáles."
                >
                  Arts. s/preg.
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((o) => {
                const e = estado(o)
                const v = vendible(o)
                const p = pct(o)
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
                    <td className="px-2 py-2 text-center">
                      <span title={v.title} className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${v.cls}`}>{v.label}</span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      {(() => {
                        const pb = procesoBadge(o.proceso_state)
                        return <span title={pb.title} className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${pb.cls}`}>{pb.label}</span>
                      })()}
                    </td>
                    <td className="px-2 py-2 text-right font-medium text-gray-900 dark:text-white">{fmt(o.usuarios)}</td>
                    <td
                      className={`px-2 py-2 text-right ${
                        p >= 0.05 ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-500'
                      }`}
                    >
                      {(p * 100).toFixed(1)}%
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
                    <td className="px-2 py-2 text-center">
                      {(() => {
                        const b = epigrafeBadge(o)
                        return (
                          <button
                            type="button"
                            onClick={() => openEpi(o.slug, o.short_name || o.nombre || o.slug)}
                            title={`${b.title} — pincha para el detalle`}
                            className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap hover:ring-2 hover:ring-blue-400 ${EPIGRAFE_TONE_CLS[b.tone]}`}
                          >
                            {b.label}
                          </button>
                        )
                      })()}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {(() => {
                        const b = coverageBadge(o)
                        return (
                          <button
                            type="button"
                            disabled={o.arts_sin_preguntas === 0}
                            onClick={() => openCov(o.slug, o.short_name || o.nombre || o.slug)}
                            title={`${b.title}${o.arts_sin_preguntas ? ' — pincha para ver cuáles' : ''}`}
                            className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${o.arts_sin_preguntas ? 'hover:ring-2 hover:ring-blue-400' : 'cursor-default'} ${COVERAGE_TONE_CLS[b.tone]}`}
                          >
                            {b.label}
                          </button>
                        )
                      })()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {!loading && rows.length === 0 && <p className="text-gray-500 mt-4">Sin oposiciones en este filtro.</p>}

      {epiSlug && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setEpiSlug(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-lg max-w-3xl w-full max-h-[85vh] overflow-y-auto p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">📑 Epígrafe · {epiNombre}</h2>
              <button
                onClick={() => setEpiSlug(null)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl leading-none"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Literalidad del epígrafe de BD vs el temario oficial de la convocatoria (Sistema 2).
              <span className="text-green-600 dark:text-green-400"> ✓ literal</span> ·
              <span className="text-amber-600 dark:text-amber-400"> ⚠ drift/stale</span> ·
              <span className="text-blue-600 dark:text-blue-400"> ✎ editorial</span> ·
              <span className="text-gray-500"> — sin verificar</span>.
            </p>
            {epiLoading && <p className="text-gray-500">Cargando…</p>}
            {!epiLoading && epiDetail && (
              <ul className="space-y-2">
                {epiDetail.map((t) => {
                  const st = EPI_STATE_UI[t.effective_state] ?? EPI_STATE_UI.default
                  return (
                    <li
                      key={t.topic_number}
                      className="border border-gray-100 dark:border-gray-800 rounded p-2"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-sm font-semibold text-gray-400 w-8 shrink-0">T{t.topic_number}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900 dark:text-white text-sm">{t.title}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}>
                              {st.label}
                            </span>
                            {t.verified_at && (
                              <span className="text-xs text-gray-400">{t.verified_at.slice(0, 10)}</span>
                            )}
                          </div>
                          {t.epigrafe && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{t.epigrafe}</p>
                          )}
                          {t.note && (
                            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">↳ {t.note}</p>
                          )}
                          {t.source_url && (
                            <p className="text-xs mt-1">
                              <a href={t.source_url} target="_blank" rel="noopener noreferrer"
                                 className="text-blue-600 dark:text-blue-400 hover:underline break-all">🔗 Fuente oficial del epígrafe</a>
                            </p>
                          )}
                          {t.source_notes && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic">{t.source_notes}</p>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {!epiLoading && epiDetail && epiDetail.length === 0 && (
              <p className="text-gray-500">Sin temas activos.</p>
            )}
          </div>
        </div>
      )}

      {covSlug && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setCovSlug(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-lg max-w-3xl w-full max-h-[85vh] overflow-y-auto p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">📄 Artículos sin preguntas · {covNombre}</h2>
              <button
                onClick={() => setCovSlug(null)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl leading-none"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Artículos que están en el temario (topic_scope) con contenido real pero <strong>0 preguntas activas</strong>: al usuario nunca le salen en los tests aunque el tema tenga preguntas. Excluye derogados. Solución: generar preguntas ancladas al texto del artículo con doble auditoría ciega.
            </p>
            {covLoading && <p className="text-gray-500">Cargando…</p>}
            {!covLoading && covDetail && (
              <ul className="space-y-2">
                {covDetail.map((a) => (
                  <li
                    key={`${a.topic_number}-${a.ley}-${a.article_number}`}
                    className="border border-gray-100 dark:border-gray-800 rounded p-2"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-gray-400">T{a.topic_number}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 whitespace-nowrap">
                        {a.ley} art. {a.article_number}
                      </span>
                      {a.title && <span className="text-xs text-gray-500 dark:text-gray-400">{a.title}</span>}
                    </div>
                    {a.preview && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{a.preview}…</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!covLoading && covDetail && covDetail.length === 0 && (
              <p className="text-gray-500">Ningún artículo con contenido sin preguntas. 🎉</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
