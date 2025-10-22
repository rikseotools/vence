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
    name: "Lote Series Numéricas - 17 Preguntas (01-03, 05-19, sin 04 y 11)",
    startNumber: 1,
    questionIds: [
      'fb259e88-f01c-4105-885c-1e1da63d5b84', // 01: Continúa la siguiente serie numérica: 11, 11, 9, 9, 7, 7, ?
      '1bf0664e-3b99-4d82-94cf-79dfee0f6bf9', // 02: Dada la siguiente serie numérica, averigüe el valor de los interrogantes
      'cd274a48-9d61-4d02-9585-6b66d9af5772', // 03: Indique el número que continúa la serie: 1-3-5-7-9-11-?
      // Pregunta 04 está pendiente de identificar
      // Nuevo lote 2025-10-22
      'b2654a77-8b4a-4535-b9be-655af170f51a', // 05: Series intercaladas: 21, 26, 32, 37, 44, 49, 57, ?
      'b7af7b1a-cb01-4184-8a31-0f4ad037ab08', // 06: Series correlativas: 99, 96, 94, 91, 89, 86, ?
      '5c98f1cc-c5cc-4b4f-b344-95844f73e9e7', // 07: Series intercaladas: 1, 2, 1, 3, 1, 4, ?
      'e76317de-25c1-474f-8b5d-0a9fcd31877d', // 08: Series con fracciones: 12/6, 12/4, 12/3, 5, 12/2, 7, ?
      'de886620-1313-4f27-9eea-6ba7865474fc', // 09: Series correlativas: 6, 26, 44, 60, 74, 86, ?
      '70e9c3c1-ceaa-49a4-b26e-a0eb0b40799c', // 10: Series numéricas: 4, 11, 32, 95, ?
      // 'd3304f01-0296-419f-bd82-bab420e18a81', // 11: Series de letras: H, H, I, J, H, K, L, M, H, N, Ñ, O, ? (ELIMINADA)
      '98bf406b-1ae6-4566-831f-f5d766abe4a6', // 12: Series correlativas: 83, 84, 86, 89, 93, 98, ?
      '1a750bb9-6bb6-4092-b4db-c4cc09d8cf50', // 13: Series correlativas: 28, 27, 25, 22, 18, 13, ?
      '847f5bdd-1524-45e5-9a01-9f6603b7f4e5', // 14: Series intercaladas: 3, 2, 4, 2, 5, 2, ?
      '292ba6c3-1383-4ab1-aac9-44be32dcbbe6', // 15: Series cíclicas: 8, 10, 13, 17, 19, 22, 26, ?
      'a6695969-ab69-4b09-8c0f-00b3ad48d029', // 16: Series intercaladas: 9, 5, 7, 4, 5, 3, 3, 2, ?
      '6ce02744-c0a6-4718-94ce-a535b41e8124', // 17: Series numéricas: 2, 5, 10, 13, 26, 29, ?
      '3eb6143c-3e33-48a7-a8f0-ac50441e8c44', // 18: Series correlativas: 22, 44, 88, 176, 352, 704, ?
      '706bd23d-12b7-4326-b308-07d464126925'  // 19: Series correlativas: 5, 18, 33, 50, 69, 90, ?
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