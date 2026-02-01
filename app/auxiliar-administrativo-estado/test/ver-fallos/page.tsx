// app/auxiliar-administrativo-estado/test/ver-fallos/page.tsx
// Page to view failed questions from a completed official exam
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import type { OfficialExamFailedQuestion } from '@/lib/api/official-exams/schemas'

// Helper to convert letter (a, b, c, d) to index (0, 1, 2, 3)
function letterToIndex(letter: string): number {
  return letter.toLowerCase().charCodeAt(0) - 97
}

// Helper to convert index to letter
function indexToLetter(index: number): string {
  return String.fromCharCode(65 + index) // A, B, C, D
}

// Helper to parse basic markdown (bold with **text**)
function parseMarkdown(text: string): string {
  // Convert **text** to <strong>text</strong>
  return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

// Helper to render tables from contentData
function renderTables(contentData: Record<string, unknown> | null) {
  if (!contentData) return null

  const tables = contentData.tables as Array<{
    title?: string
    headers: string[]
    rows: string[][]
  }> | undefined

  if (!tables || !Array.isArray(tables)) return null

  return (
    <div className="mb-4 space-y-4">
      {tables.map((table, tableIndex) => (
        <div key={tableIndex} className="overflow-x-auto">
          {table.title && (
            <h4 className="font-semibold text-gray-700 mb-2 text-sm">{table.title}</h4>
          )}
          <table className="w-full border-collapse border border-gray-300 text-xs">
            <thead>
              <tr className="bg-gray-100">
                {table.headers.map((header, i) => (
                  <th key={i} className="border border-gray-300 px-2 py-1 text-gray-700 font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="border border-gray-300 px-2 py-1 text-center text-gray-600">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

interface FailedQuestionCardProps {
  question: OfficialExamFailedQuestion
  index: number
}

function FailedQuestionCard({ question, index }: FailedQuestionCardProps) {
  const [showExplanation, setShowExplanation] = useState(true)

  // Check if question was unanswered
  const isUnanswered = !question.userAnswer || question.userAnswer === '' || question.userAnswer === 'sin_respuesta'
  const userAnswerIndex = isUnanswered ? -1 : letterToIndex(question.userAnswer)
  const correctAnswerIndex = letterToIndex(question.correctAnswer)

  const options = [
    question.optionA,
    question.optionB,
    question.optionC,
    question.optionD,
  ]

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-4">
      {/* Question header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm font-bold">
            #{index + 1}
          </span>
          {question.questionType === 'psychometric' && (
            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-medium">
              Psicotecnico
            </span>
          )}
          {question.lawName && (
            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
              {question.lawName} Art. {question.articleNumber}
            </span>
          )}
          {isUnanswered && (
            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs font-medium">
              Sin contestar
            </span>
          )}
        </div>
      </div>

      {/* Tables for psychometric questions */}
      {question.questionType === 'psychometric' && renderTables(question.contentData)}

      {/* Question text */}
      <p className="text-gray-800 font-medium mb-4">{question.questionText}</p>

      {/* Options */}
      <div className="space-y-2 mb-4">
        {options.map((option, optIndex) => {
          const isUserAnswer = optIndex === userAnswerIndex
          const isCorrectAnswer = optIndex === correctAnswerIndex

          let bgColor = 'bg-gray-50'
          let borderColor = 'border-gray-200'
          let textColor = 'text-gray-700'
          let icon = null

          if (isCorrectAnswer) {
            bgColor = 'bg-green-50'
            borderColor = 'border-green-400'
            textColor = 'text-green-800'
            icon = (
              <span className="ml-auto text-green-600 font-bold text-sm">
                Correcta
              </span>
            )
          } else if (isUserAnswer) {
            bgColor = 'bg-red-50'
            borderColor = 'border-red-400'
            textColor = 'text-red-800'
            icon = (
              <span className="ml-auto text-red-600 font-bold text-sm">
                Tu respuesta
              </span>
            )
          }

          return (
            <div
              key={optIndex}
              className={`flex items-center p-3 rounded-lg border-2 ${bgColor} ${borderColor}`}
            >
              <span className={`font-bold mr-3 ${textColor}`}>
                {indexToLetter(optIndex)}.
              </span>
              <span className={textColor}>{option}</span>
              {icon}
            </div>
          )
        })}
      </div>

      {/* Explanation toggle */}
      {question.explanation && (
        <div>
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
          >
            {showExplanation ? 'Ocultar explicación' : 'Ver explicación'}
            <svg
              className={`w-4 h-4 transition-transform ${showExplanation ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showExplanation && (
            <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p
                className="text-sm text-blue-800 whitespace-pre-line"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(question.explanation) }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface AuthContextValue {
  user: { id: string } | null
  supabase: { auth: { getSession: () => Promise<{ data: { session: { access_token: string } | null } }> } }
  loading: boolean
}

function VerFallosContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, supabase, loading: authLoading } = useAuth() as AuthContextValue
  const [questions, setQuestions] = useState<OfficialExamFailedQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const examDate = searchParams.get('fecha')
  const parte = searchParams.get('parte') as 'primera' | 'segunda' | null
  const oposicion = 'auxiliar-administrativo-estado'

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

        setQuestions(data.questions || [])
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando fallos...</p>
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

  // No failed questions
  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <InteractiveBreadcrumbs />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-green-500 text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Sin fallos</h2>
            <p className="text-gray-600 mb-6">
              No tienes preguntas falladas en este examen. Enhorabuena!
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

  // Format exam date for display
  const formattedDate = new Date(examDate!).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <InteractiveBreadcrumbs />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 mb-1">
                  Revision de Fallos
                </h1>
                <p className="text-gray-600">
                  Examen {formattedDate}
                  {parte && ` - ${parte.charAt(0).toUpperCase() + parte.slice(1)} parte`}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-red-600">
                  {questions.length}
                </div>
                <div className="text-sm text-gray-500">
                  pregunta{questions.length !== 1 ? 's' : ''} fallada{questions.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mb-6">
            <Link
              href={`/auxiliar-administrativo-estado/test/repaso-fallos-oficial?fecha=${examDate}&parte=${parte}`}
              className="flex-1 bg-amber-600 text-white py-3 px-4 rounded-lg font-semibold text-center hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
            >
              <span>🎯</span>
              <span>Practicar estos fallos</span>
            </Link>
            <Link
              href="/auxiliar-administrativo-estado/test"
              className="bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              Volver
            </Link>
          </div>

          {/* Questions list */}
          <div>
            {questions.map((question, index) => (
              <FailedQuestionCard key={question.id} question={question} index={index} />
            ))}
          </div>

          {/* Bottom action */}
          <div className="mt-6 text-center">
            <Link
              href={`/auxiliar-administrativo-estado/test/repaso-fallos-oficial?fecha=${examDate}&parte=${parte}`}
              className="inline-block bg-amber-600 text-white py-3 px-8 rounded-lg font-semibold hover:bg-amber-700 transition-colors"
            >
              Practicar estos {questions.length} fallos
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VerFallosPage() {
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
      <VerFallosContent />
    </Suspense>
  )
}
