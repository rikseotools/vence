// app/es/leyes/[law]/page.js - PÁGINA PRINCIPAL DE CADA LEY CON META CANONICAL
import { Suspense } from 'react'
import Link from 'next/link'
import { mapLawSlugToShortName, getLawInfo, getCanonicalSlug } from '../../../../lib/lawMappingUtils'
import { getLawStats } from '../../../../lib/lawFetchers'
import { notFound } from 'next/navigation'

const SITE_URL = process.env.SITE_URL || 'https://www.ilovetest.pro'

// 🎯 GENERAR METADATA DINÁMICOS CON CANONICAL URL
export async function generateMetadata({ params }) {
  const lawInfo = getLawInfo(params.law)
  const lawShortName = mapLawSlugToShortName(params.law)
  const canonicalSlug = getCanonicalSlug(lawShortName)
  
  return {
    title: `Test ${lawInfo.name} | iLoveTest`,
    description: `Tests completos de ${lawInfo.name}. Modalidades rápida y avanzada. ${lawInfo.description}`,
    keywords: [
      `test ${lawInfo.name.toLowerCase()}`,
      'test leyes gratis',
      'práctica jurídica online',
      'ilovetest'
    ].join(', '),
    
    // 🎯 CANONICAL URL PARA EVITAR CONTENIDO DUPLICADO
    alternates: {
      canonical: `/es/leyes/${canonicalSlug}`
    },
    
    openGraph: {
      title: `Test: ${lawInfo.name} | iLoveTest`,
      description: `Tests completos de ${lawInfo.name} en iLoveTest`,
      type: 'website',
      siteName: 'iLoveTest',
      url: `${SITE_URL}/es/leyes/${canonicalSlug}` // También canonical en OG
    },
    
    // 🔍 ROBOTS: Permitir indexación solo si es URL canonical
    robots: {
      index: params.law === canonicalSlug,
      follow: true
    },
    
    // 📊 Información adicional de la ley
    authors: [{ name: 'iLoveTest' }],
    creator: 'iLoveTest',
    publisher: 'iLoveTest'
  }
}

// 🎯 GENERAR RUTAS ESTÁTICAS
export async function generateStaticParams() {
  return [
    { law: 'ley-19-2013' },
    { law: 'lrjsp' },
    { law: 'lpac' },
    { law: 'ce' },
    { law: 'codigo-civil' },
    { law: 'codigo-penal' },
    { law: 'ley-7-1985' },
    { law: 'estatuto-trabajadores' },
    { law: 'tue' },
    { law: 'tfue' },
    { law: 'gobierno-abierto' },
    { law: 'agenda-2030' },
    
    // 🏛️ TEMA 4 - PODER JUDICIAL - TODAS LAS VARIANTES
    { law: 'lo-6-1985' },           // ← URL canonical
    { law: 'lopj' },                // ← Alias 1
    { law: 'poder-judicial' },      // ← Alias 2
    { law: 'ley-organica-poder-judicial' }, // ← Alias 3
    { law: 'ley-50-1981' },         // ← Ministerio Fiscal canonical
    { law: 'ministerio-fiscal' },   // ← Alias MF 1
    { law: 'estatuto-ministerio-fiscal' }, // ← Alias MF 2
    { law: 'eomf' }                 // ← Alias MF 3
  ]
}

