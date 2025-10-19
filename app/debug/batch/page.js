'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ChartQuestion from '../../../components/ChartQuestion'

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
    name: "Lote 8 - Preguntas 49-53",
    startNumber: 49,
    questionIds: [
      '9a64297f-fef9-414c-9ed9-8249a5b9d7ae', // Pregunta 49
      '3ae81962-e75a-4b9c-8926-f613487516a1', // Pregunta 50
      'ce347633-9ffb-43db-875a-8bfc6ea0a1f1', // Pregunta 51
      '173dc6e1-634c-4622-8b72-1aaea334480f', // Pregunta 52
      'ffe85d05-895c-4834-acc9-df8d44d0594e'  // Pregunta 53
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
          <ChartQuestion 
            question={currentQuestion}
            onAnswer={handleAnswer}
            selectedAnswer={selectedAnswer}
            showResult={showResult}
            isAnswering={false}
            attemptCount={attemptCount}
          />

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