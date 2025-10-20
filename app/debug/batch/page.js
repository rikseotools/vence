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
    name: "Lote Ortografía - Preguntas 1-23",
    startNumber: 1,
    questionIds: [
      '6bbaddb7-49cb-404e-9d4b-d23a79ca89c7', // Pregunta 1
      '12a64e03-f9ba-4694-b797-43331089be17', // Pregunta 2
      'f84431da-aea0-46f6-96e9-d2f7e9d90f24', // Pregunta 3
      '06ec1285-47c8-4497-be97-947458dce4bf', // Pregunta 4
      '7d023583-cd28-46e9-9f4e-0385145dd6a7', // Pregunta 5
      '752f118f-2689-41b8-a39b-dadb22d0be8f', // Pregunta 6
      '9d0bc41a-c6cc-40f5-a565-48c53228fb15', // Pregunta 7
      '5a9cfb75-5639-479a-b70e-6764a0b7eef5', // Pregunta 8
      'b4689735-6aca-4e00-88f7-9813de427e30', // Pregunta 9
      '92187834-624c-4057-8127-840ad20ad4b0', // Pregunta 10
      '6d5351a1-39fb-4c4b-ba8b-61268bc97691', // Pregunta 11 (antes 12)
      '82087fbd-a314-4545-803b-3043ec40f60c', // Pregunta 12 (antes 13)
      '0cca1edb-3449-4067-abf6-8340e984df85', // Pregunta 13 (antes 14)
      'adea4c43-7fc4-49a3-98a1-4df539bde3c5', // Pregunta 14 (antes 15)
      'ad521f27-e74c-467a-9c64-fa60ee19377b', // Pregunta 15 (antes 16)
      'ea1c9b6d-88a8-4993-9ab9-31708b114f62', // Pregunta 16 (antes 17)
      'b3138eff-9163-46f3-8398-53bb38036f6f', // Pregunta 17 (antes 18)
      '58ed4b14-e676-4fc3-90ae-b9fc96f7ce32', // Pregunta 18 (antes 19)
      '2d23989c-d8ea-40f1-9a10-1079f15cad81', // Pregunta 19 (antes 20)
      '7d509265-3458-4868-9fa2-e4d29651c709', // Pregunta 20 (antes 21)
      'f6bbf2b9-df02-462c-b5e4-dface6b0b6a4', // Pregunta 21 (antes 22)
      'ab657fc5-5e48-4289-8551-63ceb6c3bb2d', // Pregunta 22 (antes 23)
      '806f1391-60e5-4381-a8d2-df2709ba0814'  // Pregunta 23 (antes 24)
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