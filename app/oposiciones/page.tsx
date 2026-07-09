/**
 * Directorio de oposiciones C1/C2 — /oposiciones
 * Muestra NUESTRAS oposiciones (tabla oposiciones) con filtros SEO.
 */
import { Metadata } from 'next'
import { sql } from 'drizzle-orm'
import { getDb, getPoolerDb } from '@/db/client'
import Link from 'next/link'
import FilteredResults from './[filtro]/FilteredResults'
import { getCatalogadasAbiertas } from './lib/catalogadas'
import { CCAA_FILTERS, SUBGRUPO_FILTERS, TIPO_FILTERS } from './lib/oposiciones-filters'
import { isInscripcionAbierta } from '@/lib/oposiciones/inscripcion'

export const metadata: Metadata = {
  title: 'Oposiciones en España 2026 | Plazas y Convocatorias | Vence',
  description: 'Directorio de oposiciones en España: Auxiliar Administrativo (C2), Administrativo (C1), Enfermería (A2), TCAE y más. Estado, Comunidades Autónomas, Sanidad y Justicia. Plazas, fechas de examen y temarios actualizados.',
  keywords: [
    'oposiciones 2026',
    'auxiliar administrativo',
    'administrativo estado',
    'oposiciones enfermería',
    'oposiciones sanidad',
    'convocatorias oposiciones españa',
    'plazas oposiciones',
  ],
  openGraph: {
    title: 'Oposiciones en España 2026 | Vence',
    description: 'Directorio de oposiciones con plazas, fechas y temarios actualizados',
    url: 'https://www.vence.es/oposiciones',
    type: 'website',
  },
  alternates: { canonical: 'https://www.vence.es/oposiciones' },
}

export const revalidate = 3600

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

// Agnóstico (Fase C1): Drizzle en vez de supabase.from (PostgREST). Lectura
// pública (tabla `oposiciones`), sin auth/user_id. Las columnas `date` se
// castean a ::text para devolver 'YYYY-MM-DD' string EXACTO como hacía PostgREST
// (isInscripcionAbierta hace .slice(0,10) sobre ellas — un Date rompería).
function db() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

async function getOposiciones(): Promise<OposicionRow[]> {
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
    const results = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows || []
    return results as unknown as OposicionRow[]
  } catch (e) {
    console.warn('[oposiciones] getOposiciones falló:', (e as Error).message)
    return []
  }
}

export default async function OposicionesPage() {
  const oposiciones = await getOposiciones()
  // Catalogadas (sin test todavía): solo se muestran si el usuario activa el tag
  // "Inscripción abierta" en el filtro. El orden (destacados/plazas/cierra) lo maneja
  // el componente cliente.
  const catalogadas = await getCatalogadasAbiertas()

  // "Inscripción abierta" se deriva de FECHAS (fuente de verdad, igual que home/SEO/banner/
  // card), no de estado_proceso (que puede estar desfasado) — incidente 20/06.
  const conInscripcion = oposiciones.filter(o => isInscripcionAbierta(o))

  const totalPlazas = oposiciones.reduce((sum, o) => sum + (o.plazas_libres ?? 0) + (o.plazas_discapacidad ?? 0), 0)

  // JSON-LD (orden de fetch: plazas desc — irrelevante para ItemList).
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Oposiciones C1 y C2 en España',
    numberOfItems: oposiciones.length,
    itemListElement: oposiciones.map((o, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://www.vence.es/${o.slug}`,
      name: o.nombre,
    })),
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            Oposiciones en Espa&ntilde;a 2026
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400 max-w-2xl">
            {oposiciones.length} oposiciones de Administraci&oacute;n, Sanidad y Justicia con{' '}
            <span className="font-semibold text-blue-600 dark:text-blue-400">{totalPlazas.toLocaleString('es-ES')} plazas</span>.
            {conInscripcion.length > 0 && (
              <span className="text-green-700 dark:text-green-400 font-semibold">
                {' '}{conInscripcion.length} con inscripci&oacute;n abierta ahora.
              </span>
            )}
          </p>

          {/* Stats */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div className="bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg">
              <span className="font-bold text-blue-700 dark:text-blue-300">{oposiciones.length}</span>
              <span className="text-blue-600 dark:text-blue-400 ml-1">oposiciones</span>
            </div>
            <div className="bg-green-50 dark:bg-green-900/30 px-3 py-1.5 rounded-lg">
              <span className="font-bold text-green-700 dark:text-green-300">{totalPlazas.toLocaleString('es-ES')}</span>
              <span className="text-green-600 dark:text-green-400 ml-1">plazas totales</span>
            </div>
            {conInscripcion.length > 0 && (
              <div className="bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg animate-pulse">
                <span className="font-bold text-emerald-700 dark:text-emerald-300">{conInscripcion.length}</span>
                <span className="text-emerald-600 dark:text-emerald-400 ml-1">inscripci&oacute;n abierta</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtrado facetado en cliente (chips + panel colapsable, mobile-first).
            Mismo componente que /oposiciones/[filtro]; aquí sin filtros pre-activados
            (base = todas). Activar el tag "Inscripción abierta" reproduce
            /oposiciones/inscripcion-abierta. */}
        <FilteredResults oposiciones={oposiciones} catalogadas={catalogadas} />

        {/* Pie de enlaces internos: descubrimiento + SEO (cada filtro es una URL
            canónica indexable). El filtro interactivo de arriba refina client-side. */}
        <nav className="mt-12 border-t border-gray-200 dark:border-gray-700 pt-8">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Explorar por categoría
          </h2>
          <div className="flex flex-wrap gap-2">
            {[...Object.values(TIPO_FILTERS), ...Object.values(SUBGRUPO_FILTERS)].map(f => (
              <Link key={f.slug} href={`/oposiciones/${f.slug}`}
                className="px-3 py-1.5 text-sm rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400">
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
                className="px-3 py-1.5 text-sm rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400">
                {f.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
