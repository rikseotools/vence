'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import BarChartQuestion from '@/components/BarChartQuestion'
import PieChartQuestion from '@/components/PieChartQuestion'
import DataTableQuestion from '@/components/DataTableQuestion'
import LineChartQuestion from '@/components/LineChartQuestion'
import MixedChartQuestion from '@/components/MixedChartQuestion'
import ErrorDetectionQuestion from '@/components/ErrorDetectionQuestion'
import WordAnalysisQuestion from '@/components/WordAnalysisQuestion'
import SequenceNumericQuestion from '@/components/SequenceNumericQuestion'
import SequenceLetterQuestion from '@/components/SequenceLetterQuestion'
import SequenceAlphanumericQuestion from '@/components/SequenceAlphanumericQuestion'
import ChartQuestion from '@/components/ChartQuestion'
import ContentDataRenderer from '@/components/ContentDataRenderer'
import MarkdownExplanation from '@/components/MarkdownExplanation'

// ============================================================================
// Tipos
// ============================================================================

type DebugQuestionType = 'law' | 'psychometric'
type DebugQuestionSubtype =
  | 'text_question'
  | 'bar_chart'
  | 'pie_chart'
  | 'line_chart'
  | 'data_tables'
  | 'mixed_chart'
  | 'error_detection'
  | 'word_analysis'
  | 'sequence_numeric'
  | 'sequence_letter'
  | 'sequence_alphanumeric'
  | string

interface DebugQuestion {
  id: string
  question_text: string
  question_type: DebugQuestionType
  question_subtype: DebugQuestionSubtype
  options: { A: string; B: string; C: string; D: string; E?: string }
  content_data: Record<string, unknown> | null
  image_url: string | null
  explanation: string | null
  category_id: string | null
  category: { key: string; name: string }
  section: { key: string; name: string }
  primary_article_id?: string | null
  is_active?: boolean | null
  created_at?: string | null
}

interface DebugCategoryQuestion {
  id: string
}

interface ValidateAnswerResponse {
  success: boolean
  isCorrect?: boolean
  correctAnswer?: number
  explanation?: string | null
  error?: string
}

// ============================================================================
// Sub-componente: pregunta legislativa.
// Sustituye al uso erróneo de ChartQuestion para text_question, que mostraba
// un mensaje psicotécnico hardcodeado para preguntas que no son psicotécnicas.
// ============================================================================

interface LegislativeProps {
  question: DebugQuestion
  selectedAnswer: number | null
  showResult: boolean
  isAnswering: boolean
  verifiedCorrectAnswer: number | null
  verifiedExplanation: string | null
  onAnswer: (optionIndex: number) => void
}

const LETTERS = ['A', 'B', 'C', 'D'] as const

