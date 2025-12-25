// app/administrativo-estado/test/tema/[numero]/test-personalizado/page.js
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import TestPageWrapper from '../../../../../../components/TestPageWrapper'

function TestPersonalizadoContent({ params }) {
  const searchParams = useSearchParams()
  const [resolvedParams, setResolvedParams] = useState(null)
  const [temaNumber, setTemaNumber] = useState(null)

  // Resolver params async
  useEffect(() => {
    async function resolveParams() {
      const resolved = await params
      const tema = parseInt(resolved.numero)

      setResolvedParams(resolved)
      setTemaNumber(tema)

      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 Test personalizado tema administrativo:', tema)
        console.log('📋 Parámetros URL:', Object.fromEntries(searchParams.entries()))
      }
    }

    resolveParams()
  }, [params, searchParams])

  // Extraer configuración de la URL
  const selectedLawsParam = searchParams.get('selected_laws')
  const selectedArticlesByLawParam = searchParams.get('selected_articles_by_law')

  let selectedLaws = []
  let selectedArticlesByLaw = {}

  try {
    selectedLaws = selectedLawsParam ? JSON.parse(selectedLawsParam) : []
    selectedArticlesByLaw = selectedArticlesByLawParam ? JSON.parse(selectedArticlesByLawParam) : {}
  } catch (error) {
    console.error('Error parsing URL params:', error)
  }

  const testConfig = {
    numQuestions: parseInt(searchParams.get('n')) || 10,
    excludeRecent: searchParams.get('exclude_recent') === 'true',
    recentDays: parseInt(searchParams.get('recent_days')) || 15,
    difficultyMode: searchParams.get('difficulty_mode') || 'random',
    onlyOfficialQuestions: searchParams.get('only_official') === 'true',
    focusEssentialArticles: searchParams.get('focus_essential') === 'true',
    focusWeakAreas: searchParams.get('focus_weak') === 'true',
    onlyFailedQuestions: searchParams.get('only_failed') === 'true',
    failedQuestionIds: searchParams.get('failed_question_ids') ? JSON.parse(searchParams.get('failed_question_ids')) : null,
    failedQuestionsOrder: searchParams.get('failed_questions_order') || null,
    timeLimit: searchParams.get('time_limit') ? parseInt(searchParams.get('time_limit')) : null,
    selectedLaws,
    selectedArticlesByLaw,
    positionType: 'administrativo' // Importante: indicar el tipo de oposición
  }

  // Loading state
  if (!temaNumber) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Preparando test personalizado...</p>
        </div>
      </div>
    )
  }

  // Validar tema (Administrativo tiene 45 temas)
  if (isNaN(temaNumber) || temaNumber < 1 || temaNumber > 45) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Tema No Válido
          </h1>
          <p className="text-gray-600 mb-6">
            El Tema {temaNumber} no es válido para Administrativo del Estado (C1).
          </p>
          <a
            href="/administrativo-estado/test"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Volver a todos los temas
          </a>
        </div>
      </div>
    )
  }

  // Obtener bloque según tema
  const getBloque = (num) => {
    if (num <= 11) return 'Bloque I'
    if (num <= 15) return 'Bloque II'
    if (num <= 22) return 'Bloque III'
    if (num <= 31) return 'Bloque IV'
    if (num <= 37) return 'Bloque V'
    return 'Bloque VI'
  }

  return (
    <TestPageWrapper
      testType="personalizado"
      tema={temaNumber}
      testConfig={testConfig}
      customTitle={`Test Personalizado - Tema ${temaNumber} (${getBloque(temaNumber)})`}
      customDescription={`Test personalizado con ${testConfig.numQuestions} preguntas`}
      customIcon="✨"
      customColor="from-blue-600 to-blue-700"
      positionType="administrativo"
    />
  )
}

export default function TestPersonalizadoPage({ params }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Cargando test personalizado...</p>
        </div>
      </div>
    }>
      <TestPersonalizadoContent params={params} />
    </Suspense>
  )
}