// 🔧 COMPONENTE PARA CARGAR ESTADÍSTICAS
async function LawStatsLoader({ lawShortName }) {
  try {
    const stats = await getLawStats(lawShortName)
    
    if (!stats.hasQuestions) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h3 className="text-red-800 font-bold mb-2">⚠️ Ley no disponible</h3>
          <p className="text-red-600">No hay preguntas disponibles para esta ley.</p>
          <Link 
            href="/es/leyes"
            className="inline-block mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Ver todas las leyes
          </Link>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg p-4 shadow-md text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.totalQuestions}</div>
          <div className="text-gray-600 text-sm">Total Preguntas</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-md text-center">
          <div className="text-2xl font-bold text-green-600">{stats.officialQuestions}</div>
          <div className="text-gray-600 text-sm">Oficiales</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-md text-center">
          <div className="text-2xl font-bold text-purple-600">100%</div>
          <div className="text-gray-600 text-sm">Gratis</div>
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

export default function LawMainPage({ params, searchParams }) {
  const lawInfo = getLawInfo(params.law)
  const lawShortName = mapLawSlugToShortName(params.law)
  const canonicalSlug = getCanonicalSlug(lawShortName)
  
  // Validar que la ley es conocida
  if (!lawShortName) {
    console.warn('⚠️ Ley no reconocida:', params.law)
    notFound()
  }

  // 🎯 VERIFICAR SI ES URL CANONICAL
  const isCanonicalUrl = params.law === canonicalSlug

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-12">
        
        {/* 🎯 AVISO DE URL CANONICAL (opcional para UX) */}
        {!isCanonicalUrl && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 text-center">
            <p className="text-blue-700">
              💡 Esta página también está disponible en: 
              <Link 
                href={`/es/leyes/${canonicalSlug}`}
                className="ml-2 font-semibold text-blue-800 hover:underline"
              >
                /es/leyes/{canonicalSlug}
              </Link>
            </p>
          </div>
        )}


        {/* 🍞 MIGAS DE PAN */}
        <div className="mb-8">
          <nav className="text-sm text-gray-500">
            <Link href="/es/leyes" className="hover:text-gray-700 transition-colors">
              📚 Todas las Leyes
            </Link>
            <span className="mx-2">→</span>
            <span className="text-gray-900 font-medium">
              {lawInfo.name}
            </span>
          </nav>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="mb-4">
            <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-semibold">
              📚 TEST DE LEY
            </span>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Test de {lawInfo.name}
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            {lawInfo.description}
          </p>
        </div>

        {/* Estadísticas */}
        <Suspense fallback={
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-4 shadow-md animate-pulse">
                <div className="h-8 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        }>
          <LawStatsLoader lawShortName={lawShortName} />
        </Suspense>

        {/* 2 MODALIDADES DE TEST */}
        <div className="grid md:grid-cols-2 gap-8 mb-12 max-w-4xl mx-auto">
          
          {/* Test Rápido */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-white">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-2xl font-bold mb-2">Test Rápido</h3>
              <p className="text-green-100">10 preguntas en 5 minutos</p>
            </div>
            <div className="p-8">
              <ul className="text-gray-600 mb-6 space-y-2">
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Perfecto para repasos diarios</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Preguntas variadas y aleatorias</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Ideal para mantener conocimientos</li>
              </ul>
              <Link
                href={`/es/leyes/${canonicalSlug}/test-rapido?n=10`}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 px-6 rounded-lg font-bold text-lg text-center block hover:opacity-90 transition-opacity"
              >
                ⚡ Empezar Test Rápido
              </Link>
            </div>
          </div>

          {/* Test Avanzado */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-8 text-white">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-2xl font-bold mb-2">Test Avanzado</h3>
              <p className="text-blue-100">25 preguntas completas</p>
            </div>
            <div className="p-8">
              <ul className="text-gray-600 mb-6 space-y-2">
                <li className="flex items-center"><span className="text-blue-500 mr-2">✓</span> Evaluación completa y profunda</li>
                <li className="flex items-center"><span className="text-blue-500 mr-2">✓</span> Perfecto para exámenes</li>
                <li className="flex items-center"><span className="text-blue-500 mr-2">✓</span> Incluye preguntas oficiales</li>
              </ul>
              <Link
                href={`/es/leyes/${canonicalSlug}/avanzado?n=25`}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-4 px-6 rounded-lg font-bold text-lg text-center block hover:opacity-90 transition-opacity"
              >
                🎯 Empezar Test Avanzado
              </Link>
            </div>
          </div>
        </div>

        {/* Navegación adicional */}
        <div className="text-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <Link
              href={`/es/teoria/${canonicalSlug}`}
              className="bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium text-center hover:bg-gray-200 transition-colors"
            >
              📖 Ver Teoría
            </Link>
            <Link
              href="/es/leyes"
              className="bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium text-center hover:bg-gray-200 transition-colors"
            >
              📚 Todas las Leyes
            </Link>
            <Link
              href="/es/test/rapido"
              className="bg-yellow-100 text-yellow-800 py-3 px-4 rounded-lg font-medium text-center hover:bg-yellow-200 transition-colors"
            >
              🎲 Test Aleatorio
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
      </div>
    </div>
  )
}