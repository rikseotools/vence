
// app/test/multi-ley/page.tsx - Página de test con múltiples leyes seleccionadas
// Usa la API /api/questions/filtered para obtener preguntas de varias leyes
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import TestLayout from '@/components/TestLayout'
import { useAuth } from '@/contexts/AuthContext'

// Tipos
interface Question {
  id: string
  question_text: string
  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  options: [string, string, string, string]
  correct_option?: number
  explanation?: string
  primary_article_id?: string
  is_official_exam?: boolean
  exam_source?: string
  difficulty?: string
  article?: {
    id: string
    number: string
    law_short_name: string
    law_name: string
    title: string | null
    full_text: string | null
  }
  articles?: {
    id: string
    article_number: string
    title: string | null
    content: string | null
    laws: {
      short_name: string
      name: string
    }
  }
  [key: string]: unknown
}

interface FilteredQuestionResponse {
  id: string
  question: string
  options: [string, string, string, string]
  explanation: string
  primary_article_id: string
  tema: number | null
  article: {
    id: string
    number: string
    title: string | null
    full_text: string | null
    law_name: string
    law_short_name: string
    display_number: string
  }
  metadata: {
    id: string
    difficulty: string
    question_type: string
    tags: string[] | null
    is_active: boolean
    created_at: string | null
    updated_at: string | null
    is_official_exam: boolean | null
    exam_source: string | null
    exam_date: string | null
    exam_entity: string | null
    exam_position: string | null
    official_difficulty_level: string | null
  }
}

// Transformar respuesta de API al formato que espera TestLayout
function transformApiResponse(apiQuestions: FilteredQuestionResponse[]): Question[] {
  return apiQuestions.map(q => ({
    id: q.id,
    question: q.question,
    question_text: q.question,
    option_a: q.options[0],
    option_b: q.options[1],
    option_c: q.options[2],
    option_d: q.options[3],
    options: q.options,
    explanation: q.explanation,
    primary_article_id: q.primary_article_id,
    is_official_exam: q.metadata.is_official_exam ?? undefined,
    exam_source: q.metadata.exam_source ?? undefined,
    difficulty: q.metadata.difficulty,
    article: {
      id: q.article.id,
      number: q.article.number,
      law_short_name: q.article.law_short_name,
      law_name: q.article.law_name,
      title: q.article.title,
      full_text: q.article.full_text,
    },
    articles: {
      id: q.article.id,
      article_number: q.article.number,
      title: q.article.title,
      content: q.article.full_text,
      laws: {
        short_name: q.article.law_short_name,
        name: q.article.law_name,
      }
    }
  }))
}

