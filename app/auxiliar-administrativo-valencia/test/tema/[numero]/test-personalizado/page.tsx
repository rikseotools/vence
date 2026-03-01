// app/auxiliar-administrativo-valencia/test/tema/[numero]/test-personalizado/page.tsx
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

  useEffect(() => {
    async function resolveParams() {
      const resolved = await params
      const tema = parseInt(resolved.numero)

      setResolvedParams(resolved)
      setTemaNumber(tema)

      if (process.env.NODE_ENV === 'development') {
        console.log('\ud83c\udfaf Test personalizado Aux. Valencia tema:', tema)
        console.log('\ud83d\udccb Parametros URL:', Object.fromEntries(searchParams.entries()))
      }
    }

    resolveParams()
  }, [params, searchParams])

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
      console.log('\ud83d\udcda Filtro de secciones parseado desde URL:', selectedSectionFilters.map(s => s.title))
    }
  } catch (error) {
    console.error('\u274c Error parsing URL params:', error)
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
    failedQuestionIds: searchParams.get('failed_question_ids') ? JSON.parse(searchParams.get('failed_question_ids')!) : null,
    failedQuestionsOrder: searchParams.get('failed_questions_order') || null,
    timeLimit: searchParams.get('time_limit') ? parseInt(searchParams.get('time_limit')!) : null,
    selectedLaws,
    selectedArticlesByLaw,
    selectedSectionFilters,
    positionType: 'auxiliar_administrativo_valencia'
  }

  if (!temaNumber) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Preparando test personalizado...</p>
        </div>
      </div>
    )
  }

  // Valencia: 24 temas (1-24)
  if (isNaN(temaNumber) || temaNumber < 1 || temaNumber > 24) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">{'\u274c'}</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Tema No Valido
          </h1>
          <p className="text-gray-600 mb-6">
            El Tema {temaNumber} no es valido para Auxiliar Administrativo Generalitat Valenciana. Debe ser del 1 al 24.
          </p>
          <a
            href="/auxiliar-administrativo-valencia/test"
            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            {'\u2190'} Volver a todos los temas
          </a>
        </div>
      </div>
    )
  }

  const getBloque = (num: number) => {
    if (num >= 1 && num <= 10) return 'Materias Comunes'
    if (num >= 11 && num <= 24) return 'Materias Especificas'
    return ''
  }

  const bloqueInfo = ` (${getBloque(temaNumber)})`

  return (
    // @ts-expect-error - TestPageWrapper is a JS component; optional props inferred as required
    <TestPageWrapper
      testType="personalizado"
      tema={temaNumber}
      defaultConfig={testConfig}
      customTitle={`Test Personalizado - Tema ${temaNumber}${bloqueInfo}`}
      customDescription={`Test personalizado con ${testConfig.numQuestions} preguntas`}
      customSubtitle=""
      customIcon={'\u2728'}
      customColor="from-red-500 to-red-600"
      positionType="auxiliar_administrativo_valencia"
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
