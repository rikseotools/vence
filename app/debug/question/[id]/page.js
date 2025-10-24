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
import SequenceAlphanumericQuestion from '../../../../components/SequenceAlphanumericQuestion'

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

  const handleAnswer = (optionIndex) => {
    setSelectedAnswer(optionIndex)
    setShowResult(true)
    
    // Si es respuesta incorrecta, incrementar contador de intentos
    if (optionIndex !== question.correct_option) {
      setAttemptCount(prev => prev + 1)
    }
  }

  const resetQuestion = () => {
    setSelectedAnswer(null)
    setShowResult(false)
    // No reiniciar attemptCount para simular múltiples fallos
  }

  const renderQuestion = () => {
    if (!question) return null

    const questionProps = {
      question: question,
      onAnswer: handleAnswer,
      selectedAnswer: selectedAnswer,
      showResult: showResult,
      isAnswering: false,
      attemptCount: attemptCount
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
        return (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              {question.question_text}
            </h3>
            
            <div className="grid gap-4 mb-8">
              {['A', 'B', 'C', 'D'].map((letter, index) => {
                const optionText = question.options[letter]
                const isSelected = selectedAnswer === index
                const isCorrect = index === question.correct_option
                
                return (
                  <button
                    key={letter}
                    onClick={() => !showResult && handleAnswer(index)}
                    disabled={showResult}
                    className={`text-left p-4 rounded-lg border transition-all duration-200 ${
                      showResult
                        ? isCorrect
                          ? 'bg-green-100 border-green-500 text-green-800'
                          : isSelected
                            ? 'bg-red-100 border-red-500 text-red-800'
                            : 'bg-gray-50 border-gray-300 text-gray-600'
                        : isSelected
                          ? 'bg-blue-100 border-blue-500 text-blue-800'
                          : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="font-bold text-lg">{letter})</span>
                      <span className="flex-1">{optionText}</span>
                      {showResult && isCorrect && (
                        <span className="text-green-600">✓</span>
                      )}
                      {showResult && isSelected && !isCorrect && (
                        <span className="text-red-600">✗</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
            
            {showResult && question.explanation && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
                <h4 className="font-semibold text-blue-800 mb-2">📝 Explicación:</h4>
                <div 
                  className="text-blue-700 whitespace-pre-line"
                  dangerouslySetInnerHTML={{ __html: question.explanation.replace(/\n/g, '<br>') }}
                />
              </div>
            )}
          </div>
        )
      
      default:
        return (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center py-8">
              <p className="text-gray-600">
                Tipo de pregunta no soportado: {question.question_subtype}
              </p>
            </div>
          </div>
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
      {showResult && (
        <div className="bg-white border-b">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="text-center">
              <div className={`inline-flex items-center px-4 py-2 rounded-lg ${
                Number(selectedAnswer) === Number(question?.correct_option)
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {Number(selectedAnswer) === Number(question?.correct_option) ? (
                  <>
                    <span className="text-2xl mr-2">✅</span>
                    <span className="font-semibold">¡Correcto!</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl mr-2">❌</span>
                    <span className="font-semibold">
                      Incorrecto. La respuesta correcta es: 
                      {question?.correct_answer}) {question?.options[question?.correct_answer]}
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