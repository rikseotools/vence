/**
 * Página filtrada de oposiciones — /oposiciones/[filtro]
 * /oposiciones/madrid → Oposiciones en Madrid
 * /oposiciones/c2 → Oposiciones Subgrupo C2
 * /oposiciones/estado → Oposiciones del Estado
 * /oposiciones/inscripcion-abierta → Con inscripción abierta
 */
import { Metadata } from 'next'
import { sql } from 'drizzle-orm'
import { getDb, getPoolerDb } from '@/db/client'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import FilteredResults, { type InitialFilters } from './FilteredResults'
import { isInscripcionAbierta } from '@/lib/oposiciones/inscripcion'
import { getCatalogadasAbiertas } from '../lib/catalogadas'
import {
  detectFilter,
  oposicionToCcaa,
  oposicionToTipo,
  CCAA_FILTERS,
  SUBGRUPO_FILTERS,
  TIPO_FILTERS,
  type OposicionFilter,
} from '../lib/oposiciones-filters'

// NO pre-renderizamos en build: tras migrar getFilteredOposiciones a conexión
// Postgres directa (Fase C1, getDb max:1), pre-generar las ~50 páginas de filtro
// durante `next build` (13 workers en paralelo, con DATABASE_URL pasado como
// build-arg en CI) saturaba el pooler y las páginas superaban el timeout de 180s
// → el build de Docker fallaba y bloqueaba TODOS los deploys (23/06). Con
// `dynamicParams` (default true) + `revalidate`, cada filtro se renderiza
// on-demand en el primer request (runtime: max:1 por instancia, sin contención)
// y se cachea 1h. Mismo resultado para el usuario/SEO, sin DB en build.
export async function generateStaticParams() {
  return []
}

export const dynamicParams = true
export const revalidate = 3600

// ============================================
// METADATA
// ============================================

export async function generateMetadata({ params }: { params: Promise<{ filtro: string }> }): Promise<Metadata> {
  const { filtro } = await params
  const filter = detectFilter(filtro)
  if (!filter) return {}

  return {
    title: `${filter.seoTitle} | Vence`,
    description: filter.seoDescription,
    openGraph: {
      title: filter.seoTitle,
      description: filter.seoDescription,
      url: `https://www.vence.es/oposiciones/${filtro}`,
    },
    alternates: { canonical: `https://www.vence.es/oposiciones/${filtro}` },
  }
}

// ============================================
// DATA
// ============================================

