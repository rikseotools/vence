// app/leyes/[law]/avanzado/page.js - NO INDEXABLE (Solo página principal se indexa)
import { Suspense } from 'react'
import Head from 'next/head'
import LawTestPageWrapper from '@/components/LawTestPageWrapper'
import { resolveLawBySlug, getAllActiveSlugs } from '@/lib/api/laws'

// ❌ NO METADATA - Esta página NO se debe indexar
// Solo la página principal /leyes/[law]/ debe aparecer en buscadores

// 🎯 GENERAR RUTAS ESTÁTICAS (auto-generado desde lawMappingUtils)
export async function generateStaticParams() {
  const slugs = await getAllActiveSlugs()
  return slugs.map(slug => ({ law: slug }))
}

export default async function TestAvanzadoLeyPage({ params, searchParams }) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams

  const law = await resolveLawBySlug(resolvedParams.law)
  const lawInfo = law ? { name: law.name, description: law.description ?? `Test de ${law.shortName}` } : { name: 'Ley', description: '' }
  const lawShortName = law?.shortName ?? resolvedParams.law
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
          lawSlug={resolvedParams.law}
          testType="avanzado"
          customTitle={`Test Avanzado: ${lawInfo.name}`}
          customDescription={`${numQuestions} preguntas para dominar ${lawShortName}`}
          customIcon="🎯"
          customColor="from-blue-500 to-indigo-600"
          customSubtitle={`${numQuestions} preguntas avanzadas de preparación`}
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