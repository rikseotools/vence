// components/Statistics/OfficialExamAttempts.tsx
// Shows all user attempts for a specific official exam
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import NavigationButton from '@/components/ui/NavigationButton'

interface ExamAttempt {
  id: string
  title: string | null
  score: number | null
  totalQuestions: number | null
  completedAt: string | null
  totalTimeSeconds: number | null
}

interface OfficialExamAttemptsProps {
  examDate: string
  parte: string
  oposicion: string
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function getScoreColor(percentage: number): string {
  if (percentage >= 85) return 'text-green-600'
  if (percentage >= 70) return 'text-blue-600'
  if (percentage >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

function getScoreBg(percentage: number): string {
  if (percentage >= 85) return 'bg-green-50 border-green-200'
  if (percentage >= 70) return 'bg-blue-50 border-blue-200'
  if (percentage >= 50) return 'bg-yellow-50 border-yellow-200'
  return 'bg-red-50 border-red-200'
}

function getParteLabel(parte: string): string {
  switch (parte) {
    case 'primera': return 'Primera parte'
    case 'segunda': return 'Segunda parte'
    case 'unica': return 'Primer ejercicio'
    case 'supuesto': return 'Supuesto practico'
    case 'tercer-ejercicio': return 'Tercer ejercicio'
    default: return parte
  }
}

export default function OfficialExamAttempts({
  examDate,
  parte,
  oposicion,
}: OfficialExamAttemptsProps) {
  const { user, supabase, loading: authLoading } = useAuth()
  const router = useRouter()
  const [attempts, setAttempts] = useState<ExamAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const formattedExamDate = new Date(examDate).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  useEffect(() => {
    async function loadAttempts() {
      if (authLoading || !user) return

      try {
        const { data, error } = await supabase
          .from('tests')
          .select('id, title, score, total_questions, completed_at, total_time_seconds')
          .eq('user_id', user.id)
          .eq('is_completed', true)
          .eq('test_type', 'exam')
          .filter('detailed_analytics->>isOfficialExam', 'eq', 'true')
          .filter('detailed_analytics->>examDate', 'eq', examDate)
          .filter('detailed_analytics->>parte', 'eq', parte)
          .filter('detailed_analytics->>oposicion', 'eq', oposicion)
          .order('completed_at', { ascending: false })

        if (error) {
          console.error('Error loading attempts:', error)
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setAttempts((data || []).map((t: any) => ({
            id: t.id,
            title: t.title,
            score: t.score,
            totalQuestions: t.total_questions,
            completedAt: t.completed_at,
            totalTimeSeconds: t.total_time_seconds,
          })))
        }
      } catch (err) {
        console.error('Error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadAttempts()
  }, [user, authLoading, supabase, examDate, parte, oposicion])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando intentos...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    router.push('/login')
    return null
  }

  // Calculate best attempt
  const bestAttempt = attempts.length > 0
    ? attempts.reduce((best, a) => {
        const bestPct = best.score && best.totalQuestions ? (best.score / best.totalQuestions) * 100 : 0
        const aPct = a.score && a.totalQuestions ? (a.score / a.totalQuestions) * 100 : 0
        return aPct > bestPct ? a : best
      })
    : null

  const bestPercentage = bestAttempt?.score && bestAttempt?.totalQuestions
    ? Math.round((bestAttempt.score / bestAttempt.totalQuestions) * 100)
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <InteractiveBreadcrumbs />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => router.back()}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  Examen Oficial {formattedExamDate}
                </h1>
                <p className="text-gray-500 text-sm">{getParteLabel(parte)}</p>
              </div>
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <div className="text-sm text-gray-600">
                <span className="font-semibold text-gray-800">{attempts.length}</span> intento{attempts.length !== 1 ? 's' : ''}
              </div>
              {bestAttempt && (
                <div className="text-sm">
                  Mejor resultado: <span className={`font-bold ${getScoreColor(bestPercentage)}`}>{bestPercentage}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Repeat exam button */}
          <NavigationButton
            href={`/${oposicion}/test/examen-oficial?fecha=${examDate}&parte=${parte}`}
            className="w-full mb-6 py-3 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-center transition-colors flex items-center justify-center gap-2"
          >
            <span>🔄</span>
            <span>{attempts.length === 0 ? 'Empezar examen' : 'Repetir examen'}</span>
          </NavigationButton>

          {/* Attempts list */}
          {attempts.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <div className="text-5xl mb-4">📋</div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">Sin intentos</h2>
              <p className="text-gray-600">
                Aun no has realizado este examen. Empieza ahora para ver tus resultados.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {attempts.map((attempt, index) => {
                const percentage = attempt.score && attempt.totalQuestions
                  ? Math.round((attempt.score / attempt.totalQuestions) * 100)
                  : 0
                const isLoading = loadingId === attempt.id

                return (
                  <div
                    key={attempt.id}
                    onClick={() => {
                      setLoadingId(attempt.id)
                      router.push(`/revisar/${attempt.id}`)
                    }}
                    className={`bg-white rounded-lg shadow-sm border ${getScoreBg(percentage)} p-4 cursor-pointer hover:shadow-md transition-all ${isLoading ? 'opacity-70' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">
                          {isLoading ? (
                            <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-500 border-t-transparent" />
                          ) : (
                            <span className="bg-gray-200 text-gray-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                              {attempts.length - index}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800 text-sm">
                            {attempt.completedAt ? formatDate(attempt.completedAt) : 'Fecha desconocida'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {attempt.totalTimeSeconds ? formatTime(attempt.totalTimeSeconds) : '--:--'}
                            {attempt.totalQuestions && ` · ${attempt.totalQuestions} preguntas`}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xl font-bold ${getScoreColor(percentage)}`}>
                          {percentage}%
                        </div>
                        <div className="text-xs text-gray-500">
                          {attempt.score}/{attempt.totalQuestions}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