interface OposicionRow {
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

// Agnóstico (Fase C1): Drizzle en vez de supabase.from. Fechas ::text (string
// 'YYYY-MM-DD' EXACTO como PostgREST; isInscripcionAbierta/isShowableCatalogada
// hacen .slice(0,10)). Público (is_active=true) → getDb/getPoolerDb.
function db() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

// TODAS las oposiciones activas. El filtrado ya NO se hace en servidor: la página
// pasa TODAS al componente cliente (modelo unificado — /oposiciones/<filtro> = base
// con un chip pre-activado y quitable). `applyFilter` se conserva SOLO para el
// recuento del H1/SEO (server-rendered).
async function getAllActiveOposiciones(): Promise<OposicionRow[]> {
  try {
    const rows = await db().execute(sql`
      SELECT slug, nombre, plazas_libres, plazas_discapacidad, estado_proceso,
             is_convocatoria_activa,
             exam_date::text AS exam_date,
             inscription_start::text AS inscription_start,
             inscription_deadline::text AS inscription_deadline,
             subgrupo
      FROM oposiciones_ssot
      WHERE is_active = true
      ORDER BY plazas_libres DESC NULLS LAST
    `)
    return (Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows || []) as unknown as OposicionRow[]
  } catch (e) {
    console.warn('[oposiciones/filtro] getAllActiveOposiciones falló:', (e as Error).message)
    return []
  }
}

// PURA: aplica el filtro de la URL. Solo para el recuento del H1/SEO — el componente
// cliente aplica los mismos criterios vía initialFilters (mismas funciones puras →
// mismos números; el chip pre-activado hace que el SSR ya venga filtrado).
function applyFilter(all: OposicionRow[], filter: OposicionFilter): OposicionRow[] {
  switch (filter.type) {
    case 'ccaa':
      return all.filter(o => oposicionToCcaa(o.slug) === filter.slug)
    case 'subgrupo':
      return all.filter(o => o.subgrupo === filter.value)
    case 'tipo':
      return all.filter(o => oposicionToTipo(o.slug) === filter.value)
    case 'estado':
      return all.filter(o => o.estado_proceso === filter.value)
    case 'inscripcion_abierta':
      // FUENTE DE VERDAD = fechas, no estado_proceso (que puede estar desfasado).
      return all.filter(o => isInscripcionAbierta(o))
    default:
      return all
  }
}

// Traduce el filtro de la URL al chip PRE-ACTIVADO del componente cliente.
function filterToInitial(filter: OposicionFilter): InitialFilters {
  switch (filter.type) {
    case 'ccaa':
      return { comunidad: [filter.slug] }
    case 'subgrupo':
      return { subgrupo: [filter.value] }
    case 'tipo':
      return { tipo: [filter.value] }
    case 'inscripcion_abierta':
      return { abierta: true }
    case 'estado':
      // El único filtro de estado expuesto ('proximos-examenes') = examen próximo.
      return filter.value === 'pendiente_examen' ? { examen: true } : {}
    default:
      return {}
  }
}

// Catalogadas abiertas (sin test todavía) → helper compartido con /oposiciones.

// ============================================
// PAGE
// ============================================

export default async function FiltroOposicionesPage({ params }: { params: Promise<{ filtro: string }> }) {
  const { filtro } = await params
  const filter = detectFilter(filtro)
  if (!filter) notFound()

  // TODAS las oposiciones → al componente (que pre-activa el chip del filtro). El
  // set filtrado (applyFilter) es solo para el recuento del H1/SEO.
  const oposicionesAll = await getAllActiveOposiciones()
  const filtradas = applyFilter(oposicionesAll, filter)
  const initialFilters = filterToInitial(filter)
  // Solo en la página de inscripción abierta añadimos las catalogadas (sin test todavía).
  const catalogadas = filter.type === 'inscripcion_abierta' ? await getCatalogadasAbiertas() : []

  const totalPlazas = filtradas.reduce((sum, o) => sum + (o.plazas_libres ?? 0) + (o.plazas_discapacidad ?? 0), 0)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Oposiciones', item: 'https://www.vence.es/oposiciones' },
      { '@type': 'ListItem', position: 2, name: filter.label, item: `https://www.vence.es/oposiciones/${filtro}` },
    ],
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <nav className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            <Link href="/oposiciones" className="hover:text-blue-600">Oposiciones</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900 dark:text-white font-medium">{filter.label}</span>
          </nav>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {filter.seoTitle}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {filtradas.length} oposiciones con{' '}
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {totalPlazas.toLocaleString('es-ES')} plazas
            </span>
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/oposiciones" className="text-sm text-blue-600 hover:underline">
          ← Todas las oposiciones
        </Link>

        <div className="mt-4">
          {/* Filtrado facetado en cliente (chips + panel colapsable, mobile-first).
              Refina el set ya cargado; la página sigue SSR para SEO (H1/JSON-LD/canónica). */}
          <FilteredResults oposiciones={oposicionesAll} catalogadas={catalogadas} initialFilters={initialFilters} />
        </div>

        {/* Pie de enlaces internos: descubrimiento + SEO (cada filtro es una URL
            canónica indexable). El filtro interactivo de arriba refina client-side;
            estos enlaces navegan a las páginas base. */}
        <nav className="mt-12 border-t border-gray-200 dark:border-gray-700 pt-8">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Explorar por categoría
          </h2>
          <div className="flex flex-wrap gap-2">
            {[...Object.values(TIPO_FILTERS), ...Object.values(SUBGRUPO_FILTERS)].map(f => (
              <Link key={f.slug} href={`/oposiciones/${f.slug}`}
                className={`px-3 py-1.5 text-sm rounded-full border ${f.slug === filtro ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400'}`}>
                {f.label}
              </Link>
            ))}
          </div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-6 mb-3">
            Por comunidad
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.values(CCAA_FILTERS).map(f => (
              <Link key={f.slug} href={`/oposiciones/${f.slug}`}
                className={`px-3 py-1.5 text-sm rounded-full border ${f.slug === filtro ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400'}`}>
                {f.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
