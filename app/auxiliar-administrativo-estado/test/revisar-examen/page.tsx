// app/auxiliar-administrativo-estado/test/revisar-examen/page.tsx
// Page to review a completed official exam (all questions)
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getAuthHeaders } from '@/lib/api/authHeaders'
import ExamReviewLayout from '@/components/ExamReviewLayout'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import Link from 'next/link'

interface AuthContextValue {
  user: { id: string } | null
  loading: boolean
}

function RevisarExamenContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth() as AuthContextValue

  const [reviewData, setReviewData] = useState<{
    test: { id: string; title: string; testType: string | null; tema: number | null; createdAt: string | null; completedAt: string | null; totalTimeSeconds: number }
    summary: { totalQuestions: number; correctCount: number; incorrectCount: number; blankCount: number; score: string | null; percentage: number }
    questions: Array<{
      id: string
      order: number
      questionText: string
      options: string[]
      difficulty: string | null
      tema: number | null
      articleNumber: string | null
      lawName: string | null
      explanation: string | null
      imageUrl: string | null
      contentData?: unknown
      article: string | null
      isPsychometric: boolean
      userAnswer: string | null
      correctAnswer: string
      isCorrect: boolean
      timeSpent: number
    }>
    temaBreakdown?: Array<{ tema: number; total: number; correct: number; accuracy: number }>
    difficultyBreakdown?: Array<{ difficulty: string; total: number; correct: number; accuracy: number }>
    notaCorte?: {
      descripcion: string
      primera_parte: { nota: number }
      segunda_parte: { nota: number }
      total: number
      orden: number
      convocatoria_url?: string
    }
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const examDate = searchParams.get('fecha')
  const parte = searchParams.get('parte') as 'primera' | 'segunda' | null
  const oposicion = 'auxiliar-administrativo-estado'

  useEffect(() => {
    async function loadExamReview() {
      if (authLoading) return
      if (!user) {
        router.push('/login')
        return
      }

      if (!examDate) {
        setError('No se especificó la fecha del examen')
        setLoading(false)
        return
      }

      try {
        const authHeaders = await getAuthHeaders()

        if (!authHeaders['Authorization']) {
          setError('No hay sesión activa')
          setLoading(false)
          return
        }

        const parteParam = parte ? `&parte=${parte}` : ''
        const response = await fetch(
          `/api/v2/official-exams/review?examDate=${examDate}&oposicion=${oposicion}${parteParam}`,
          {
            headers: authHeaders,
          }
        )

        const data = await response.json()

        if (!data.success) {
          setError(data.error || 'Error al cargar la revisión del examen')
          setLoading(false)
          return
        }

        setReviewData(data)
        setLoading(false)
      } catch (err) {
        console.error('Error loading exam review:', err)
        setError('Error inesperado al cargar la revisión')
        setLoading(false)
      }
    }

    loadExamReview()
  }, [user, authLoading, examDate, parte, router])

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando revisión del examen...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <InteractiveBreadcrumbs />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-red-500 text-5xl mb-4">❌</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link
              href="/auxiliar-administrativo-estado/test"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Volver a tests
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // No data
  if (!reviewData || !reviewData.questions || reviewData.questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <InteractiveBreadcrumbs />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-gray-400 text-5xl mb-4">📋</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Sin datos</h2>
            <p className="text-gray-600 mb-6">
              No se encontraron datos de este examen. Es posible que no lo hayas completado aún.
            </p>
            <Link
              href="/auxiliar-administrativo-estado/test"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Volver a tests
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ExamReviewLayout
      test={reviewData.test}
      summary={reviewData.summary}
      questions={reviewData.questions}
      temaBreakdown={reviewData.temaBreakdown}
      difficultyBreakdown={reviewData.difficultyBreakdown}
      notaCorte={reviewData.notaCorte}
      oposicionSlug={oposicion}
      parte={parte}
    />
  )
}

export default function RevisarExamenPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando...</p>
          </div>
        </div>
      }
    >
      <RevisarExamenContent />
    </Suspense>
  )
}
