// app/test/articulo/page.tsx
// Test de preguntas de un artículo específico
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import TestLayoutV2 from '@/components/v2/TestLayoutV2'
import type { TestLayoutQuestion, TestConfig } from '@/lib/api/tests'

interface CreateTestResponse {
  success: boolean
  questions?: Array<{
    id: string
    question_text: string
    options: string[]
    explanation: string | null
    difficulty: string | null
    law_name: string
    law_slug: string | null
    law_actual_slug: string | null
    article_number: string | null
    article_title: string | null
    article?: {
      article_number: string | null
      number: string | null
      title: string | null
      full_text: string | null
      content: string | null
      law_short_name: string | null
    } | null
  }>
  questionCount?: number
  message?: string
  error?: string
  testType?: string
}

function transformQuestions(apiQuestions: CreateTestResponse['questions']): TestLayoutQuestion[] {
  if (!apiQuestions) return []

  return apiQuestions.map(q => ({
    id: q.id,
    question: q.question_text,
    question_text: q.question_text,
    options: q.options as [string, string, string, string],
    explanation: q.explanation,
    difficulty: q.difficulty,
    primary_article_id: null,
    article_number: q.article_number,
    article_title: q.article_title,
    law_name: q.law_name,
    law_slug: q.law_slug,
    law_actual_slug: q.law_actual_slug,
    article: q.article ? {
      number: q.article.number || q.article_number,
      article_number: q.article.article_number || q.article_number,
      title: q.article.title || q.article_title,
      full_text: q.article.full_text,
      content: q.article.content,
      law_name: q.law_name,
      law_short_name: q.article.law_short_name || q.law_slug,
    } : null,
  }))
}

function TestArticuloContent() {
  const searchParams = useSearchParams()
  const { user, loading: authLoading, supabase } = useAuth() as {
    user: { id: string } | null
    loading: boolean
    supabase: { auth: { getSession: () => Promise<{ data: { session: { access_token: string } | null } }> } }
  }
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<TestLayoutQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [articleInfo, setArticleInfo] = useState({ articleNumber: '', lawName: '' })

  useEffect(() => {
    async function loadArticleQuestions() {
      if (authLoading) return

      if (!user) {
        setError('Debes iniciar sesión para hacer este test')
        setLoading(false)
        return
      }

      const articleNumber = searchParams.get('article')
      const lawShortName = searchParams.get('law')
      const numQuestions = searchParams.get('n') || '10'

      if (!articleNumber || !lawShortName) {
        setError('Faltan parámetros: article y law son requeridos')
        setLoading(false)
        return
      }

      setArticleInfo({ articleNumber, lawName: lawShortName })

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          setError('Debes iniciar sesión')
          setLoading(false)
          return
        }

        const response = await fetch('/api/ai/create-test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            type: 'article',
            articleNumber,
            lawShortName,
            numQuestions: parseInt(numQuestions)
          })
        })

        const data: CreateTestResponse = await response.json()

        if (!response.ok || !data.success) {
          setError(data.error || data.message || 'Error al cargar las preguntas')
          setLoading(false)
          return
        }

        if (!data.questions || data.questions.length === 0) {
          setError(data.message || `No hay preguntas para el artículo ${articleNumber}`)
          setLoading(false)
          return
        }

        const transformedQuestions = transformQuestions(data.questions)
        setQuestions(transformedQuestions)
        setLoading(false)

      } catch (e) {
        console.error('Error loading article questions:', e)
        setError('Error al cargar las preguntas del artículo')
        setLoading(false)
      }
    }

    loadArticleQuestions()
  }, [user, authLoading, supabase, searchParams])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            Preparando test del artículo...
          </h2>
          <p className="text-gray-600">
            Buscando preguntas del Art. {articleInfo.articleNumber}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg max-w-md">
          <div className="text-6xl mb-4">
            {error.includes('sesión') ? '🔐' : '📄'}
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            {error.includes('sesión') ? 'Inicia sesión' : 'Sin preguntas disponibles'}
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            {error.includes('sesión') ? (
              <a href="/login" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                Iniciar sesión
              </a>
            ) : (
              <a href="/" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                Volver al inicio
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  const testConfig: TestConfig = {
    name: `Test del Art. ${articleInfo.articleNumber}`,
    description: `Practicando ${questions.length} preguntas del artículo`,
    subtitle: articleInfo.lawName,
    icon: "📜",
    color: "from-blue-500 to-indigo-600",
  }

  return (
    <TestLayoutV2
      tema={0}
      testNumber={`articulo_${articleInfo.articleNumber}`}
      config={testConfig}
      questions={questions}
    />
  )
}

export default function TestArticuloPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            Preparando test del artículo...
          </h2>
        </div>
      </div>
    }>
      <TestArticuloContent />
    </Suspense>
  )
}
