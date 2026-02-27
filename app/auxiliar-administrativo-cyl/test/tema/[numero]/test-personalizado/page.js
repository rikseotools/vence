// app/auxiliar-administrativo-cyl/test/tema/[numero]/test-personalizado/page.js
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import TestPageWrapper from '../../../../../../components/TestPageWrapper'

function TestPersonalizadoContent({ params }) {
  const searchParams = useSearchParams()
  const [resolvedParams, setResolvedParams] = useState(null)
  const [temaNumber, setTemaNumber] = useState(null)

  useEffect(() => {
    async function resolveParams() {
      const resolved = await params
      const tema = parseInt(resolved.numero)

      setResolvedParams(resolved)
      setTemaNumber(tema)

      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 Test personalizado Aux. Admin. CyL tema:', tema)
        console.log('📋 Parámetros URL:', Object.fromEntries(searchParams.entries()))
      }
    }

    resolveParams()
  }, [params, searchParams])

  const selectedLawsParam = searchParams.get('selected_laws')
  const selectedArticlesByLawParam = searchParams.get('selected_articles_by_law')
  const selectedSectionFiltersParam = searchParams.get('selected_section_filters')

  let selectedLaws = []
  let selectedArticlesByLaw = {}
  let selectedSectionFilters = []

  try {
    selectedLaws = selectedLawsParam ? JSON.parse(selectedLawsParam) : []
    selectedArticlesByLaw = selectedArticlesByLawParam ? JSON.parse(selectedArticlesByLawParam) : {}
    selectedSectionFilters = selectedSectionFiltersParam ? JSON.parse(selectedSectionFiltersParam) : []

    if (selectedSectionFilters.length > 0) {
      console.log('📚 Filtro de secciones parseado desde URL:', selectedSectionFilters.map(s => s.title))
    }
  } catch (error) {
    console.error('❌ Error parsing URL params:', error)
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
    selectedSectionFilters,
    positionType: 'auxiliar_administrativo_cyl'
  }

  if (!temaNumber) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Preparando test personalizado...</p>
        </div>
      </div>
    )
  }

  // CyL: 28 temas (1-28)
  if (isNaN(temaNumber) || temaNumber < 1 || temaNumber > 28) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Tema No Válido
          </h1>
          <p className="text-gray-600 mb-6">
            El Tema {temaNumber} no es válido para Auxiliar Administrativo Castilla y León. Debe ser del 1 al 28.
          </p>
          <a
            href="/auxiliar-administrativo-cyl/test"
            className="inline-flex items-center px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
          >
            ← Volver a todos los temas
          </a>
        </div>
      </div>
    )
  }

  const getGrupo = (num) => {
    if (num >= 1 && num <= 19) return 'Grupo I'
    if (num >= 20 && num <= 28) return 'Grupo II'
    return ''
  }

  const grupoInfo = ` (${getGrupo(temaNumber)})`

  return (
    <TestPageWrapper
      testType="personalizado"
      tema={temaNumber}
      testConfig={testConfig}
      customTitle={`Test Personalizado - Tema ${temaNumber}${grupoInfo}`}
      customDescription={`Test personalizado con ${testConfig.numQuestions} preguntas`}
      customIcon="✨"
      customColor="from-rose-600 to-rose-700"
      positionType="auxiliar_administrativo_cyl"
    />
  )
}

export default function TestPersonalizadoPage({ params }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Cargando test personalizado...</p>
        </div>
      </div>
    }>
      <TestPersonalizadoContent params={params} />
    </Suspense>
  )
}
