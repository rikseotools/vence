// app/es/leyes/[law]/avanzado/page.js - NO INDEXABLE (Solo página principal se indexa)
import { Suspense } from 'react'
import Head from 'next/head'
import LawTestPageWrapper from '../../../../../components/LawTestPageWrapper'
import { mapLawSlugToShortName, getLawInfo } from '../../../../../lib/lawMappingUtils'

// ❌ NO METADATA - Esta página NO se debe indexar
// Solo la página principal /es/leyes/[law]/ debe aparecer en buscadores

// 🎯 GENERAR RUTAS ESTÁTICAS (para precompilación)
export async function generateStaticParams() {
  return [
    { law: 'ley-19-2013' },
    { law: 'ley-40-2015' }, // Solo canonical, no alias
    { law: 'ley-39-2015' },
    { law: 'constitucion-espanola' }, // Solo canonical, no alias
    { law: 'codigo-civil' },
    { law: 'codigo-penal' },
    { law: 'ley-7-1985' },
    { law: 'estatuto-trabajadores' },
    { law: 'tue' },
    { law: 'tfue' },
    { law: 'gobierno-abierto' },
    { law: 'agenda-2030' },
    { law: 'lo-6-1985' }, // Solo canonical, no alias
    { law: 'ley-50-1981' }
  ]
}

export default async function TestAvanzadoLeyPage({ params, searchParams }) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  
  const lawInfo = getLawInfo(resolvedParams.law)
  const lawShortName = mapLawSlugToShortName(resolvedParams.law)
  const numQuestions = parseInt(resolvedSearchParams.n) || 25
  
  return (
    <>
      {/* ✅ NO INDEXAR - Solo la página principal se indexa */}
      <Head>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
        <title>Test Avanzado {lawInfo.name}</title>
      </Head>
      
      <Suspense fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-600">🎯 Preparando test avanzado de {lawInfo.name}...</p>
          </div>
        </div>
      }>
        <LawTestPageWrapper
          lawShortName={lawShortName}
          testType="avanzado"
          customTitle={`Test Avanzado: ${lawInfo.name}`}
          customDescription={`${numQuestions} preguntas para dominar ${lawShortName}`}
          customIcon="🎯"
          customColor="from-blue-500 to-indigo-600"
          customSubtitle={`Test completo - ${lawInfo.description}`}
          defaultConfig={{
            numQuestions: numQuestions,
            timeLimit: numQuestions * 90, // 1.5 minutos por pregunta
            difficulty: 'mixed',
            testType: 'avanzado'
          }}
          loadingMessage={`🎯 Preparando test avanzado de ${lawInfo.name} (${numQuestions} preguntas)...`}
          errorMessage={`No hay suficientes preguntas disponibles para ${lawInfo.name}. Prueba con menos preguntas o otra ley.`}
        />
      </Suspense>
    </>
  )
}