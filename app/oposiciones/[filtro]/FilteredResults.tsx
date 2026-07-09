'use client'
// app/oposiciones/[filtro]/FilteredResults.tsx
//
// Filtrado FACETADO en cliente, COMPARTIDO por /oposiciones y /oposiciones/[filtro].
// Sustituye la antigua barra lateral de enlaces (apilada y fea en móvil) por:
//   · chips de los filtros activos ARRIBA, cada uno con ✕ para quitarlo,
//   · un panel colapsable con facetas (Tipo, Subgrupo, Comunidad) + toggles
//     ("Inscripción abierta", "Con examen próximo") + orden,
//   · multi-selección (OR dentro del grupo, AND entre grupos), contador en vivo.
//
// MODELO UNIFICADO: /oposiciones es la base (todas las oposiciones); cada página
// /oposiciones/<filtro> es LA MISMA base con un chip PRE-ACTIVADO (initialFilters)
// y quitable — p.ej. /oposiciones/inscripcion-abierta = /oposiciones con el tag
// "Inscripción abierta" puesto. La página sigue SSR para SEO (H1, JSON-LD, URL
// canónica); el estado inicial ya viene filtrado, así que el HTML server-rendered
// respeta el filtro. Las facetas se derivan de los datos: un grupo solo aparece si
// tiene ≥2 opciones distintas.

import { useMemo, useState } from 'react'
import OposicionCard from '../components/OposicionCard'
import CatalogadaCard from '../components/CatalogadaCard'
import {
  oposicionToCcaa,
  oposicionToTipo,
  CCAA_FILTERS,
  TIPO_FILTERS,
} from '../lib/oposiciones-filters'
import { isInscripcionAbierta, todayMadrid } from '@/lib/oposiciones/inscripcion'

export interface OpoItem {
  slug: string
  nombre: string
  plazas_libres: number | null
  plazas_discapacidad: number | null
  estado_proceso: string | null
  is_convocatoria_activa: boolean
  exam_date: string | null
  inscription_start: string | null
  inscription_deadline: string | null
  subgrupo: string | null
}

export interface CatalogadaItem {
  slug: string
  nombre: string
  plazas_libres: number | null
  inscription_deadline: string | null
  seguimiento_url: string | null
  subgrupo: string | null
}

/** Filtros pre-activados por la página (p.ej. la de inscripción abierta). */
export interface InitialFilters {
  tipo?: string[]
  subgrupo?: string[]
  comunidad?: string[]
  abierta?: boolean
  examen?: boolean
}

type GroupKey = 'tipo' | 'subgrupo' | 'comunidad'
type SortKey = 'destacados' | 'plazas' | 'cierra'

interface Enriched extends OpoItem {
  _tipo: string
  _ccaa: string | null
  _plazas: number
  _abierta: boolean
}

// Orden por fase del proceso (mismo criterio que la home): abiertas primero, luego
// por avance del estado, luego por plazas.
const ESTADO_ORDER: Record<string, number> = {
  inscripcion_abierta: 0,
  convocada: 1,
  inscripcion_cerrada: 2,
  lista_admitidos: 3,
  pendiente_examen: 4,
  examen_realizado: 5,
  oep_aprobada: 6,
  resultados: 7,
  nombramientos: 8,
  sin_oep: 9,
}
const estadoOrder = (e: string | null) => ESTADO_ORDER[e ?? ''] ?? 10

const tipoLabel = (v: string) => TIPO_FILTERS[v]?.label ?? v
const ccaaLabel = (v: string) => CCAA_FILTERS[v]?.label ?? v

// Examen futuro: comparación lexicográfica de 'YYYY-MM-DD' (== cronológica).
// A nivel de módulo (no closure) para que las deps de los useMemo queden completas.
const hasFutureExam = (examDate: string | null, today: string) =>
  !!examDate && examDate.slice(0, 10) >= today

