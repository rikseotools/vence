// app/tramitacion-procesal/test/repaso-fallos-oficial/page.tsx
// Page to retry failed questions from a completed official exam
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import dynamic from 'next/dynamic'

// Dynamic import of TestLayout for code splitting
const TestLayout = dynamic(() => import('@/components/TestLayout'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando test de repaso...</p>
      </div>
    </div>
  )
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformFailedQuestions(failedQuestions: any[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return failedQuestions.map((q: any) => ({
    id: q.id,
    question: q.questionText,
    question_text: q.questionText,
    option_a: q.optionA,
    option_b: q.optionB,
    option_c: q.optionC,
    option_d: q.optionD,
    options: [q.optionA, q.optionB, q.optionC, q.optionD],
    explanation: q.explanation ?? undefined,
    article: q.primaryArticleId ? {
      id: q.primaryArticleId,
      number: q.articleNumber ?? undefined,
      law_short_name: q.lawName ?? undefined,
    } : undefined,
    law: q.lawName ? {
      name: q.lawName,
      short_name: q.lawName,
    } : undefined,
    difficulty: q.difficulty ?? undefined,
    question_type: q.questionType,
    question_subtype: q.questionSubtype ?? undefined,
    content_data: q.contentData ?? undefined,
  }))
}

function RepasoFallosOficialContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, supabase, loading: authLoading } = useAuth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const examDate = searchParams.get('fecha')
  const parte = searchParams.get('parte')
  const oposicion = 'tramitacion-procesal'

  useEffect(() => {
    async function loadFailedQuestions() {
      if (authLoading) return
      if (!user) {
        router.push('/login')
        return
      }

      if (!examDate) {
        setError('No se especifico la fecha del examen')
        setLoading(false)
        return
      }

      try {
        const session = await supabase.auth.getSession()
        const token = session.data.session?.access_token

        if (!token) {
          setError('No hay sesion activa')
          setLoading(false)
          return
        }

        const parteParam = parte ? `&parte=${parte}` : ''
        const response = await fetch(
          `/api/v2/official-exams/failed-questions?examDate=${examDate}&oposicion=${oposicion}${parteParam}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        const data = await response.json()

        if (!data.success) {
          setError(data.error || 'Error al cargar las preguntas falladas')
          setLoading(false)
          return
        }

        if (!data.questions || data.questions.length === 0) {
          setError('No hay preguntas falladas para repasar')
          setLoading(false)
          return
        }

        // Transform questions to TestLayout format
        const transformedQuestions = transformFailedQuestions(data.questions)
        setQuestions(transformedQuestions)
        setLoading(false)
      } catch (err) {
        console.error('Error loading failed questions:', err)
        setError('Error inesperado al cargar las preguntas')
        setLoading(false)
      }
    }

    loadFailedQuestions()
  }, [user, authLoading, examDate, parte, router, supabase])

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando preguntas falladas...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-red-500 text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/tramitacion-procesal/test"
            className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Volver a tests
          </Link>
        </div>
      </div>
    )
  }

  // Format exam date for display
  const formattedDate = examDate
    ? new Date(examDate).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''

  const parteLabel = parte
    ? ` - ${parte.charAt(0).toUpperCase() + parte.slice(1)}`
    : ''

  // Render TestLayout with failed questions
  return (
    <TestLayout
      tema={0}
      testNumber={1}
      config={{
        name: 'Repaso de Fallos',
        description: `Repasa las ${questions.length} preguntas que fallaste en el examen oficial`,
        subtitle: `Examen ${formattedDate}${parteLabel}`,
        icon: '🎯',
        color: 'from-purple-500 to-purple-700'
      }}
      questions={questions}
    />
  )
}

export default function RepasoFallosOficialPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando...</p>
          </div>
        </div>
      }
    >
      <RepasoFallosOficialContent />
    </Suspense>
  )
}
