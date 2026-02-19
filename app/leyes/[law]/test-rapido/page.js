// app/leyes/[law]/test-rapido/page.js - NO INDEXABLE (Solo página principal se indexa)
import { Suspense } from 'react'
import Head from 'next/head'
import LawTestPageWrapper from '@/components/LawTestPageWrapper'
import { mapLawSlugToShortName, getLawInfo, getAllLawSlugs } from '@/lib/lawMappingUtils'

// ❌ NO METADATA - Esta página NO se debe indexar
// Solo la página principal /leyes/[law]/ debe aparecer en buscadores

// 🎯 GENERAR RUTAS ESTÁTICAS (auto-generado desde lawMappingUtils)
export async function generateStaticParams() {
  return getAllLawSlugs().map(slug => ({ law: slug }))
}

export default async function TestRapidoLeyPage({ params, searchParams }) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  
  const lawInfo = getLawInfo(resolvedParams.law)
  const lawShortName = mapLawSlugToShortName(resolvedParams.law)
  
  return (
    <>
      {/* ✅ NO INDEXAR - Solo la página principal se indexa */}
      <Head>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
        <title>Test Rápido {lawInfo.name}</title>
      </Head>
      
      <Suspense fallback={
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-3"></div>
            <p className="text-gray-600">⚡ Preparando test rápido de {lawInfo.name}...</p>
          </div>
        </div>
      }>
        <LawTestPageWrapper
          lawShortName={lawShortName}
          lawSlug={resolvedParams.law}
          testType="rapido"
          customTitle={`Test Rápido: ${lawInfo.name}`}
          customDescription={`10 preguntas aleatorias de ${lawShortName}`}
          customIcon="⚡"
          customColor="from-green-500 to-emerald-600"
          customSubtitle={`Práctica rápida en 5 minutos - ${lawInfo.description}`}
          defaultConfig={{
            numQuestions: parseInt(resolvedSearchParams.n) || 10,
            timeLimit: 300, // 5 minutos
            difficulty: 'mixed',
            testType: 'rapido'
          }}
          loadingMessage={`⚡ Preparando test rápido de ${lawInfo.name}...`}
          errorMessage={`No hay preguntas disponibles para ${lawInfo.name}. Prueba con otra ley.`}
        />
      </Suspense>
    </>
  )
}