export default function FilteredResults({
  oposiciones,
  catalogadas,
  initialFilters,
}: {
  oposiciones: OpoItem[]
  catalogadas: CatalogadaItem[]
  initialFilters?: InitialFilters
}) {
  const today = todayMadrid()

  const [sel, setSel] = useState<Record<GroupKey, string[]>>({
    tipo: initialFilters?.tipo ?? [],
    subgrupo: initialFilters?.subgrupo ?? [],
    comunidad: initialFilters?.comunidad ?? [],
  })
  const [soloAbierta, setSoloAbierta] = useState(!!initialFilters?.abierta)
  const [soloExamen, setSoloExamen] = useState(!!initialFilters?.examen)
  const [sort, setSort] = useState<SortKey>('destacados')
  const [panelOpen, setPanelOpen] = useState(true)
  const [verTodasCcaa, setVerTodasCcaa] = useState(false)

  // Enriquecer una vez: tipo/comunidad se derivan del slug; abierta, de las fechas.
  const enriched: Enriched[] = useMemo(
    () =>
      oposiciones.map((o) => ({
        ...o,
        _tipo: oposicionToTipo(o.slug),
        _ccaa: oposicionToCcaa(o.slug),
        _plazas: (o.plazas_libres ?? 0) + (o.plazas_discapacidad ?? 0),
        _abierta: isInscripcionAbierta(o, today),
      })),
    [oposiciones, today],
  )

  const algunExamen = useMemo(() => enriched.some((o) => hasFutureExam(o.exam_date, today)), [enriched, today])
  const algunaAbierta = useMemo(() => enriched.some((o) => o._abierta), [enriched])

  // Opciones de cada faceta (con recuento). Solo se renderiza un grupo con ≥2 opciones.
  const facets = useMemo(() => {
    const count = (pick: (o: Enriched) => string | null | undefined) => {
      const m = new Map<string, number>()
      for (const o of enriched) {
        const v = pick(o)
        if (v) m.set(v, (m.get(v) ?? 0) + 1)
      }
      return m
    }
    const order = (m: Map<string, number>, label: (v: string) => string) =>
      [...m.entries()]
        .map(([value, n]) => ({ value, n, label: label(value) }))
        .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'es'))

    return {
      tipo: order(count((o) => o._tipo), tipoLabel),
      subgrupo: order(count((o) => o.subgrupo), (v) => v),
      comunidad: order(count((o) => o._ccaa), ccaaLabel),
    }
  }, [enriched])

  const toggle = (group: GroupKey, value: string) =>
    setSel((prev) => {
      const cur = prev[group]
      return {
        ...prev,
        [group]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value],
      }
    })

  const clearAll = () => {
    setSel({ tipo: [], subgrupo: [], comunidad: [] })
    setSoloAbierta(false)
    setSoloExamen(false)
  }

  // Filtrar: OR dentro del grupo, AND entre grupos.
  const filtered = useMemo(() => {
    const out = enriched.filter((o) => {
      if (sel.tipo.length && !sel.tipo.includes(o._tipo)) return false
      if (sel.subgrupo.length && !(o.subgrupo && sel.subgrupo.includes(o.subgrupo))) return false
      if (sel.comunidad.length && !(o._ccaa && sel.comunidad.includes(o._ccaa))) return false
      if (soloAbierta && !o._abierta) return false
      if (soloExamen && !hasFutureExam(o.exam_date, today)) return false
      return true
    })
    out.sort((a, b) => {
      if (sort === 'plazas') return b._plazas - a._plazas
      if (sort === 'cierra') {
        const da = a.inscription_deadline ?? '9999'
        const db = b.inscription_deadline ?? '9999'
        return da.localeCompare(db)
      }
      // 'destacados': abiertas primero → fase del estado → plazas (orden home).
      const ab = (b._abierta ? 1 : 0) - (a._abierta ? 1 : 0)
      if (ab) return ab
      const eo = estadoOrder(a.estado_proceso) - estadoOrder(b.estado_proceso)
      if (eo) return eo
      return b._plazas - a._plazas
    })
    return out
  }, [enriched, sel, soloAbierta, soloExamen, sort, today])

  // Catalogadas (sin test todavía): son convocatorias abiertas → solo tienen sentido
  // con el tag "Inscripción abierta" activo. Se refinan por LOS MISMOS facets que las
  // publicadas (tipo/comunidad derivados del slug + subgrupo propio) → al pinchar C2
  // se ven también las C2 sin test, no desaparecen.
  const filteredCatalogadas = useMemo(() => {
    if (!soloAbierta) return []
    return catalogadas.filter((c) => {
      const tipo = oposicionToTipo(c.slug)
      const ccaa = oposicionToCcaa(c.slug)
      if (sel.tipo.length && !sel.tipo.includes(tipo)) return false
      if (sel.comunidad.length && !(ccaa && sel.comunidad.includes(ccaa))) return false
      if (sel.subgrupo.length && !(c.subgrupo && sel.subgrupo.includes(c.subgrupo))) return false
      if (soloExamen) return false // las catalogadas no tienen fecha de examen conocida
      return true
    })
  }, [catalogadas, sel, soloAbierta, soloExamen])

  // Chips de filtros activos.
  const chips: { key: string; label: string; onRemove: () => void }[] = [
    ...(soloAbierta ? [{ key: 'abierta', label: 'Inscripción abierta', onRemove: () => setSoloAbierta(false) }] : []),
    ...sel.tipo.map((v) => ({ key: `tipo:${v}`, label: tipoLabel(v), onRemove: () => toggle('tipo', v) })),
    ...sel.subgrupo.map((v) => ({ key: `sub:${v}`, label: `Subgrupo ${v}`, onRemove: () => toggle('subgrupo', v) })),
    ...sel.comunidad.map((v) => ({ key: `ccaa:${v}`, label: ccaaLabel(v), onRemove: () => toggle('comunidad', v) })),
    ...(soloExamen ? [{ key: 'examen', label: 'Con examen próximo', onRemove: () => setSoloExamen(false) }] : []),
  ]
  const activeCount = chips.length

  const groups: { key: GroupKey; title: string; options: { value: string; label: string; n: number }[]; limit?: boolean }[] = []
  if (facets.tipo.length >= 2) groups.push({ key: 'tipo', title: 'Tipo de administración', options: facets.tipo })
  if (facets.subgrupo.length >= 2) groups.push({ key: 'subgrupo', title: 'Subgrupo', options: facets.subgrupo })
  if (facets.comunidad.length >= 2) groups.push({ key: 'comunidad', title: 'Comunidad', options: facets.comunidad, limit: true })

  const showAbiertaToggle = algunaAbierta || soloAbierta
  const showExamenToggle = algunExamen || soloExamen
  const totalResultados = filtered.length + filteredCatalogadas.length

  return (
    <div>
      {/* Barra de control: botón Filtros + recuento + orden */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 011 1v1.586a1 1 0 01-.293.707l-4.414 4.414a1 1 0 00-.293.707V15a1 1 0 01-.553.894l-2 1A1 1 0 018 16v-3.879a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V5z" clipRule="evenodd" />
          </svg>
          Filtros
          {activeCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-blue-600 text-white text-xs font-bold">
              {activeCount}
            </span>
          )}
          <svg className={`w-4 h-4 transition-transform ${panelOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {totalResultados} resultado{totalResultados === 1 ? '' : 's'}
          </span>
          <label className="sr-only" htmlFor="orden">Ordenar</label>
          <select
            id="orden"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 px-2 py-2"
          >
            <option value="destacados">Destacados</option>
            <option value="plazas">Más plazas</option>
            <option value="cierra">Inscripción cierra antes</option>
          </select>
        </div>
      </div>

      {/* Chips de filtros activos */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.onRemove}
              className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900"
            >
              {c.label}
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600/20 dark:bg-blue-300/20" aria-label="Quitar filtro">✕</span>
            </button>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline"
          >
            Limpiar todo
          </button>
        </div>
      )}

      {/* Panel de facetas (colapsable) */}
      {panelOpen && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-6 bg-white dark:bg-gray-800 space-y-4">
          {groups.map((g) => {
            const opts = g.limit && !verTodasCcaa ? g.options.slice(0, 8) : g.options
            return (
              <div key={g.key}>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  {g.title}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {opts.map((opt) => {
                    const active = sel[g.key].includes(opt.value)
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggle(g.key, opt.value)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          active
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400'
                        }`}
                      >
                        {opt.label}
                        {active ? (
                          <span className="text-blue-100" aria-label="Quitar filtro">✕</span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">{opt.n}</span>
                        )}
                      </button>
                    )
                  })}
                  {g.limit && g.options.length > 8 && (
                    <button
                      type="button"
                      onClick={() => setVerTodasCcaa((v) => !v)}
                      className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {verTodasCcaa ? 'Ver menos' : `+${g.options.length - 8} más`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {/* Toggles: estado de inscripción / examen */}
          {(showAbiertaToggle || showExamenToggle) && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Estado
              </h4>
              <div className="flex flex-wrap gap-2">
                {showAbiertaToggle && (
                  <button
                    type="button"
                    onClick={() => setSoloAbierta((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      soloAbierta
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-green-400'
                    }`}
                  >
                    Inscripción abierta
                    {soloAbierta && <span className="text-green-100" aria-label="Quitar filtro">✕</span>}
                  </button>
                )}
                {showExamenToggle && (
                  <button
                    type="button"
                    onClick={() => setSoloExamen((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      soloExamen
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400'
                    }`}
                  >
                    Con examen próximo
                    {soloExamen && <span className="text-blue-100" aria-label="Quitar filtro">✕</span>}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resultados */}
      {totalResultados === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            Ninguna oposición coincide con estos filtros.
          </p>
          <button type="button" onClick={clearAll} className="mt-4 inline-block text-blue-600 hover:underline">
            Quitar filtros
          </button>
        </div>
      ) : (
        <>
          {filtered.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((o) => (
                <OposicionCard
                  key={o.slug}
                  slug={o.slug}
                  nombre={o.nombre}
                  plazasLibres={o.plazas_libres}
                  plazasDiscapacidad={o.plazas_discapacidad}
                  estadoProceso={o.estado_proceso}
                  isConvocatoriaActiva={o.is_convocatoria_activa}
                  examDate={o.exam_date}
                  inscriptionStart={o.inscription_start}
                  inscriptionDeadline={o.inscription_deadline}
                  subgrupo={o.subgrupo}
                />
              ))}
            </div>
          )}

          {filteredCatalogadas.length > 0 && (
            <div className={filtered.length > 0 ? 'mt-10' : ''}>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Otras convocatorias abiertas{' '}
                <span className="font-normal text-gray-500 dark:text-gray-400">(sin test todavía en Vence)</span>
              </h2>
              <p className="mt-1 mb-4 text-sm text-gray-600 dark:text-gray-400">
                Tienen el plazo de inscripción abierto. Aún no hemos preparado tests, pero puedes ir a la convocatoria oficial.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredCatalogadas.map((c) => (
                  <CatalogadaCard
                    key={c.slug}
                    slug={c.slug}
                    nombre={c.nombre}
                    plazasLibres={c.plazas_libres}
                    inscriptionDeadline={c.inscription_deadline}
                    seguimientoUrl={c.seguimiento_url}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
