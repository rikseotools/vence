// app/leyes/[law]/page.tsx - PÁGINA PRINCIPAL DE CADA LEY CON META CANONICAL
import { Suspense } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { resolveLawBySlug, getCanonicalSlugAsync, getAllActiveSlugs } from '@/lib/api/laws'
import { getLawStats } from '@/lib/lawFetchers'
import { notFound } from 'next/navigation'
import LawArticlesClient from '../../teoria/[law]/LawArticlesClient'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import LawTestConfigurator from './LawTestConfigurator'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

interface PageProps {
  params: Promise<{ law: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

interface LawInfoResolved {
  shortName: string
  name: string
  description?: string
}

/** Resuelve lawShortName y lawInfo desde BD (Drizzle) */
async function resolveLaw(slug: string): Promise<{ lawShortName: string; lawInfo: LawInfoResolved } | null> {
  const law = await resolveLawBySlug(slug)
  if (!law) return null
  return {
    lawShortName: law.shortName,
    lawInfo: {
      shortName: law.shortName,
      name: law.name,
      description: law.description ?? `Test de ${law.shortName}`,
    },
  }
}

const SEO_DESCRIPTIONS: Record<string, string> = {
  'CE': 'Test de Constitución Española con preguntas de exámenes oficiales. Artículos, derechos fundamentales, organización del Estado. Preparación completa para oposiciones.',
  'Ley 39/2015': 'Test Ley 39/2015 LPAC - Procedimiento Administrativo Común. Preguntas oficiales sobre tramitación, plazos, recursos administrativos. Esencial para oposiciones.',
  'Ley 40/2015': 'Test Ley 40/2015 LRJSP - Régimen Jurídico Sector Público. Organización administrativa, competencias, funcionamiento. Preguntas actualizadas para oposiciones.',
  'Ley 19/2013': 'Test Ley 19/2013 de Transparencia, Acceso a la Información Pública y Buen Gobierno. Preguntas oficiales sobre transparencia administrativa.',
  'Código Civil': 'Test Código Civil español con preguntas de exámenes oficiales. Personas, bienes, obligaciones, contratos, familia, sucesiones. Derecho civil completo.',
  'Código Penal': 'Test Código Penal español actualizado. Delitos, penas, responsabilidad penal. Preguntas de exámenes oficiales para oposiciones de justicia.',
  'Ley 7/1985': 'Test Ley 7/1985 Bases del Régimen Local. Municipios, provincias, competencias locales. Preguntas oficiales para oposiciones de administración local.',
  'RDL 5/2015': 'Test Estatuto Básico del Empleado Público (TREBEP) - RDL 5/2015. Derechos, deberes, carrera profesional, régimen disciplinario. Esencial para oposiciones públicas.',
  'Estatuto de los Trabajadores': 'Test Estatuto de los Trabajadores actualizado. Contratos, derechos laborales, jornada, salarios. Preguntas oficiales de derecho laboral.',
  'TUE': 'Test Tratado de la Unión Europea con preguntas oficiales. Instituciones europeas, principios fundamentales, ciudadanía europea.',
  'TFUE': 'Test Tratado de Funcionamiento de la UE. Mercado interior, políticas europeas, competencias. Preguntas actualizadas para oposiciones europeas.',
  'LO 6/1985': 'Test Ley Orgánica del Poder Judicial. Organización judicial, juzgados, tribunales, carrera judicial. Preguntas oficiales para oposiciones de justicia.',
  'Ley 50/1981': 'Test Estatuto Orgánico del Ministerio Fiscal. Funciones del fiscal, organización, principios. Preguntas actualizadas para oposiciones de justicia.',
  'Ley 50/1997': 'Test Ley 50/1997 del Gobierno. Organización, funcionamiento y competencias del Gobierno. Preguntas oficiales para oposiciones administrativas.',
  'Ley 47/2003': 'Test Ley 47/2003 General Presupuestaria. Régimen presupuestario del sector público, contabilidad pública. Esencial para oposiciones económicas.',
  'LOTC': 'Test Ley Orgánica del Tribunal Constitucional. Organización, competencias, procedimientos constitucionales. Preguntas para oposiciones jurídicas.',
  'LO 3/2007': 'Test Ley Orgánica 3/2007 para la Igualdad Efectiva entre Mujeres y Hombres. Principios de igualdad, políticas públicas. Oposiciones sociales.',
  'LO 3/2018': 'Test Ley Orgánica 3/2018 de Protección de Datos Personales y Garantía de los Derechos Digitales. RGPD español para oposiciones tecnológicas.',
  'RC': 'Test Reglamento del Congreso de los Diputados. Organización parlamentaria, procedimiento legislativo, grupos parlamentarios. Esencial para oposiciones de Tramitación Procesal.',
  'RS': 'Test Reglamento del Senado. Organización, funcionamiento y procedimientos de la Cámara Alta. Preguntas oficiales para oposiciones de Cortes Generales.'
}

function getSEODescription(lawShortName: string, lawName: string): string {
  return SEO_DESCRIPTIONS[lawShortName] || `Test ${lawName} con preguntas actualizadas de exámenes oficiales. Contenido completo para preparación de oposiciones y estudio jurídico especializado.`
}

// 🎯 GENERAR METADATA DINÁMICOS CON CANONICAL URL
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const resolved = await resolveLaw(resolvedParams.law)

  if (!resolved) {
    return {
      title: 'Ley no encontrada | Vence',
      description: 'La ley solicitada no está disponible',
    }
  }

  const { lawShortName, lawInfo } = resolved
  const canonicalSlug = await getCanonicalSlugAsync(lawShortName)

  return {
    title: `Test ${lawInfo.name} | Vence`,
    description: getSEODescription(lawShortName, lawInfo.name),
    keywords: [
      `test ${lawInfo.name.toLowerCase()}`,
      'test leyes gratis',
      'práctica jurídica online',
      'oposiciones',
      'preguntas oficiales',
      'vence'
    ].join(', '),

    alternates: {
      canonical: `/leyes/${canonicalSlug}`
    },

    openGraph: {
      title: `Test: ${lawInfo.name} | Vence`,
      description: getSEODescription(lawShortName, lawInfo.name),
      type: 'website',
      siteName: 'Vence',
      url: `${SITE_URL}/leyes/${canonicalSlug}`
    },

    robots: {
      index: resolvedParams.law === canonicalSlug,
      follow: true
    },

    authors: [{ name: 'Vence' }],
    creator: 'Vence',
    publisher: 'Vence'
  }
}

// 🎯 GENERAR RUTAS ESTÁTICAS (auto-generado desde lawMappingUtils)
export async function generateStaticParams() {
  const slugs = await getAllActiveSlugs()
  return slugs.map(slug => ({ law: slug }))
}

// 🔧 COMPONENTE PARA CARGAR ESTADÍSTICAS
async function LawStatsLoader({ lawShortName }: { lawShortName: string }) {
  try {
    const stats = await getLawStats(lawShortName)

    if (!stats.hasQuestions) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h3 className="text-red-800 font-bold mb-2">⚠️ Ley no disponible</h3>
          <p className="text-red-600">No hay preguntas disponibles para esta ley.</p>
          <Link
            href="/leyes"
            className="inline-block mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Ver todas las leyes
          </Link>
        </div>
      )
    }