function MultiLeyTestContent() {
  const { user, loading: authLoading } = useAuth() as {
    user: { id: string; email?: string } | null
    loading: boolean
  }
  const searchParams = useSearchParams()

  // Estados
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Parsear parámetros de la URL
  const numQuestions = parseInt(searchParams?.get('n') || '25')
  const difficultyMode = searchParams?.get('difficulty_mode') || 'random'
  const excludeRecent = searchParams?.get('exclude_recent') === 'true'
  const recentDays = parseInt(searchParams?.get('recent_days') || '30')
  const adaptiveMode = searchParams?.get('adaptive') === 'true'
  const timeLimitParam = searchParams?.get('time_limit')
  const timeLimit = timeLimitParam ? parseInt(timeLimitParam) : null
  const onlyOfficialQuestions = searchParams?.get('only_official') === 'true'
  const focusEssentialArticles = searchParams?.get('focus_essential') === 'true'
  const onlyFailedQuestions = searchParams?.get('only_failed') === 'true'

  // Parsear leyes seleccionadas
  const lawsParam = searchParams?.get('laws')
  const selectedLaws = lawsParam ? lawsParam.split(',') : []

  // Parsear artículos por ley (formato: "CE:1|2|3;Ley 39/2015:4|5")
  const articlesParam = searchParams?.get('articles')
  const selectedArticlesByLaw: Record<string, string[]> = {}
  if (articlesParam) {
    articlesParam.split(';').forEach(lawPart => {
      const [law, articles] = lawPart.split(':')
      if (law && articles) {
        selectedArticlesByLaw[law] = articles.split('|')
      }
    })
  }

  // Cargar preguntas
  useEffect(() => {
    async function loadQuestions() {
      // Si no hay leyes seleccionadas, mostrar error
      if (selectedLaws.length === 0) {
        setError('No se seleccionaron leyes para el test')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        console.log('📚 [MultiLey] Cargando preguntas:', {
          selectedLaws,
          selectedArticlesByLaw,
          numQuestions,
          difficultyMode
        })

        // Convertir artículos de strings a números para la API
        const articlesAsNumbers: Record<string, number[]> = {}
        for (const [law, articles] of Object.entries(selectedArticlesByLaw)) {
          articlesAsNumbers[law] = articles.map(a => parseInt(a, 10)).filter(n => !isNaN(n))
        }

        // Llamar a la API de preguntas filtradas
        const response = await fetch('/api/questions/filtered', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topicNumber: 0,
            positionType: 'auxiliar_administrativo',
            selectedLaws,
            selectedArticlesByLaw: Object.keys(articlesAsNumbers).length > 0
              ? articlesAsNumbers
              : {},
            numQuestions,
            difficultyMode,
            excludeRecentDays: excludeRecent ? recentDays : 0,
            onlyOfficialQuestions,
            focusEssentialArticles,
            onlyFailedQuestions,
            userId: user?.id
          })
        })

        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || 'Error obteniendo preguntas')
        }

        if (!result.questions || result.questions.length === 0) {
          throw new Error('No se encontraron preguntas con los filtros seleccionados')
        }

        // Transformar al formato que espera TestLayout
        const transformedQuestions = transformApiResponse(result.questions)

        console.log('✅ [MultiLey] Preguntas cargadas:', transformedQuestions.length)
        setQuestions(transformedQuestions)

      } catch (err) {
        console.error('❌ [MultiLey] Error:', err)
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }

    // Esperar a que se resuelva auth antes de cargar
    if (!authLoading) {
      loadQuestions()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, selectedLaws.join(','), JSON.stringify(selectedArticlesByLaw), numQuestions, difficultyMode, excludeRecent, recentDays, onlyOfficialQuestions, focusEssentialArticles, onlyFailedQuestions])

  // Estado de carga
  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Preparando test multi-ley...</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            {selectedLaws.length} ley{selectedLaws.length !== 1 ? 'es' : ''} seleccionada{selectedLaws.length !== 1 ? 's' : ''}
          </p>
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
            Error al cargar test
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/test/por-leyes"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Volver al configurador
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Sin preguntas (pero no error)
  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          <div className="text-6xl mb-4">📚</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            Sin preguntas disponibles
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            No se encontraron preguntas con los filtros seleccionados.
            Intenta ampliar tu selección de leyes o artículos.
          </p>
          <Link
            href="/test/por-leyes"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-block"
          >
            Volver al configurador
          </Link>
        </div>
      </div>
    )
  }

  // Generar título descriptivo
  const lawsList = selectedLaws.slice(0, 3).join(', ')
  const lawsSuffix = selectedLaws.length > 3 ? ` y ${selectedLaws.length - 3} más` : ''
  const testTitle = `Test Multi-Ley: ${lawsList}${lawsSuffix}`

  // Configuración para TestLayout
  const config = {
    name: testTitle,
    description: `${questions.length} preguntas de ${selectedLaws.length} ley${selectedLaws.length !== 1 ? 'es' : ''}`,
    color: 'from-purple-500 to-indigo-600',
    icon: '📚',
    subtitle: `${selectedLaws.length} leyes combinadas`,
    tema: 0,
    isMultiLawTest: true,
    selectedLaws,
    numQuestions: questions.length,
    customNavigationLinks: {
      backToTests: {
        href: '/test/por-leyes',
        label: '⚙️ Volver al configurador',
        isPrimary: true
      },
      backToLaws: {
        href: '/leyes',
        label: '📚 Ver leyes',
        isPrimary: false
      }
    }
  }

  return (
    <TestLayout
      tema={0}
      testNumber={1}
      config={config}
      questions={questions}
      children={null}
    />
  )
}

export default function MultiLeyTestPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando test...</p>
        </div>
      </div>
    }>
      <MultiLeyTestContent />
    </Suspense>
  )
}
