// app/auxiliar-administrativo-madrid/test/tema/[numero]/test-personalizado/page.tsx
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import TestPageWrapper from '../../../../../../components/TestPageWrapper'

interface ContentProps {
  params: Promise<{ numero: string }>
}

function TestPersonalizadoContent({ params }: ContentProps) {
  const searchParams = useSearchParams()
  const [resolvedParams, setResolvedParams] = useState<{ numero: string } | null>(null)
  const [temaNumber, setTemaNumber] = useState<number | null>(null)
  const [failedQuestionIds, setFailedQuestionIds] = useState<string[] | null>(null)

  useEffect(() => {
    async function resolveParams() {
      const resolved = await params
      const tema = parseInt(resolved.numero)

      setResolvedParams(resolved)
      setTemaNumber(tema)

      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 Test personalizado Aux. Madrid tema:', tema)
        console.log('📋 Parámetros URL:', Object.fromEntries(searchParams.entries()))
      }
    }

    resolveParams()
  }, [params, searchParams])

  // ✅ LEER failedQuestionIds de sessionStorage (una sola vez, en client)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('pendingFailedQuestionIds')
      if (stored) {
        sessionStorage.removeItem('pendingFailedQuestionIds')
        setFailedQuestionIds(JSON.parse(stored))
        console.log('📋 failedQuestionIds leídos de sessionStorage:', JSON.parse(stored).length, 'preguntas')
      }
    } catch (e) {
      console.warn('Error leyendo failedQuestionIds:', e)
    }
  }, [])

  const selectedLawsParam = searchParams.get('selected_laws')
  const selectedArticlesByLawParam = searchParams.get('selected_articles_by_law')
  const selectedSectionFiltersParam = searchParams.get('selected_section_filters')

  let selectedLaws: string[] = []
  let selectedArticlesByLaw: Record<string, string[]> = {}
  let selectedSectionFilters: { title: string }[] = []

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
    numQuestions: parseInt(searchParams.get('n') || '10'),
    excludeRecent: searchParams.get('exclude_recent') === 'true',
    recentDays: parseInt(searchParams.get('recent_days') || '15'),
    difficultyMode: searchParams.get('difficulty_mode') || 'random',
    onlyOfficialQuestions: searchParams.get('only_official') === 'true',
    focusEssentialArticles: searchParams.get('focus_essential') === 'true',
    focusWeakAreas: searchParams.get('focus_weak') === 'true',
    onlyFailedQuestions: searchParams.get('only_failed') === 'true',
    failedQuestionIds,
    failedQuestionsOrder: searchParams.get('failed_questions_order') || null,
    timeLimit: searchParams.get('time_limit') ? parseInt(searchParams.get('time_limit')!) : null,
    selectedLaws,
    selectedArticlesByLaw,
    selectedSectionFilters,
    positionType: 'auxiliar_administrativo_madrid'
  }

  const isOnlyFailed = searchParams.get('only_failed') === 'true'
  if (!temaNumber || (isOnlyFailed && failedQuestionIds === null)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Preparando test personalizado...</p>
        </div>
      </div>
    )
  }

  // Madrid: 21 temas (1-21)
  if (isNaN(temaNumber) || temaNumber < 1 || temaNumber > 21) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Tema No Válido
          </h1>
          <p className="text-gray-600 mb-6">
            El Tema {temaNumber} no es válido para Auxiliar Administrativo Comunidad de Madrid. Debe ser del 1 al 21.
          </p>
          <a
            href="/auxiliar-administrativo-madrid/test"
            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            ← Volver a todos los temas
          </a>
        </div>
      </div>
    )
  }

  const getBloque = (num: number) => {
    if (num >= 1 && num <= 15) return 'Bloque I'
    if (num >= 16 && num <= 21) return 'Bloque II'
    return ''
  }

  const bloqueInfo = ` (${getBloque(temaNumber)})`

  return (
    <TestPageWrapper
      testType="personalizado"
      tema={temaNumber}
      defaultConfig={testConfig}
      customTitle={`Test Personalizado - Tema ${temaNumber}${bloqueInfo}`}
      customDescription={`Test personalizado con ${testConfig.numQuestions} preguntas`}
      customSubtitle=""
      customIcon="✨"
      customColor="from-red-600 to-red-700"
      positionType="auxiliar_administrativo_madrid"
      loadingMessage="Cargando preguntas..."
      errorMessage="Error al cargar las preguntas"
    />
  )
}

export default function TestPersonalizadoPage({ params }: ContentProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Cargando test personalizado...</p>
        </div>
      </div>
    }>
      <TestPersonalizadoContent params={params} />
    </Suspense>
  )
}
