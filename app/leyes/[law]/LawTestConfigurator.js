'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import TestConfigurator from '@/components/TestConfigurator'
import { getLawStats } from '@/lib/lawFetchers'
import { useAuth } from '@/contexts/AuthContext'
import { getCanonicalSlug } from '@/lib/lawMappingUtils'

export default function LawTestConfigurator({ lawShortName, lawDisplayName }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [lawStats, setLawStats] = useState(null)
  const searchParams = useSearchParams()
  const selectedArticlesParam = searchParams.get('selected_articles')
  const sourceParam = searchParams.get('source')

  useEffect(() => {
    async function loadData() {
      try {
        const stats = await getLawStats(lawShortName)
        setLawStats(stats)
      } catch (error) {
        console.error('Error loading law data:', error)
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
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    )
  }

  // Preparar datos para TestConfigurator
  const lawsData = [{
    law_short_name: lawShortName,
    display_name: lawDisplayName,
    total_articles: lawStats?.totalQuestions || 0,
    questions_count: lawStats?.totalQuestions || 0
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

  // Validar que no hay NaN
  if (!lawStats || !lawStats.totalQuestions || isNaN(lawStats.totalQuestions)) {
    console.warn('⚠️ LawStats inválidas, usando fallback')
    return (
      <div className="text-center p-8">
        <div className="text-red-600 mb-4">⚠️ No se pudieron cargar las estadísticas de la ley</div>
        <div className="text-sm text-gray-600">Law: {lawShortName}</div>
        <div className="text-sm text-gray-600">Stats: {JSON.stringify(lawStats)}</div>
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
          userStats={difficultyStats}
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