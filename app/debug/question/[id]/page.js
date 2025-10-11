'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import BarChartQuestion from '../../../../components/BarChartQuestion'
import PieChartQuestion from '../../../../components/PieChartQuestion'
import DataTableQuestion from '../../../../components/DataTableQuestion'

export default function QuestionDebugPage() {
  const params = useParams()
  const [question, setQuestion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [showResult, setShowResult] = useState(false)

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
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = (optionIndex) => {
    setSelectedAnswer(optionIndex)
    setShowResult(true)
  }

  const resetQuestion = () => {
    setSelectedAnswer(null)
    setShowResult(false)
  }

  const renderQuestion = () => {
    if (!question) return null

    const questionProps = {
      question: question,
      onAnswer: handleAnswer,
      selectedAnswer: selectedAnswer,
      showResult: showResult,
      isAnswering: false
    }

    switch (question.question_subtype) {
      case 'bar_chart':
        return <BarChartQuestion {...questionProps} />
      
      case 'pie_chart':
        return <PieChartQuestion {...questionProps} />
      
      case 'data_tables':
        return <DataTableQuestion {...questionProps} />
      
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
            <div className="flex space-x-2">
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

      {/* Información de la pregunta */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Respuesta correcta:</strong> 
              <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded">
                {question?.correct_answer}) {question?.options[question?.correct_answer]}
              </span>
            </div>
            <div>
              <strong>Estado:</strong> 
              <span className={`ml-2 px-2 py-1 rounded ${
                question?.is_active 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {question?.is_active ? 'Activa' : 'Inactiva'}
              </span>
            </div>
          </div>
        </div>
      </div>

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