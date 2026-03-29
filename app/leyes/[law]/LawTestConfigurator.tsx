'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import TestConfigurator from '@/components/TestConfigurator'
import { getLawStats, type LawStats } from '@/lib/lawFetchers'
import { useAuth } from '@/contexts/AuthContext'
import { useLawSlugs } from '@/contexts/LawSlugContext'

interface LawTestConfiguratorProps {
  lawShortName: string
  lawDisplayName: string
}

export default function LawTestConfigurator({ lawShortName, lawDisplayName }: LawTestConfiguratorProps) {
  const { getSlug: getCanonicalSlug } = useLawSlugs()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [lawStats, setLawStats] = useState<LawStats | null>(null)
  const searchParams = useSearchParams()
  const selectedArticlesParam = searchParams.get('selected_articles')
  const sourceParam = searchParams.get('source')

  useEffect(() => {
    async function loadData() {
      try {
        const stats = await getLawStats(lawShortName)
        setLawStats(stats)
        if (!stats || stats.totalQuestions === 0) {
          setLoadError(true)
        }
      } catch (error) {
        console.error('Error loading law data:', error)
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [lawShortName])

  // Si hay artículos preseleccionados en la URL, iniciar el test automáticamente
  useEffect(() => {
    if (selectedArticlesParam && !loading && lawStats) {
      console.log('🎯 Auto-starting test with selected articles:', selectedArticlesParam)
      const canonicalSlug = getCanonicalSlug(lawShortName)
      const params = new URLSearchParams({
        n: '50', // Pedir muchas, el sistema devolverá las disponibles
        selected_articles: selectedArticlesParam,
        ...(sourceParam && { source: sourceParam })
      })
      window.location.href = `/leyes/${canonicalSlug}/avanzado?${params.toString()}`
    }
  }, [selectedArticlesParam, sourceParam, loading, lawStats, lawShortName])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 dark:text-gray-400 text-sm">Preparando test de {lawDisplayName}...</p>
      </div>
    )
  }

  if (loadError || !lawStats || lawStats.totalQuestions === 0) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-6 text-center">
        <p className="text-amber-800 dark:text-amber-200 font-medium">
          No hay preguntas disponibles para {lawDisplayName}
        </p>
        <p className="text-amber-600 dark:text-amber-400 text-sm mt-2">
          Estamos preparando el contenido. Prueba con otra ley o vuelve pronto.
        </p>
      </div>
    )
  }

  // Preparar datos para TestConfigurator
  const lawsData = [{
    law_short_name: lawShortName,
    display_name: lawDisplayName,
    total_articles: lawStats?.totalQuestions || 0,
    questions_count: lawStats?.totalQuestions || 0,
    articles_with_questions: lawStats?.totalQuestions || 0,
  }]

  const difficultyStats = {
    total: lawStats?.totalQuestions || 0,
    easy: Math.floor((lawStats?.totalQuestions || 0) * 0.3),
    medium: Math.floor((lawStats?.totalQuestions || 0) * 0.5),
    hard: Math.floor((lawStats?.totalQuestions || 0) * 0.2),
    // También mantener las versiones en español por compatibilidad
    facil: Math.floor((lawStats?.totalQuestions || 0) * 0.3),
    medio: Math.floor((lawStats?.totalQuestions || 0) * 0.5),
    dificil: Math.floor((lawStats?.totalQuestions || 0) * 0.2)
  }

  // Debug log
  console.log('🔍 TestConfiguratorWrapper Debug:', {
    lawShortName,
    lawDisplayName,
    lawStats,
    difficultyStats,
    lawsData
  })

  // Validar que hay preguntas disponibles
  if (!lawStats || !lawStats.totalQuestions || isNaN(lawStats.totalQuestions)) {
    return (
      <div className="text-center p-8">
        <div className="text-5xl mb-4">📚</div>
        <h3 className="text-xl font-bold text-gray-700 mb-2">Esta ley aún no tiene preguntas de test</h3>
        <p className="text-gray-500 mb-4">Estamos trabajando en añadir preguntas para {lawShortName}.</p>
        <p className="text-sm text-gray-400">Mientras tanto puedes consultar la teoría de esta ley.</p>
      </div>
    )
  }

  return (
    <div>
      {/* TestConfigurator con ley preseleccionada */}
      <div className="law-test-configurator">
        <style jsx global>{`
          .law-test-configurator [data-testid="official-questions"],
          .law-test-configurator [data-testid="essential-articles"],
          .law-test-configurator label:has(span:contains("🏛️")),
          .law-test-configurator label:has(span:contains("⭐")),
          .law-test-configurator div:has(span:contains("🏛️")),
          .law-test-configurator div:has(span:contains("⭐")),
          .law-test-configurator *:has(> span:contains("🏛️")),
          .law-test-configurator *:has(> span:contains("⭐")),
          .law-test-configurator *:has(> *:contains("Preguntas oficiales")),
          .law-test-configurator *:has(> *:contains("artículos imprescindibles")) {
            display: none !important;
          }
        `}</style>
        <TestConfigurator
          tema={null} // Explícitamente null para que use lawsData
          totalQuestions={difficultyStats}
          userStats={difficultyStats as any}
          loading={false}
          currentUser={user}
          lawsData={lawsData}
          preselectedLaw={lawShortName}
          hideOfficialQuestions={true}
          hideEssentialArticles={true}
          onStartTest={(config) => {
            console.log('Starting law test with config:', config)
            
            // Construir parámetros para el test de ley
            const params = new URLSearchParams({
              n: config.numQuestions.toString(),
              exclude_recent: config.excludeRecent.toString(),
              recent_days: config.recentDays.toString(),
              difficulty_mode: config.difficultyMode,
              ...(config.adaptiveMode && { adaptive: 'true' }),
              ...(config.timeLimit && { time_limit: config.timeLimit.toString() }),
              ...(config.onlyFailedQuestions && { only_failed: 'true' }),
              ...(config.failedQuestionIds && { failed_ids: config.failedQuestionIds.join(',') }),
              ...(config.failedQuestionsOrder && { failed_order: config.failedQuestionsOrder }),
              // 🆕 FILTRO DE SECCIONES/TÍTULOS (MULTI-SELECT)
              ...(config.selectedSectionFilters && config.selectedSectionFilters.length > 0 && {
                section_filters: JSON.stringify(config.selectedSectionFilters)
              }),
              // 🆕 FILTRO DE ARTÍCULOS ESPECÍFICOS
              ...(config.selectedArticlesByLaw && config.selectedArticlesByLaw[lawShortName] && config.selectedArticlesByLaw[lawShortName].length > 0 && {
                selected_articles: config.selectedArticlesByLaw[lawShortName].join(',')
              })
            })
            
            // Navegar al test avanzado de la ley (equivale a test personalizado)
            const canonicalSlug = getCanonicalSlug(lawShortName)
            const testUrl = `/leyes/${canonicalSlug}/avanzado?${params.toString()}`
            console.log('🎯 Navegando a:', testUrl)
            window.location.href = testUrl
          }}
        />
      </div>
    </div>
  )
}