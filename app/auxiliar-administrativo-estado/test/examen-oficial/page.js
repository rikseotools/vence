'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import dynamic from 'next/dynamic'

// Dynamic import del componente de examen oficial
const OfficialExamLayout = dynamic(() => import('@/components/OfficialExamLayout'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando examen oficial...</p>
      </div>
    </div>
  )
})

function OfficialExamContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, supabase, loading: authLoading } = useAuth()
  const [questions, setQuestions] = useState([])
  const [metadata, setMetadata] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Resume state
  const [resumeTestId, setResumeTestId] = useState(null)
  const [initialAnswers, setInitialAnswers] = useState(null)

  const examDate = searchParams.get('fecha')
  const resumeParam = searchParams.get('resume')
  const oposicion = 'auxiliar-administrativo-estado'

  useEffect(() => {
    async function loadOfficialExam() {
      // If resuming, load from resume API instead
      if (resumeParam) {
        await loadResumeExam(resumeParam)
        return
      }

      if (!examDate) {
        setError('No se especificó la fecha del examen')
        setLoading(false)
        return
      }

      try {
        console.log('🎯 [OfficialExam] Loading exam:', examDate, oposicion)

        const response = await fetch(
          `/api/v2/official-exams/questions?examDate=${examDate}&oposicion=${oposicion}&includeReservas=true`
        )
        const data = await response.json()

        if (!data.success) {
          setError(data.error || 'Error al cargar el examen')
          setLoading(false)
          return
        }

        if (!data.questions || data.questions.length === 0) {
          setError('No se encontraron preguntas para este examen')
          setLoading(false)
          return
        }

        console.log(`✅ [OfficialExam] Loaded ${data.questions.length} questions`)

        // Transform questions to the format expected by the layout
        const formattedQuestions = data.questions.map((q, index) => ({
          id: q.id,
          question: q.questionText,
          options: [q.optionA, q.optionB, q.optionC, q.optionD],
          explanation: q.explanation,
          difficulty: q.difficulty,
          questionType: q.questionType,
          questionSubtype: q.questionSubtype,
          isReserva: q.isReserva,
          contentData: q.contentData,
          timeLimitSeconds: q.timeLimitSeconds,
          articleNumber: q.articleNumber,
          lawName: q.lawName,
          examSource: q.examSource,
          questionNumber: index + 1,
        }))

        setQuestions(formattedQuestions)
        setMetadata(data.metadata)

      } catch (error) {
        console.error('❌ [OfficialExam] Error loading exam:', error)
        setError('Error inesperado al cargar el examen')
      } finally {
        setLoading(false)
      }
    }

    async function loadResumeExam(testId) {
      try {
        console.log('🔄 [OfficialExam] Loading resume for:', testId)

        // Get auth token
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token

        if (!token) {
          setError('Debes iniciar sesión para reanudar el examen')
          setLoading(false)
          return
        }

        const response = await fetch(
          `/api/v2/official-exams/resume?testId=${testId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        )
        const data = await response.json()

        if (!data.success) {
          setError(data.error || 'Error al reanudar el examen')
          setLoading(false)
          return
        }

        if (!data.questions || data.questions.length === 0) {
          setError('No se encontraron preguntas para este examen')
          setLoading(false)
          return
        }

        console.log(`✅ [OfficialExam] Resume loaded: ${data.questions.length} questions, ${data.metadata?.answeredCount || 0} answered`)

        // Transform questions to the format expected by the layout
        const formattedQuestions = data.questions.map((q, index) => ({
          id: q.id,
          question: q.questionText,
          options: [q.optionA, q.optionB, q.optionC, q.optionD],
          explanation: q.explanation,
          difficulty: q.difficulty,
          questionType: q.questionType,
          questionSubtype: q.questionSubtype,
          isReserva: q.isReserva,
          contentData: q.contentData,
          articleNumber: q.articleNumber,
          lawName: q.lawName,
          questionNumber: index + 1,
        }))

        // Convert savedAnswers from { "0": "a", ... } to { 0: "a", ... }
        const answers = {}
        if (data.savedAnswers) {
          for (const [key, value] of Object.entries(data.savedAnswers)) {
            answers[parseInt(key, 10)] = value
          }
        }

        setQuestions(formattedQuestions)
        setMetadata({
          examDate: data.metadata?.examDate,
          legislativeCount: data.metadata?.legislativeCount,
          psychometricCount: data.metadata?.psychometricCount,
          reservaCount: data.metadata?.reservaCount,
        })
        setResumeTestId(testId)
        setInitialAnswers(answers)

      } catch (error) {
        console.error('❌ [OfficialExam] Error loading resume:', error)
        setError('Error inesperado al reanudar el examen')
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading) {
      loadOfficialExam()
    }
  }, [examDate, resumeParam, oposicion, authLoading, supabase])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando examen oficial...</p>
          {examDate && (
            <p className="text-gray-500 text-sm mt-2">
              Convocatoria: {new Date(examDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/auxiliar-administrativo-estado/test"
            className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Volver a Tests
          </Link>
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">📋</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Sin preguntas</h1>
          <p className="text-gray-600 mb-6">No se encontraron preguntas para este examen oficial.</p>
          <Link
            href="/auxiliar-administrativo-estado/test"
            className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Volver a Tests
          </Link>
        </div>
      </div>
    )
  }

  return (
    <OfficialExamLayout
      questions={questions}
      metadata={metadata}
      oposicion={oposicion}
      config={{
        testType: 'official-exam',
        examDate: examDate || metadata?.examDate,
        backUrl: '/auxiliar-administrativo-estado/test',
        backText: 'Volver a Tests'
      }}
      resumeTestId={resumeTestId}
      initialAnswers={initialAnswers}
    />
  )
}

export default function OfficialExamPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Preparando examen oficial...</p>
        </div>
      </div>
    }>
      <OfficialExamContent />
    </Suspense>
  )
}
