'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type {
  PsychometricQuestion as ApiQuestion,
  GetPsychometricQuestionsResponse,
} from '@/lib/api/psychometric-test-data/schemas'

const PsychometricTestLayout = dynamic(() => import('@/components/PsychometricTestLayout'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando componente de test...</p>
      </div>
    </div>
  )
})

// snake_case record expected by PsychometricTestLayout
type LayoutQuestion = Record<string, unknown>

function mapApiToLayout(q: ApiQuestion): LayoutQuestion {
  return {
    id: q.id,
    category_id: q.categoryId,
    section_id: q.sectionId,
    question_subtype: q.questionSubtype,
    question_text: q.questionText,
    option_a: q.optionA ?? '',
    option_b: q.optionB ?? '',
    option_c: q.optionC ?? '',
    option_d: q.optionD ?? '',
    content_data: q.contentData,
    difficulty: q.difficulty,
    time_limit_seconds: q.timeLimitSeconds,
    cognitive_skills: q.cognitiveSkills,
    is_official_exam: q.isOfficialExam,
    exam_source: q.examSource,
  }
}

interface ResumeData {
  sessionId: string
  questionsAnswered: number
  correctAnswers: number
  answeredQuestionIds: string[]
}

function MultipleCategoriesPsychometricTestContent() {
  const searchParams = useSearchParams()
  const { loading: authLoading, user } = useAuth() as { loading: boolean; user: { id: string } | null }
  const [questions, setQuestions] = useState<LayoutQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [resumeData, setResumeData] = useState<ResumeData | null>(null)

  useEffect(() => {
    const resumeSessionId = searchParams.get('resume')

    if (resumeSessionId) {
      loadResumeSession(resumeSessionId)
    } else {
      loadNewQuestions()
    }

    async function loadResumeSession(sessionId: string) {
      try {
        const params = new URLSearchParams({ sessionId })
        if (user?.id) params.set('userId', user.id)

        const res = await fetch(`/api/psychometric/resume?${params.toString()}`)
        const data = await res.json()

        if (!data.success) {
          setError(data.error || 'Error al cargar la sesión')
          return
        }

        console.log(`✅ Resumed psychometric session: ${data.questionsAnswered}/${data.totalQuestions} answered`)

        setQuestions(data.questions.map((q: ApiQuestion) => mapApiToLayout(q)))
        setResumeData({
          sessionId: data.sessionId,
          questionsAnswered: data.questionsAnswered,
          correctAnswers: data.correctAnswers,
          answeredQuestionIds: data.answeredQuestionIds,
        })
      } catch (err) {
        console.error('Error resuming psychometric session:', err)
        setError('Error inesperado al reanudar la sesión')
      } finally {
        setLoading(false)
      }
    }

    async function loadNewQuestions() {
      try {
        const categoriesParam = searchParams.get('categories')
        const numQuestionsParam = searchParams.get('numQuestions')
        if (!categoriesParam) {
          setError('No se especificaron categorías')
          return
        }

        const categories = categoriesParam.split(',').filter(Boolean)
        const numQuestions = numQuestionsParam ? parseInt(numQuestionsParam, 10) : 25
        setSelectedCategories(categories)

        console.log('🔍 Loading psychometric questions via API for categories:', categories)

        const params = new URLSearchParams({
          categories: categories.join(','),
          numQuestions: numQuestions.toString(),
        })

        const res = await fetch(`/api/psychometric-test-data/questions?${params.toString()}`)
        const data: GetPsychometricQuestionsResponse = await res.json()

        if (!data.success) {
          console.error('Error loading psychometric questions:', data.error)
          setError(data.error || 'Error al cargar las preguntas')
          return
        }

        if (!data.questions || data.questions.length === 0) {
          setError('No se encontraron preguntas para las categorías seleccionadas')
          return
        }

        console.log(`✅ Loaded ${data.questions.length} psychometric questions (${data.totalAvailable} available)`)

        setQuestions(data.questions.map(mapApiToLayout))
      } catch (err) {
        console.error('Error loading psychometric questions:', err)
        setError('Error inesperado al cargar las preguntas')
      } finally {
        setLoading(false)
      }
    }
  }, [searchParams, authLoading, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando test psicotécnico...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/psicotecnicos/test"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
          >
            Volver a configuración
          </Link>
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Sin preguntas disponibles</h1>
          <p className="text-gray-600 mb-6">No se encontraron preguntas para las categorías seleccionadas</p>
          <Link
            href="/psicotecnicos/test"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
          >
            Configurar nuevo test
          </Link>
        </div>
      </div>
    )
  }

  return (
    <PsychometricTestLayout
      questions={questions as any}
      categoria="múltiples-categorías"
      config={{
        testType: 'psychometric-categories',
        categories: selectedCategories,
        backUrl: '/psicotecnicos/test',
        backText: 'Volver a Psicotécnicos'
      }}
      resumeData={resumeData}
    />
  )
}

export default function PsychometricTestExecutor() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Preparando test...</p>
        </div>
      </div>
    }>
      <MultipleCategoriesPsychometricTestContent />
    </Suspense>
  )
}