    return (
      <div className="flex justify-center mb-8">
        <div className="bg-white rounded-lg p-4 shadow-md text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.totalQuestions}</div>
          <div className="text-gray-600 text-sm">Total Preguntas</div>
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error loading law stats:', error)
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
        <p className="text-yellow-700">Error cargando estadísticas de la ley</p>
      </div>
    )
  }
}

export default async function LawMainPage({ params }: PageProps) {
  const resolvedParams = await params
  const resolved = await resolveLaw(resolvedParams.law)

  if (!resolved) {
    console.warn('⚠️ Ley no reconocida:', resolvedParams.law)
    notFound()
  }

  const { lawShortName, lawInfo } = resolved
  const canonicalSlug = await getCanonicalSlugAsync(lawShortName)
  const isCanonical = resolvedParams.law === canonicalSlug

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <ClientBreadcrumbsWrapper />
      <div className="container mx-auto px-4 py-12">

        {!isCanonical && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 text-center">
            <p className="text-blue-700">
              💡 Esta página también está disponible en:
              <Link
                href={`/leyes/${canonicalSlug}`}
                className="ml-2 font-semibold text-blue-800 hover:underline"
              >
                /leyes/{canonicalSlug}
              </Link>
            </p>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-12">
          <div className="mb-4">
            <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-semibold">
              📚 TEST {lawShortName}
            </span>
          </div>
          <p className="text-xl text-gray-600 mb-6">
            {lawInfo.description}
          </p>
        </div>

        {/* TEST PERSONALIZADO DE LA LEY */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white">
              <div className="text-center">
                <div className="text-3xl mb-2">🎯</div>
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 leading-tight">Test {lawShortName}</h3>
                <p className="text-blue-100">Configura tu test personalizado</p>
              </div>
            </div>
            <div className="p-6">
              <Suspense fallback={
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              }>
                <LawTestConfigurator lawShortName={lawShortName} lawDisplayName={lawInfo.name} />
              </Suspense>
            </div>
          </div>
        </div>

        {/* Navegación adicional */}
        <div className="text-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <Link
              href={`/teoria/${canonicalSlug}`}
              className="bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium text-center hover:bg-gray-200 transition-colors"
            >
              📖 Ver Teoría
            </Link>
            <Link
              href="/leyes"
              className="bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium text-center hover:bg-gray-200 transition-colors"
            >
              📚 Ver más leyes
            </Link>
          </div>
        </div>

        {/* Información adicional */}
        <div className="mt-16 bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
            📋 Información sobre {lawInfo.name}
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-3">¿Qué incluye este test?</h3>
              <ul className="text-gray-600 space-y-2">
                <li className="flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  Preguntas actualizadas de {lawShortName}
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  Explicaciones detalladas con artículos
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  Casos prácticos y jurisprudencia
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  Preguntas de exámenes oficiales
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-3">¿Para quién es útil?</h3>
              <ul className="text-gray-600 space-y-2">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  Opositores y estudiantes de derecho
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  Profesionales del sector público
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  Abogados y asesores jurídicos
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  Cualquiera que estudie legislación española
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Contenido completo de la ley */}
        <div className="mt-12">
          <Suspense fallback={
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando artículos de la ley...</p>
            </div>
          }>
            <LawArticlesClient params={Promise.resolve({law: resolvedParams.law})} searchParams={Promise.resolve({})} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
