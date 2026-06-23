/**
 * Página filtrada de oposiciones — /oposiciones/[filtro]
 * /oposiciones/madrid → Oposiciones en Madrid
 * /oposiciones/c2 → Oposiciones Subgrupo C2
 * /oposiciones/estado → Oposiciones del Estado
 * /oposiciones/inscripcion-abierta → Con inscripción abierta
 */
import { Metadata } from 'next'
import { sql } from 'drizzle-orm'
import { getDb, getPoolerDb, getAdminDb } from '@/db/client'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import OposicionCard from '../components/OposicionCard'
import CatalogadaCard from '../components/CatalogadaCard'
import { isInscripcionAbierta, isShowableCatalogada } from '@/lib/oposiciones/inscripcion'
import {
  detectFilter,
  getAllFilterSlugs,
  oposicionToCcaa,
  oposicionToTipo,
  CCAA_FILTERS,
  SUBGRUPO_FILTERS,
  TIPO_FILTERS,
  ESTADO_FILTERS,
  type OposicionFilter,
} from '../lib/oposiciones-filters'

export async function generateStaticParams() {
  return getAllFilterSlugs().map(slug => ({ filtro: slug }))
}

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

async function getFilteredOposiciones(filter: OposicionFilter): Promise<OposicionRow[]> {
  let all: OposicionRow[] = []
  try {
    const rows = await db().execute(sql`
      SELECT slug, nombre, plazas_libres, plazas_discapacidad, estado_proceso,
             is_convocatoria_activa,
             exam_date::text AS exam_date,
             inscription_start::text AS inscription_start,
             inscription_deadline::text AS inscription_deadline,
             subgrupo
      FROM oposiciones
      WHERE is_active = true
      ORDER BY plazas_libres DESC NULLS LAST
    `)
    all = (Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows || []) as unknown as OposicionRow[]
  } catch (e) {
    console.warn('[oposiciones/filtro] getFilteredOposiciones falló:', (e as Error).message)
    return []
  }

  // Filtrar según tipo
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

// Catalogadas (is_active=false, sin landing/tests) con inscripción abierta HOY y
// convocatoria oficial. Se muestran solo en /oposiciones/inscripcion-abierta, como
// sección "sin test todavía" enlazando a la fuente oficial (nunca a una landing
// inexistente). Service-role: las catalogadas no son visibles por el camino anon
// (RLS); alineado con la retirada de RLS (Fase P). Decisión producto 20/06.
interface CatalogadaAbierta {
  slug: string
  nombre: string
  plazas_libres: number | null
  inscription_deadline: string | null
  seguimiento_url: string | null
}

async function getCatalogadasAbiertas(): Promise<CatalogadaAbierta[]> {
  try {
    // is_active=false → no visible por anon/RLS; getAdminDb bypasea RLS (= service_role).
    const rows = await getAdminDb().execute(sql`
      SELECT slug, nombre, plazas_libres,
             inscription_start::text AS inscription_start,
             inscription_deadline::text AS inscription_deadline,
             seguimiento_url
      FROM oposiciones
      WHERE is_active = false
      ORDER BY inscription_deadline ASC NULLS LAST
    `)
    const results = (Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows || []) as unknown as (CatalogadaAbierta & { inscription_start: string | null })[]
    return results.filter(o => isShowableCatalogada({ ...o, is_active: false }))
  } catch (e) {
    console.warn('[oposiciones/filtro] getCatalogadasAbiertas falló:', (e as Error).message)
    return []
  }
}

// ============================================
// PAGE
// ============================================

export default async function FiltroOposicionesPage({ params }: { params: Promise<{ filtro: string }> }) {
  const { filtro } = await params
  const filter = detectFilter(filtro)
  if (!filter) notFound()

  const oposiciones = await getFilteredOposiciones(filter)
  // Solo en la página de inscripción abierta añadimos las catalogadas (sin test todavía).
  const catalogadas = filter.type === 'inscripcion_abierta' ? await getCatalogadasAbiertas() : []

  const totalPlazas = oposiciones.reduce((sum, o) => sum + (o.plazas_libres ?? 0) + (o.plazas_discapacidad ?? 0), 0)

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
            {oposiciones.length} oposiciones con{' '}
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {totalPlazas.toLocaleString('es-ES')} plazas
            </span>
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Sidebar: otros filtros */}
          <aside className="lg:col-span-1">
            <div className="sticky top-4 space-y-6">
              <Link href="/oposiciones" className="text-sm text-blue-600 hover:underline">
                ← Todas las oposiciones
              </Link>

              {filter.type !== 'tipo' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 uppercase tracking-wide">Por tipo</h3>
                  <div className="space-y-1">
                    {Object.values(TIPO_FILTERS).map(f => (
                      <Link key={f.slug} href={`/oposiciones/${f.slug}`}
                        className={`block px-3 py-1.5 text-sm rounded-md ${f.slug === filtro ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                        {f.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {filter.type !== 'subgrupo' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 uppercase tracking-wide">Por subgrupo</h3>
                  <div className="space-y-1">
                    {Object.values(SUBGRUPO_FILTERS).map(f => (
                      <Link key={f.slug} href={`/oposiciones/${f.slug}`}
                        className={`block px-3 py-1.5 text-sm rounded-md ${f.slug === filtro ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                        {f.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {filter.type !== 'ccaa' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 uppercase tracking-wide">Por comunidad</h3>
                  <div className="space-y-1">
                    {Object.values(CCAA_FILTERS).map(f => (
                      <Link key={f.slug} href={`/oposiciones/${f.slug}`}
                        className={`block px-3 py-1.5 text-sm rounded-md ${f.slug === filtro ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                        {f.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Main: cards */}
          <main className="lg:col-span-3">
            {oposiciones.length === 0 && catalogadas.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  No hay oposiciones activas con este filtro.
                </p>
                <Link href="/oposiciones" className="mt-4 inline-block text-blue-600 hover:underline">
                  Ver todas las oposiciones
                </Link>
              </div>
            ) : (
              <>
                {oposiciones.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {oposiciones.map(o => (
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

                {/* Catalogadas: inscripción abierta pero aún sin tests en Vence.
                    Enlazan a la convocatoria oficial (no a una landing inexistente). */}
                {catalogadas.length > 0 && (
                  <div className={oposiciones.length > 0 ? 'mt-10' : ''}>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      Otras convocatorias abiertas <span className="font-normal text-gray-500 dark:text-gray-400">(sin test todavía en Vence)</span>
                    </h2>
                    <p className="mt-1 mb-4 text-sm text-gray-600 dark:text-gray-400">
                      Tienen el plazo de inscripción abierto. Aún no hemos preparado tests, pero puedes ir a la convocatoria oficial.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {catalogadas.map(c => (
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
          </main>
        </div>
      </div>
    </div>
  )
}
