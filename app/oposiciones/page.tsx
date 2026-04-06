/**
 * Directorio de oposiciones C1/C2 — /oposiciones
 * Muestra NUESTRAS oposiciones (tabla oposiciones) con filtros SEO.
 */
import { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import OposicionCard from './components/OposicionCard'
import { CCAA_FILTERS, SUBGRUPO_FILTERS, TIPO_FILTERS, ESTADO_FILTERS, oposicionToCcaa, oposicionToTipo } from './lib/oposiciones-filters'

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
  inscription_deadline: string | null
  subgrupo: string | null
}

async function getOposiciones(): Promise<OposicionRow[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return []
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const { data } = await supabase
    .from('oposiciones')
    .select('slug, nombre, plazas_libres, plazas_discapacidad, estado_proceso, is_convocatoria_activa, exam_date, inscription_deadline, subgrupo')
    .eq('is_active', true)
    .order('plazas_libres', { ascending: false, nullsFirst: false })
  return (data ?? []) as OposicionRow[]
}

function estadoOrder(estado: string | null): number {
  const order: Record<string, number> = {
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
  return order[estado ?? ''] ?? 10
}

export default async function OposicionesPage() {
  const oposiciones = await getOposiciones()

  // Ordenar: inscripción abierta primero, luego por plazas
  const sorted = [...oposiciones].sort((a, b) => {
    const estadoDiff = estadoOrder(a.estado_proceso) - estadoOrder(b.estado_proceso)
    if (estadoDiff !== 0) return estadoDiff
    return (b.plazas_libres ?? 0) - (a.plazas_libres ?? 0)
  })

  const totalPlazas = oposiciones.reduce((sum, o) => sum + (o.plazas_libres ?? 0) + (o.plazas_discapacidad ?? 0), 0)
  const conInscripcion = oposiciones.filter(o => o.estado_proceso === 'inscripcion_abierta')

  // JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Oposiciones C1 y C2 en España',
    numberOfItems: oposiciones.length,
    itemListElement: sorted.map((o, i) => ({
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Sidebar: filtros */}
          <aside className="lg:col-span-1">
            <div className="sticky top-4 space-y-6">
              {/* Por tipo */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 uppercase tracking-wide">Por tipo</h3>
                <div className="space-y-1">
                  {Object.values(TIPO_FILTERS).map(f => (
                    <Link key={f.slug} href={`/oposiciones/${f.slug}`}
                      className="block px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">
                      {f.label}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Por subgrupo */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 uppercase tracking-wide">Por subgrupo</h3>
                <div className="space-y-1">
                  {Object.values(SUBGRUPO_FILTERS).map(f => (
                    <Link key={f.slug} href={`/oposiciones/${f.slug}`}
                      className="block px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">
                      {f.label}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Por CCAA */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 uppercase tracking-wide">Por comunidad</h3>
                <div className="space-y-1">
                  {Object.values(CCAA_FILTERS).map(f => (
                    <Link key={f.slug} href={`/oposiciones/${f.slug}`}
                      className="block px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">
                      {f.label}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Por estado */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 uppercase tracking-wide">Por estado</h3>
                <div className="space-y-1">
                  {Object.values(ESTADO_FILTERS).map(f => (
                    <Link key={f.slug} href={`/oposiciones/${f.slug}`}
                      className="block px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">
                      {f.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Main: cards */}
          <main className="lg:col-span-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sorted.map(o => (
                <OposicionCard
                  key={o.slug}
                  slug={o.slug}
                  nombre={o.nombre}
                  plazasLibres={o.plazas_libres}
                  plazasDiscapacidad={o.plazas_discapacidad}
                  estadoProceso={o.estado_proceso}
                  isConvocatoriaActiva={o.is_convocatoria_activa}
                  examDate={o.exam_date}
                  inscriptionDeadline={o.inscription_deadline}
                  subgrupo={o.subgrupo}
                />
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