function LegislativeQuestionDebug({
  question,
  selectedAnswer,
  showResult,
  isAnswering,
  verifiedCorrectAnswer,
  verifiedExplanation,
  onAnswer,
}: LegislativeProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <ContentDataRenderer
        contentData={question.content_data}
        imageUrl={question.image_url}
      />

      <p className="text-lg text-gray-800 leading-relaxed mb-6">
        {question.question_text}
      </p>

      <div className="space-y-3">
        {LETTERS.map((letter, idx) => {
          const optionText = question.options[letter]
          if (!optionText) return null

          const isSelected = selectedAnswer === idx
          const isVerifiedCorrect =
            showResult && verifiedCorrectAnswer === idx
          const isWrong =
            showResult && isSelected && verifiedCorrectAnswer !== idx

          let stateClasses =
            'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
          if (isVerifiedCorrect) {
            stateClasses = 'border-green-500 bg-green-50'
          } else if (isWrong) {
            stateClasses = 'border-red-500 bg-red-50'
          } else if (isSelected) {
            stateClasses = 'border-blue-500 bg-blue-50'
          }

          return (
            <button
              key={letter}
              type="button"
              onClick={() => onAnswer(idx)}
              disabled={isAnswering || showResult}
              className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors disabled:cursor-not-allowed ${stateClasses}`}
            >
              <span className="font-semibold mr-2">{letter}</span>
              <span>{optionText}</span>
            </button>
          )
        })}
      </div>

      {showResult && verifiedExplanation && (
        <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
          <h3 className="font-bold text-blue-900 mb-2">Explicación</h3>
          <div className="text-gray-800">
            <MarkdownExplanation content={verifiedExplanation} />
          </div>
        </div>
      )}

      {showResult && !verifiedExplanation && (
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded text-gray-500 italic text-sm">
          No hay explicación disponible para esta pregunta.
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Página principal
// ============================================================================

export default function QuestionDebugPage() {
  const params = useParams<{ id: string }>()
  const [question, setQuestion] = useState<DebugQuestion | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState<boolean>(false)
  const [attemptCount, setAttemptCount] = useState<number>(0)
  const [, setCategoryQuestions] = useState<DebugCategoryQuestion[]>([])
  const [, setCurrentIndex] = useState<number>(0)
  const [verifiedCorrectAnswer, setVerifiedCorrectAnswer] = useState<number | null>(null)
  const [verifiedExplanation, setVerifiedExplanation] = useState<string | null>(null)
  const [isAnswering, setIsAnswering] = useState<boolean>(false)

  useEffect(() => {
    if (params?.id) {
      void fetchQuestion(params.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.id])

  async function fetchQuestion(questionId: string) {
    try {
      setLoading(true)
      const response = await fetch(`/api/debug/question/${questionId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch question')
      }

      const q: DebugQuestion = data.question
      setQuestion(q)

      if (q.category_id) {
        await fetchCategoryQuestions(q.category_id, q.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  async function fetchCategoryQuestions(categoryId: string, currentQuestionId: string) {
    try {
      const response = await fetch(`/api/debug/category/${categoryId}/questions`)
      const data = await response.json()

      if (response.ok && Array.isArray(data.questions)) {
        const list = data.questions as DebugCategoryQuestion[]
        setCategoryQuestions(list)
        const index = list.findIndex((q) => q.id === currentQuestionId)
        setCurrentIndex(index >= 0 ? index : 0)
      }
    } catch (err) {
      console.error('Error fetching category questions:', err)
    }
  }

  // 🔒 Validación de respuesta vía endpoint debug ligero (sin guardar en BD).
  // Sustituye al deprecado /api/answer (404 desde la migración a
  // /api/v2/answer-and-save, que NO sirve para debug porque exige sessionId
  // y guarda en test_questions).
  async function handleAnswer(optionIndex: number) {
    if (isAnswering || showResult || !question) return

    setIsAnswering(true)
    setSelectedAnswer(optionIndex)

    try {
      const apiEndpoint =
        question.question_type === 'psychometric'
          ? '/api/answer/psychometric'
          : `/api/debug/validate-answer/${question.id}`

      const body =
        question.question_type === 'psychometric'
          ? { questionId: question.id, userAnswer: optionIndex }
          : { userAnswer: optionIndex }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const result: ValidateAnswerResponse = await response.json()

      if (result.success && typeof result.correctAnswer === 'number') {
        setVerifiedCorrectAnswer(result.correctAnswer)
        setVerifiedExplanation(result.explanation ?? null)
        if (!result.isCorrect) {
          setAttemptCount((prev) => prev + 1)
        }
      } else {
        console.error('Error validating answer:', result.error)
      }
    } catch (err) {
      console.error('Error calling validation API:', err)
    } finally {
      setShowResult(true)
      setIsAnswering(false)
    }
  }

  function resetQuestion() {
    setSelectedAnswer(null)
    setShowResult(false)
    setVerifiedCorrectAnswer(null)
    setVerifiedExplanation(null)
  }

  function renderQuestion() {
    if (!question) return null

    // Cada componente psicotécnico tiene su propia firma de `question`
    // (ChartQuestionData, BarChartQuestionData, etc.). Como esta página es de
    // debug y no merece la pena replicar todas las firmas, hacemos cast laxo.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const questionProps: any = {
      question,
      onAnswer: handleAnswer,
      selectedAnswer,
      showResult,
      isAnswering,
      attemptCount,
      verifiedCorrectAnswer,
      verifiedExplanation,
    }

    switch (question.question_subtype) {
      case 'bar_chart':
        return <BarChartQuestion {...questionProps} />
      case 'pie_chart':
        return <PieChartQuestion {...questionProps} />
      case 'line_chart':
        return <LineChartQuestion {...questionProps} />
      case 'data_tables':
        return <DataTableQuestion {...questionProps} />
      case 'mixed_chart':
        return <MixedChartQuestion {...questionProps} />
      case 'error_detection':
        return <ErrorDetectionQuestion {...questionProps} />
      case 'word_analysis':
        return <WordAnalysisQuestion {...questionProps} />
      case 'sequence_numeric':
        return <SequenceNumericQuestion {...questionProps} />
      case 'sequence_letter':
        return <SequenceLetterQuestion {...questionProps} />
      case 'sequence_alphanumeric':
        return <SequenceAlphanumericQuestion {...questionProps} />

      case 'text_question':
      default:
        // Si es psicotécnica de texto, mantenemos ChartQuestion (es su flujo
        // original). Si es legislativa, usamos LegislativeQuestionDebug para
        // evitar el mensaje psicotécnico hardcodeado.
        if (question.question_type === 'psychometric') {
          return <ChartQuestion {...questionProps} />
        }
        return (
          <LegislativeQuestionDebug
            question={question}
            selectedAnswer={selectedAnswer}
            showResult={showResult}
            isAnswering={isAnswering}
            verifiedCorrectAnswer={verifiedCorrectAnswer}
            verifiedExplanation={verifiedExplanation}
            onAnswer={handleAnswer}
          />
        )
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando pregunta...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">❌</div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-yellow-100 border-b-2 border-yellow-300">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🔧</span>
              <div>
                <h1 className="text-lg font-bold text-yellow-800">
                  MODO DEBUG - Previsualización de Pregunta
                </h1>
                <p className="text-sm text-yellow-700">
                  ID: {question?.id} | Tipo: {question?.question_subtype} |{' '}
                  {question?.category.name} → {question?.section.name}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded font-semibold">
                Intentos: {attemptCount}
              </div>
              <button
                onClick={() => setAttemptCount(0)}
                className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
              >
                🔄 Reset Intentos
              </button>
              <button
                onClick={resetQuestion}
                className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
              >
                🔄 Reset
              </button>
              <a
                href="/auxiliar-administrativo-estado/test"
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                🏠 Tests
              </a>
            </div>
          </div>
        </div>
      </div>

      {showResult && verifiedCorrectAnswer !== null && (
        <div className="bg-white border-b">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="text-center">
              <div
                className={`inline-flex items-center px-4 py-2 rounded-lg ${
                  selectedAnswer === verifiedCorrectAnswer
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {selectedAnswer === verifiedCorrectAnswer ? (
                  <>
                    <span className="text-2xl mr-2">✅</span>
                    <span className="font-semibold">¡Correcto!</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl mr-2">❌</span>
                    <span className="font-semibold">
                      Incorrecto. La respuesta correcta es:{' '}
                      {LETTERS[verifiedCorrectAnswer]}){' '}
                      {question?.options[LETTERS[verifiedCorrectAnswer]]}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">{renderQuestion()}</div>

      <div className="bg-gray-100 border-t">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h3 className="font-bold text-gray-900 mb-3">Información técnica:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <strong>Categoría:</strong> {question?.category.key}
              <br />
              <strong>Sección:</strong> {question?.section.key}
              <br />
              <strong>Tipo:</strong> {question?.question_subtype}
            </div>
            <div>
              <strong>Creada:</strong>{' '}
              {question?.created_at
                ? new Date(question.created_at).toLocaleString()
                : '—'}
              <br />
              <strong>URL de prueba:</strong>{' '}
              <code>/debug/question/{question?.id}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
