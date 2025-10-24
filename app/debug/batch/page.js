'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BarChartQuestion from '../../../components/BarChartQuestion'
import PieChartQuestion from '../../../components/PieChartQuestion'
import DataTableQuestion from '../../../components/DataTableQuestion'
import LineChartQuestion from '../../../components/LineChartQuestion'
import MixedChartQuestion from '../../../components/MixedChartQuestion'
import ErrorDetectionQuestion from '../../../components/ErrorDetectionQuestion'
import WordAnalysisQuestion from '../../../components/WordAnalysisQuestion'
import SequenceNumericQuestion from '../../../components/SequenceNumericQuestion'
import SequenceLetterQuestion from '../../../components/SequenceLetterQuestion'

export default function BatchDebugPage() {
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [attemptCount, setAttemptCount] = useState(0)
  const router = useRouter()

  // 🔄 ACTUALIZAR ESTOS IDs PARA CADA NUEVO LOTE
  const currentBatch = {
    name: "Series de Letras - P02-P16 - 13 preguntas",
    startNumber: 2,
    questionIds: [
      '99bafb9a-b091-4ca9-85e6-a914a0bda188',  // P02: En un abecedario donde no se tienen en cuenta las letras dobles... (B=M)
      '6bb7b707-f6ef-44b9-892a-dfd2ca1ed82b',  // P03: Continúe la siguiente serie de letras: a j c l e n g o i ? (A=q)
      'f4cd4939-fa46-47b7-a4ec-76612db865d6',  // P04: Indique qué letra continúa cada serie... C-C-D-E-E-E-F-G-G-G-H-? (C=I)
      '196ed971-d48c-4678-9cdf-2a61b8931164',  // P05: Indique la opción que continúa la serie: C-G-K-Ñ-¿? (C=R)
      'ce88154b-db5e-43e7-ac0d-ca6df6b5928c',  // P06: Indique la opción que continúa la serie: I-K-N-Q-¿? (B=V)
      '60dffa89-afaf-4eee-911c-51d2a0578bfb',  // P07: Continúe con las dos letras... p-r-t; t-w-z; z-d-h; h-¿?-¿? (A=m-q)
      '236b3b39-3579-4e82-82c7-02d949b0fbe8',  // P08: ¿Qué letra continuaría la siguiente serie? h h i j l k n l o m ¿? (A=q)
      'ca20f537-6944-4f0d-8f6a-ec2e84f6fe0a',  // P09: Indique la letra que continúa... D Z V R Ñ ¿? (A=K)
      '83dbe8ca-3110-4f81-9da6-5f2ec160516c',  // P11: Indique qué letra continúa... M-W-M-N-W-M-N-Ñ-W-M-N-Ñ-O-W-? (B=M)
      '42f65f2d-e0ba-45e4-adbc-6c87f8af8e87',  // P12: Indique qué letra continúa... Z-X-U-Q-¿? (C=M)
      'b5285e55-4bd7-49bf-be3f-fa5055834b3c',  // P14: Indique qué letra continúa la serie... C-E-G-I-K-M-Ñ-? (A=P)
      'd1d3e097-e367-41fa-8470-6f34d84bae3f',  // P15: Indique la opción que continúa la serie: L-M-G-F-Ñ-O-E-¿? (B=D)
      '1c09dab3-bd1c-43de-ad6c-4298de195117'   // P16: En la siguiente serie, marque la letra... h i j h i j i h i j h i j ¿? (A=k)
    ]
  }

  useEffect(() => {
    async function fetchBatchQuestions() {
      try {
        // Fetch cada pregunta por su ID usando la API existente
        const questionPromises = currentBatch.questionIds.map(async (id) => {
          const response = await fetch(`/api/debug/question/${id}`)
          const data = await response.json()
          
          if (!response.ok) {
            console.warn(`Error fetching question ${id}:`, data.error)
            return null
          }
          
          return data.question
        })

        const batchQuestions = await Promise.all(questionPromises)
        const validQuestions = batchQuestions.filter(Boolean)
        
        setQuestions(validQuestions)
      } catch (err) {
        setError('Error inesperado: ' + err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchBatchQuestions()
  }, [])

  const currentQuestion = questions[currentIndex]
  const totalQuestions = questions.length

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      // Reset answer state when changing questions
      setSelectedAnswer(null)
      setShowResult(false)
      setAttemptCount(0)
    }
  }

  const goToNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1)
      // Reset answer state when changing questions
      setSelectedAnswer(null)
      setShowResult(false)
      setAttemptCount(0)
    }
  }

  const goToSpecificQuestion = (index) => {
    setCurrentIndex(index)
    // Reset answer state when changing questions
    setSelectedAnswer(null)
    setShowResult(false)
    setAttemptCount(0)
  }

  const handleAnswer = (optionIndex) => {
    setSelectedAnswer(optionIndex)
    setShowResult(true)
    
    // Si es respuesta incorrecta, incrementar contador de intentos
    const currentQuestion = questions[currentIndex]
    if (optionIndex !== currentQuestion.correct_option) {
      setAttemptCount(prev => prev + 1)
    }
  }

  const resetQuestion = () => {
    setSelectedAnswer(null)
    setShowResult(false)
    setAttemptCount(0)
  }

  const renderQuestion = () => {
    if (!currentQuestion) return null

    const questionProps = {
      question: currentQuestion,
      onAnswer: handleAnswer,
      selectedAnswer: selectedAnswer,
      showResult: showResult,
      isAnswering: false,
      attemptCount: attemptCount
    }

    switch (currentQuestion.question_subtype) {
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
      
      case 'text_question':
        return (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              {currentQuestion.question_text}
            </h3>
            
            <div className="grid gap-4 mb-8">
              {['A', 'B', 'C', 'D'].map((letter, index) => {
                const optionText = currentQuestion.options ? currentQuestion.options[letter] : currentQuestion[`option_${letter.toLowerCase()}`]
                const isSelected = selectedAnswer === index
                const isCorrect = index === currentQuestion.correct_option
                
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
            
            {showResult && currentQuestion.explanation && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
                <h4 className="font-semibold text-blue-800 mb-2">📝 Explicación:</h4>
                <div 
                  className="text-blue-700 whitespace-pre-line"
                  dangerouslySetInnerHTML={{ __html: currentQuestion.explanation.replace(/\n/g, '<br>') }}
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
                Tipo de pregunta no soportado: {currentQuestion.question_subtype}
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
          <p className="text-gray-600">Cargando lote de preguntas...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">❌ Error</div>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Volver
          </button>
        </div>
      </div>
    )
  }

  if (totalQuestions === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No se encontraron preguntas en este lote</p>
          <button 
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header con navegación */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Debug Batch</h1>
              <p className="text-gray-600">{currentBatch.name}</p>
              <p className="text-sm text-gray-500">
                Pregunta {currentIndex + 1} de {totalQuestions}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={goToPrevious}
                disabled={currentIndex === 0}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <span className="px-3 py-2 bg-blue-100 text-blue-800 rounded font-medium">
                {currentIndex + 1} / {totalQuestions}
              </span>
              <button
                onClick={goToNext}
                disabled={currentIndex === totalQuestions - 1}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navegación rápida por números */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {questions.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSpecificQuestion(index)}
                className={`w-12 h-10 rounded text-sm font-medium transition-colors ${
                  index === currentIndex
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {currentBatch.startNumber + index}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pregunta actual */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          {/* Info de debug */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <strong>ID:</strong> {currentQuestion.id}
              </div>
              <div>
                <strong>Componente:</strong> {currentQuestion.question_subtype}
              </div>
              <div>
                <strong>Número:</strong> {currentBatch.startNumber + currentIndex}
              </div>
              <div>
                <strong>Intentos:</strong> {attemptCount}
              </div>
              <div>
                <strong>Creado:</strong> {new Date(currentQuestion.created_at).toLocaleString('es-ES')}
              </div>
              <div className="md:col-span-2">
                <strong>Link individual:</strong>{' '}
                <a 
                  href={`/debug/question/${currentQuestion.id}`}
                  target="_blank"
                  className="text-blue-600 hover:underline"
                >
                  Abrir en nueva pestaña
                </a>
              </div>
            </div>
          </div>

          {/* Renderizar la pregunta */}
          {renderQuestion()}

          {/* Botón de reset si ya se respondió */}
          {showResult && (
            <div className="mt-6 text-center">
              <button
                onClick={resetQuestion}
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
              >
                🔄 Reiniciar Pregunta
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer con navegación */}
      <div className="bg-white border-t">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>←</span>
              <span>Anterior</span>
            </button>
            
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Pregunta {currentBatch.startNumber + currentIndex}
              </p>
              <p className="text-xs text-gray-500">
                {currentIndex + 1} de {totalQuestions} del lote
              </p>
            </div>

            <button
              onClick={goToNext}
              disabled={currentIndex === totalQuestions - 1}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Siguiente</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}