// app/test/configurar/page.tsx - Página de configuración de test multi-ley con favoritos
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TestConfigurator from '@/components/TestConfigurator'
import { useAuth } from '@/contexts/AuthContext'
import type { LawData } from '@/lib/api/laws-configurator'

function TestConfiguradorContent() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth() as {
    user: { id: string; email?: string } | null
    loading: boolean
  }
  const [lawsData, setLawsData] = useState<Array<{
    law_short_name: string
    display_name: string
    total_articles: number
    questions_count: number
    articles_with_questions: number
  }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Cargar todas las leyes disponibles
  useEffect(() => {
    async function loadAllLaws() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/laws-configurator')
        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || 'Error cargando leyes')
        }

        // Transformar datos de camelCase a snake_case para TestConfigurator
        const transformedData = (result.data as LawData[]).map(law => ({
          law_short_name: law.lawShortName,
          display_name: law.lawName,
          total_articles: law.articlesWithQuestions,
          questions_count: law.totalQuestions,
          articles_with_questions: law.articlesWithQuestions
        }))

        console.log('📚 [Configurar] Leyes cargadas:', transformedData.length)
        setLawsData(transformedData)

      } catch (err) {
        console.error('❌ [Configurar] Error:', err)
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }

    loadAllLaws()
  }, [])

  // Calcular total de preguntas disponibles
  const totalQuestionsAvailable = lawsData.reduce((sum, law) => sum + law.questions_count, 0)

  // Manejar inicio del test
  const handleStartTest = (config: {
    tema?: number | null
    numQuestions: number
    excludeRecent?: boolean
    recentDays?: number
    difficultyMode: string
    adaptiveMode?: boolean
    timeLimit?: number | null
    onlyFailedQuestions?: boolean
    failedQuestionIds?: string[]
    failedQuestionsOrder?: string
    selectedLaws?: string[]
    selectedArticlesByLaw?: Record<string, (string | number)[]>
    selectedSectionFilters?: Array<{
      law: string
      title: string
      articleRange: { from: number; to: number }
    }>
    onlyOfficialQuestions?: boolean
    focusEssentialArticles?: boolean
  }) => {
    console.log('🚀 [Configurar] Iniciando test con config:', config)

    // Construir parámetros para el test
    const params = new URLSearchParams({
      n: config.numQuestions.toString(),
      difficulty_mode: config.difficultyMode
    })

    // Parámetros opcionales
    if (config.excludeRecent) {
      params.set('exclude_recent', 'true')
      params.set('recent_days', (config.recentDays || 30).toString())
    }

    // Modo adaptativo
    if (config.adaptiveMode) {
      params.set('adaptive', 'true')
    }

    // Límite de tiempo
    if (config.timeLimit) {
      params.set('time_limit', config.timeLimit.toString())
    }

    // Solo preguntas oficiales
    if (config.onlyOfficialQuestions) {
      params.set('only_official', 'true')
    }

    // Artículos imprescindibles
    if (config.focusEssentialArticles) {
      params.set('focus_essential', 'true')
    }

    // Solo preguntas falladas
    if (config.onlyFailedQuestions) {
      params.set('only_failed', 'true')
    }

    // Leyes seleccionadas
    if (config.selectedLaws && config.selectedLaws.length > 0) {
      params.set('laws', config.selectedLaws.join(','))
    }

    // Artículos específicos por ley (formato: "CE:1|2|3;Ley 39/2015:4|5")
    if (config.selectedArticlesByLaw) {
      const articlesConfig = Object.entries(config.selectedArticlesByLaw)
        .filter(([, articles]) => articles && articles.length > 0)
        .map(([law, articles]) => `${law}:${articles.map(a => String(a)).join('|')}`)
        .join(';')

      if (articlesConfig) {
        params.set('articles', articlesConfig)
      }
    }

    // Filtros de sección
    if (config.selectedSectionFilters && config.selectedSectionFilters.length > 0) {
      params.set('section_filters', JSON.stringify(config.selectedSectionFilters))
    }

    // Navegar a la página de test
    router.push(`/test/multi-ley?${params.toString()}`)
  }

  // Estado de carga
  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando leyes disponibles...</p>
        </div>
      </div>
    )
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            Error al cargar
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // Sin leyes disponibles
  if (lawsData.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">📚</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            Sin leyes disponibles
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            No se encontraron leyes con preguntas disponibles.
          </p>
          <Link
            href="/test"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-block"
          >
            Volver a Tests
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded-full text-sm font-semibold inline-flex items-center gap-2">
              ⚙️ Configurador Avanzado
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Test Personalizado Multi-Ley
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
            Selecciona múltiples leyes y artículos para crear tu test ideal.
            {user && (
              <span className="block mt-2 text-blue-600 dark:text-blue-400">
                💾 Puedes guardar tus configuraciones favoritas
              </span>
            )}
          </p>
        </div>

        {/* Estadísticas */}
        <div className="flex justify-center mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md text-center">
            <div className="text-2xl font-bold text-blue-600">{lawsData.length}</div>
            <div className="text-gray-600 dark:text-gray-400 text-sm">Leyes</div>
          </div>
        </div>

        {/* Configurador */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white">
              <div className="text-center">
                <div className="text-3xl mb-2">🎯</div>
                <h2 className="text-xl font-bold mb-2">Configura tu Test</h2>
                <p className="text-blue-100">Combina leyes, artículos y filtros</p>
              </div>
            </div>
            <div className="p-6">
              <TestConfigurator
                tema={null}
                totalQuestions={totalQuestionsAvailable}
                userStats={null}
                loading={false}
                currentUser={user}
                lawsData={lawsData}
                preselectedLaw={null}
                hideOfficialQuestions={false}
                hideEssentialArticles={true}
                testMode="practica"
                positionType="auxiliar_administrativo"
                onStartTest={handleStartTest}
              />
            </div>
          </div>
        </div>

        {/* Info adicional para no autenticados */}
        {!user && (
          <div className="max-w-4xl mx-auto mt-6">
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-center">
              <p className="text-blue-700 dark:text-blue-300">
                💡 <strong>Consejo:</strong>{' '}
                <Link href="/registro" className="underline hover:text-blue-800 dark:hover:text-blue-200">
                  Regístrate gratis
                </Link>{' '}
                para guardar tus configuraciones favoritas y no tener que seleccionar las leyes cada vez.
              </p>
            </div>
          </div>
        )}

        {/* Enlaces de navegación */}
        <div className="max-w-4xl mx-auto mt-8 text-center">
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/test"
              className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              ← Volver a Tests
            </Link>
            <Link
              href="/leyes"
              className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Ver leyes individuales →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TestConfiguradorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando configurador...</p>
        </div>
      </div>
    }>
      <TestConfiguradorContent />
    </Suspense>
  )
}
