'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import BarChartQuestion from '../../../../components/BarChartQuestion'
import PieChartQuestion from '../../../../components/PieChartQuestion'
import DataTableQuestion from '../../../../components/DataTableQuestion'
import LineChartQuestion from '../../../../components/LineChartQuestion'
import MixedChartQuestion from '../../../../components/MixedChartQuestion'
import ErrorDetectionQuestion from '../../../../components/ErrorDetectionQuestion'
import WordAnalysisQuestion from '../../../../components/WordAnalysisQuestion'
import SequenceNumericQuestion from '../../../../components/SequenceNumericQuestion'
import SequenceLetterQuestion from '../../../../components/SequenceLetterQuestion'
import MarkdownExplanation from '../../../../components/MarkdownExplanation'
import SequenceAlphanumericQuestion from '../../../../components/SequenceAlphanumericQuestion'
import ChartQuestion from '../../../../components/ChartQuestion'

export default function QuestionDebugPage() {
  const params = useParams()
  const [question, setQuestion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [attemptCount, setAttemptCount] = useState(0)
  const [categoryQuestions, setCategoryQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  // 🔒 SEGURIDAD: Respuesta verificada via API
  const [verifiedCorrectAnswer, setVerifiedCorrectAnswer] = useState(null)
  const [verifiedExplanation, setVerifiedExplanation] = useState(null)
  const [isAnswering, setIsAnswering] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchQuestion(params.id)
    }
  }, [params.id])

  const fetchQuestion = async (questionId) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/debug/question/${questionId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch question')
      }

      setQuestion(data.question)
      
      // Obtener todas las preguntas de la misma categoría
      await fetchCategoryQuestions(data.question.category_id, data.question.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategoryQuestions = async (categoryId, currentQuestionId) => {
    try {
      const response = await fetch(`/api/debug/category/${categoryId}/questions`)
      const data = await response.json()

      if (response.ok && data.questions) {
        setCategoryQuestions(data.questions)
        const index = data.questions.findIndex(q => q.id === currentQuestionId)
        setCurrentIndex(index >= 0 ? index : 0)
      }
    } catch (err) {
      console.error('Error fetching category questions:', err)
    }
  }

  const navigateToQuestion = (direction) => {
    if (categoryQuestions.length === 0) return
    
    let newIndex
    if (direction === 'next') {
      newIndex = currentIndex < categoryQuestions.length - 1 ? currentIndex + 1 : 0
    } else {
      newIndex = currentIndex > 0 ? currentIndex - 1 : categoryQuestions.length - 1
    }
    
    const newQuestionId = categoryQuestions[newIndex].id
    window.location.href = `/debug/question/${newQuestionId}`
  }

  // 🔒 SEGURIDAD: Validar respuesta via API
  const handleAnswer = async (optionIndex) => {
    if (isAnswering || showResult) return

    setIsAnswering(true)
    setSelectedAnswer(optionIndex)

    try {
      // Determinar qué API usar según el tipo de pregunta
      const apiEndpoint = question.question_type === 'psychometric'
        ? '/api/answer/psychometric'
        : '/api/answer'

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          userAnswer: optionIndex
        })
      })

      const result = await response.json()

      if (result.success) {
        setVerifiedCorrectAnswer(result.correctAnswer)
        setVerifiedExplanation(result.explanation)

        // Si es respuesta incorrecta, incrementar contador de intentos
        if (!result.isCorrect) {
          setAttemptCount(prev => prev + 1)
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

  const resetQuestion = () => {
    setSelectedAnswer(null)
    setShowResult(false)
    setVerifiedCorrectAnswer(null)
    setVerifiedExplanation(null)
    // No reiniciar attemptCount para simular múltiples fallos
  }

  const renderQuestion = () => {
    if (!question) return null

    // 🔒 SEGURIDAD: Pasar verifiedCorrectAnswer de API
    const questionProps = {
      question: question,
      onAnswer: handleAnswer,
      selectedAnswer: selectedAnswer,
      showResult: showResult,
      isAnswering: isAnswering,
      attemptCount: attemptCount,
      verifiedCorrectAnswer: verifiedCorrectAnswer,
      verifiedExplanation: verifiedExplanation
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
        // Usar ChartQuestion (mismo componente que producción) para TODOS los tipos de texto
        // Esto garantiza que debug renderiza exactamente igual que producción
        return <ChartQuestion {...questionProps} />
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
      {/* Header de Debug */}
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
                  ID: {question?.id} | Tipo: {question?.question_subtype} | 
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

      {/* Información de respuesta (solo después de contestar) */}
      {/* 🔒 SEGURIDAD: Usar verifiedCorrectAnswer de API */}
      {showResult && verifiedCorrectAnswer !== null && (
        <div className="bg-white border-b">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="text-center">
              <div className={`inline-flex items-center px-4 py-2 rounded-lg ${
                selectedAnswer === verifiedCorrectAnswer
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {selectedAnswer === verifiedCorrectAnswer ? (
                  <>
                    <span className="text-2xl mr-2">✅</span>
                    <span className="font-semibold">¡Correcto!</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl mr-2">❌</span>
                    <span className="font-semibold">
                      Incorrecto. La respuesta correcta es:
                      {['A', 'B', 'C', 'D'][verifiedCorrectAnswer]}) {question?.options[['A', 'B', 'C', 'D'][verifiedCorrectAnswer]]}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pregunta renderizada */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {renderQuestion()}
      </div>

      {/* Footer de información */}
      <div className="bg-gray-100 border-t">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h3 className="font-bold text-gray-900 mb-3">Información técnica:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <strong>Categoría:</strong> {question?.category.key}<br/>
              <strong>Sección:</strong> {question?.section.key}<br/>
              <strong>Tipo:</strong> {question?.question_subtype}
            </div>
            <div>
              <strong>Creada:</strong> {new Date(question?.created_at).toLocaleString()}<br/>
              <strong>URL de prueba:</strong> <code>/debug/question/{question?.id}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}