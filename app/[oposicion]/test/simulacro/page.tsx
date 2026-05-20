// app/[oposicion]/test/simulacro/page.tsx
//
// Simulacro de examen: replica la distribución oficial (110 preguntas para
// Aux Admin Estado) con preguntas ALEATORIAS del catálogo. Cada simulacro
// es distinto. Reutiliza `OfficialExamLayout` (mismo formato de preguntas).
//
// Reanudación: si el usuario tiene un simulacro empezado y sin terminar,
// al entrar de nuevo se carga ese simulacro (mismas preguntas + respuestas
// guardadas + cronómetro continuando desde donde lo dejó). Para forzar
// generar uno nuevo: `?nuevo=1` en la URL.

'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { getAuthHeaders } from '@/lib/api/authHeaders'

const OfficialExamLayout = dynamic(() => import('@/components/OfficialExamLayout'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando simulacro...</p>
      </div>
    </div>
  ),
})

interface SimulacroQuestionApi {
  id: string
  questionText: string
  optionA: string | null
  optionB: string | null
  optionC: string | null
  optionD: string | null
  optionE: string | null
  explanation: string | null
  difficulty: string | null
  questionType: 'legislative' | 'psychometric'
  questionSubtype: string | null
  isReserva: boolean
  contentData: Record<string, unknown> | null
  imageUrl: string | null
  timeLimitSeconds: number | null
  articleNumber: string | null
  lawName: string | null
  examSource: string | null
  examCaseId: string | null
  examCaseText: string | null
  examCaseTitle: string | null
}

interface SimulacroMetadata {
  isSimulacro: true
  totalQuestions: number
  durationMinutes: number
  legislativeCount?: number
  psychometricCount?: number
  breakdown?: string[]
  totalTimeSeconds?: number
}

