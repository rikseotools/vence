// components/test/TestPersonalizadoPage.tsx - Componente compartido para test personalizado
// Reemplaza las 17 copias de app/[oposicion]/test/tema/[numero]/test-personalizado/page.js
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import TestPageWrapper from '@/components/TestPageWrapper'
import { getOposicion } from '@/lib/config/oposiciones'

interface TestPersonalizadoPageProps {
  oposicionSlug: string
  params: Promise<{ numero: string }>
}

function TestPersonalizadoContent({ oposicionSlug, params }: TestPersonalizadoPageProps) {
  const searchParams = useSearchParams()
  const [temaNumber, setTemaNumber] = useState<number | null>(null)
  const [failedQuestionIds, setFailedQuestionIds] = useState<string[] | null>(null)

  const config = getOposicion(oposicionSlug)
  const basePath = `/${oposicionSlug}`
  const positionType = config?.positionType || 'auxiliar_administrativo'

  // Resolve params
  useEffect(() => {
    async function resolveParams() {
      const resolved = await params
      setTemaNumber(parseInt(resolved.numero))
    }
    resolveParams()
  }, [params])

  // Read failedQuestionIds from sessionStorage (once, on client)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('pendingFailedQuestionIds')
      if (stored) {
        sessionStorage.removeItem('pendingFailedQuestionIds')
        setFailedQuestionIds(JSON.parse(stored))
      }
    } catch (e) {
      console.warn('Error leyendo failedQuestionIds:', e)
    }
  }, [])

  // Parse URL config
  const selectedLawsParam = searchParams.get('selected_laws')
  const selectedArticlesByLawParam = searchParams.get('selected_articles_by_law')
  const selectedSectionFiltersParam = searchParams.get('selected_section_filters')

  let selectedLaws: string[] = []
  let selectedArticlesByLaw: Record<string, any> = {}
  let selectedSectionFilters: any[] = []

  try {
    selectedLaws = selectedLawsParam ? JSON.parse(selectedLawsParam) : []
    selectedArticlesByLaw = selectedArticlesByLawParam ? JSON.parse(selectedArticlesByLawParam) : {}
    selectedSectionFilters = selectedSectionFiltersParam ? JSON.parse(selectedSectionFiltersParam) : []
  } catch (error) {
    console.error('Error parsing URL params:', error)
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
  }

  // Validate tema
  const isValidTema = (tema: number): boolean => {
    if (!config) return false
    for (const block of config.blocks) {
      for (const theme of block.themes) {
        if (theme.id === tema) return true
      }
    }
    return false
  }

  // Wait for tema + failedQuestionIds if only_failed
  const isOnlyFailed = searchParams.get('only_failed') === 'true'
  if (!temaNumber || (isOnlyFailed && failedQuestionIds === null)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Preparando test personalizado...</p>
        </div>
      </div>
    )
  }

  if (isNaN(temaNumber) || !isValidTema(temaNumber)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">{'❌'}</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Tema No Valido</h1>
          <p className="text-gray-600 mb-6">
            El Tema {temaNumber} no es valido para {config?.shortName || 'esta oposicion'}.
          </p>
          <a href={`${basePath}/test`} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Volver a todos los temas
          </a>
        </div>
      </div>
    )
  }

  // Display number (some oposiciones have displayNumber different from id)
  const theme = config?.blocks.flatMap(b => b.themes).find(t => t.id === temaNumber)
  const displayNumber = theme?.displayNumber || temaNumber
  const blockTitle = config?.blocks.find(b => b.themes.some(t => t.id === temaNumber))?.title?.split(':')[0] || ''

  return (
    <TestPageWrapper
      testType="personalizado"
      tema={temaNumber}
      defaultConfig={testConfig}
      positionType={positionType}
      customTitle={`Test Personalizado - Tema ${displayNumber} ${blockTitle ? `(${blockTitle})` : ''}`}
      customDescription={`Test personalizado con ${testConfig.numQuestions} preguntas`}
      customIcon="✨"
      customColor="from-blue-600 to-blue-700"
    />
  )
}

export default function TestPersonalizadoPage({ oposicionSlug, params }: TestPersonalizadoPageProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Cargando test personalizado...</p>
        </div>
      </div>
    }>
      <TestPersonalizadoContent oposicionSlug={oposicionSlug} params={params} />
    </Suspense>
  )
}
