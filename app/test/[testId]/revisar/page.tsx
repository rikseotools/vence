'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ExamReviewLayout from '@/components/ExamReviewLayout'
import type {
  ReviewQuestion,
  TestInfo,
  TestSummary,
  TemaBreakdown,
  DifficultyBreakdown,
} from '@/lib/api/test-review/schemas'

interface ReviewData {
  success: boolean
  test?: TestInfo
  summary?: TestSummary
  questions?: ReviewQuestion[]
  temaBreakdown?: TemaBreakdown[]
  difficultyBreakdown?: DifficultyBreakdown[]
  error?: string
}

export default function TestReviewPage() {
  const params = useParams()
  const router = useRouter()
  const testId = params.testId as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewData, setReviewData] = useState<ReviewData | null>(null)

  useEffect(() => {
    if (!testId) return

    const fetchReviewData = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/tests/${testId}/review`)
        const data: ReviewData = await response.json()

        if (!data.success) {
          setError(data.error || 'Error cargando datos del test')
          return
        }

        setReviewData(data)
      } catch (err) {
        console.error('Error fetching test review:', err)
        setError('Error de conexión')
      } finally {
        setLoading(false)
      }
    }

    fetchReviewData()
  }, [testId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Cargando revisión del test...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">😞</div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
            No se pudo cargar el test
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Volver
          </button>
        </div>
      </div>
    )
  }

  if (!reviewData || !reviewData.test || !reviewData.questions || !reviewData.summary) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300">No hay datos disponibles</p>
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
    />
  )
}