function SimulacroContent() {
  const params = useParams<{ oposicion: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { supabase, loading: authLoading } = useAuth() as {
    supabase: ReturnType<typeof import('@supabase/supabase-js').createClient>
    loading: boolean
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [questions, setQuestions] = useState<any[]>([])
  const [metadata, setMetadata] = useState<SimulacroMetadata | null>(null)
  const [resumeTestId, setResumeTestId] = useState<string | undefined>(undefined)
  const [initialAnswers, setInitialAnswers] = useState<Record<number, string> | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [loadingPhase, setLoadingPhase] = useState<'pending' | 'resume' | 'new'>('pending')
  const [error, setError] = useState<string | null>(null)

  const oposicion = params.oposicion
  const backUrl = `/${oposicion}/test`
  const forceNew = searchParams.get('nuevo') === '1'
  const resumeParam = searchParams.get('resume')

  useEffect(() => {
    async function loadOrResumeSimulacro() {
      try {
        // ───────────────────────────────────────────────
        // 1) Si hay ?resume=<testId>, ir directamente a resume
        // ───────────────────────────────────────────────
        if (resumeParam) {
          await loadResume(resumeParam)
          return
        }

        // ───────────────────────────────────────────────
        // 2) Detectar simulacro pendiente (a menos que ?nuevo=1)
        // ───────────────────────────────────────────────
        if (!forceNew) {
          setLoadingPhase('pending')
          const headers = await getAuthHeaders()
          if (headers['Authorization']) {
            try {
              const pendingRes = await fetch('/api/v2/official-exams/pending', { headers })
              const pendingData = await pendingRes.json()
              if (pendingData.success && Array.isArray(pendingData.exams)) {
                const pendingSim = pendingData.exams.find(
                  (e: { testType?: string; oposicion?: string; id: string }) =>
                    e.testType === 'simulacro' && e.oposicion === oposicion,
                )
                if (pendingSim?.id) {
                  console.log('🔄 [Simulacro] Detectado pendiente:', pendingSim.id, '→ reanudando')
                  await loadResume(pendingSim.id)
                  return
                }
              }
            } catch (e) {
              console.warn('⚠️ [Simulacro] No se pudo comprobar pendientes:', e)
              // Continúa con flujo "nuevo"
            }
          }
        }

        // ───────────────────────────────────────────────
        // 3) Generar simulacro nuevo
        // ───────────────────────────────────────────────
        setLoadingPhase('new')
        console.log('🎯 [Simulacro] Generando nuevo para oposición:', oposicion)

        const response = await fetch(
          `/api/v2/simulacro/questions?oposicion=${oposicion}`,
        )
        const data = await response.json()

        if (!data.success) {
          setError(data.error || 'No se pudo generar el simulacro')
          setLoading(false)
          return
        }

        if (!data.questions || data.questions.length === 0) {
          setError('No se encontraron preguntas para generar el simulacro')
          setLoading(false)
          return
        }

        console.log(`✅ [Simulacro] Cargadas ${data.questions.length} preguntas nuevas`)

        const formattedQuestions = (data.questions as SimulacroQuestionApi[]).map(
          (q, index) => ({
            id: q.id,
            question: q.questionText,
            options: [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE].filter(
              (v): v is string => v != null && v !== '',
            ),
            explanation: q.explanation,
            difficulty: q.difficulty,
            questionType: q.questionType,
            questionSubtype: q.questionSubtype,
            isReserva: q.isReserva,
            contentData: q.contentData,
            imageUrl: q.imageUrl,
            timeLimitSeconds: q.timeLimitSeconds,
            articleNumber: q.articleNumber,
            lawName: q.lawName,
            examSource: q.examSource,
            examCaseId: q.examCaseId,
            examCaseText: q.examCaseText,
            examCaseTitle: q.examCaseTitle,
            questionNumber: index + 1,
          }),
        )

        setQuestions(formattedQuestions)
        setMetadata(data.metadata)
      } catch (err) {
        console.error('❌ [Simulacro] Error:', err)
        setError('Error inesperado al cargar el simulacro')
      } finally {
        setLoading(false)
      }
    }

    async function loadResume(testId: string) {
      try {
        setLoadingPhase('resume')
        console.log('🔄 [Simulacro] Reanudando testId:', testId)

        const headers = await getAuthHeaders()
        if (!headers['Authorization']) {
          setError('Debes iniciar sesión para reanudar el simulacro')
          setLoading(false)
          return
        }

        const response = await fetch(
          `/api/v2/official-exams/resume?testId=${testId}`,
          { headers },
        )
        const data = await response.json()

        if (!data.success) {
          // Si está completado, generar uno nuevo
          if (data.errorType === 'completed') {
            console.log('ℹ️ [Simulacro] Test pendiente estaba completado — generando nuevo')
            router.replace(`/${oposicion}/test/simulacro?nuevo=1`)
            return
          }
          setError(data.error || 'Error al reanudar el simulacro')
          setLoading(false)
          return
        }

        if (!data.questions || data.questions.length === 0) {
          setError('El simulacro pendiente no tiene preguntas — genera uno nuevo')
          setLoading(false)
          return
        }

        console.log(
          `✅ [Simulacro] Reanudado: ${data.questions.length} preguntas, ${data.metadata?.answeredCount || 0} respondidas, ${data.metadata?.totalTimeSeconds || 0}s transcurridos`,
        )

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formattedQuestions = data.questions.map((q: any, index: number) => ({
          id: q.id,
          question: q.questionText,
          options: [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE].filter(
            (v: unknown): v is string => v != null && v !== '',
          ),
          explanation: q.explanation,
          difficulty: q.difficulty,
          questionType: q.questionType,
          questionSubtype: q.questionSubtype,
          isReserva: q.isReserva,
          contentData: q.contentData,
          imageUrl: q.imageUrl,
          articleNumber: q.articleNumber,
          lawName: q.lawName,
          examCaseId: q.examCaseId,
          examCaseText: q.examCaseText,
          examCaseTitle: q.examCaseTitle,
          questionNumber: index + 1,
        }))

        const answers: Record<number, string> = {}
        if (data.savedAnswers) {
          for (const [key, value] of Object.entries(data.savedAnswers)) {
            answers[parseInt(key, 10)] = value as string
          }
        }

        setQuestions(formattedQuestions)
        setMetadata({
          isSimulacro: true,
          totalQuestions: data.metadata?.totalQuestions || formattedQuestions.length,
          durationMinutes: data.metadata?.durationMinutes || 90,
          legislativeCount: data.metadata?.legislativeCount,
          psychometricCount: data.metadata?.psychometricCount,
          breakdown: data.metadata?.breakdown,
          totalTimeSeconds: data.metadata?.totalTimeSeconds || 0,
        })
        setResumeTestId(testId)
        setInitialAnswers(answers)
      } catch (err) {
        console.error('❌ [Simulacro] Resume error:', err)
        setError('Error inesperado al reanudar el simulacro')
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading) {
      loadOrResumeSimulacro()
    }
  }, [oposicion, authLoading, forceNew, resumeParam, router, supabase])

  if (authLoading || loading) {
    const loadingMsg =
      loadingPhase === 'resume'
        ? 'Reanudando tu simulacro pendiente...'
        : loadingPhase === 'pending'
          ? 'Comprobando si tienes un simulacro pendiente...'
          : 'Preparando tu simulacro de examen...'
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{loadingMsg}</p>
          {loadingPhase === 'new' && (
            <p className="text-gray-500 text-sm mt-2">
              Generando 110 preguntas aleatorias con el formato oficial
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
          <h1 className="text-2xl font-bold text-red-600 mb-4">No se pudo cargar el simulacro</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href={backUrl}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
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
          <p className="text-gray-600 mb-6">
            No se han podido generar las preguntas del simulacro.
          </p>
          <Link
            href={backUrl}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
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
      metadata={
        metadata
          ? {
              legislativeCount: metadata.legislativeCount,
              psychometricCount: metadata.psychometricCount,
              reservaCount: 0,
              breakdown: metadata.breakdown,
              durationMinutes: metadata.durationMinutes,
              totalTimeSeconds: metadata.totalTimeSeconds || 0,
            }
          : undefined
      }
      oposicion={oposicion}
      config={{
        testType: 'simulacro',
        backUrl,
        backText: 'Volver a Tests',
        // Cuenta atrás con el tiempo oficial del examen (Aux Admin Estado: 90 min).
        // Cuando llega a 0 se auto-envía y se corrige.
        durationMinutes: metadata?.durationMinutes,
      }}
      resumeTestId={resumeTestId}
      initialAnswers={initialAnswers}
    />
  )
}

export default function SimulacroPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Preparando simulacro...</p>
          </div>
        </div>
      }
    >
      <SimulacroContent />
    </Suspense>
  )
}
