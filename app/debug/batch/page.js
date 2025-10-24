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
import SequenceAlphanumericQuestion from '../../../components/SequenceAlphanumericQuestion'

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
    name: "Series Alfanuméricas - Todas las 34 Preguntas",
    startNumber: 1,
    questionIds: [
      '5d86fbd9-f8d4-4fec-bcf3-e1cebcb17406',   // P01: Indique la letra o número que segui...
      'd44de2a3-d193-4f43-a674-e5db6fab70f0',   // P02: Según la serie: a=2, c=6; e=10, ¿Cu...
      'fea33f8c-a8f8-45a3-a519-358f18d64e51',   // P03: ¿Qué alternativa sustituiría a las ...
      '9ac560dc-a4a4-4394-ae46-6d2256dfb79a',   // P04: ¿Qué letra o número continuaría la ...
      '79ba10ad-f171-49a8-acb1-49a0fef691e0',   // P05: Cada una de las series que figuran ...
      '021042d2-f746-4144-9c5c-dafcaca7d131',   // P06: Indique la letra y/o número que con...
      '7e6495ea-72c4-4978-a0bc-2cfb4c03a4b1',   // P07: Indique la letra o número que segui...
      'c4adf0fa-4cef-4765-8218-5353592962f4',   // P08: En la siguiente serie, busque la le...
      '67f7503a-070e-4ee5-8953-d4f853af6c0a',   // P09: ¿Qué número o letra continuaría la ...
      'e91aeddf-327d-45f3-b548-5ade896c05a1',   // P10: Continúe con la letra o número que ...
      '42a13c78-3c83-4f7c-80f0-bd77ade3164e',   // P11: En la siguiente serie, indique el n...
      'e39311ed-ba7b-4c26-969e-265b9a160427',   // P12: Indique el número y/o la letra que ...
      '7288aa71-f0cb-46bb-b82c-1a9620b1dde2',   // P13: Continúe la siguiente serie con el ...
      '940fc3c5-315c-449a-9da2-57f9768a6745',   // P14: Indique el número y/o letra que deb...
      '10002be4-3620-49c9-8aed-0db1496060ba',   // P15: Indique el número o la letra que co...
      '4c10b304-9b36-4915-b99d-e3c603ea0139',   // P16: ¿Qué número y letra continuarían la...
      '0301cf19-bccd-48d5-b093-c345640c7af7',   // P17: ¿Qué letra o número tendría que con...
      'cc3c7690-2ed7-427f-940c-203ecab6e692',   // P18: Indique el número y/o letra que irí...
      '9a00528a-dd27-4175-9379-9cfebbcb71ec',   // P19: ¿Qué número y letra continuarían la...
      '54859ee1-8064-4c08-bfda-094c0684b563',   // P20: ¿Qué número y letra continuarían la...
      '5a1e110c-9683-4342-b796-9885c9073a38',   // P21: ¿Qué número y letra continuarían la...
      '3bdcfb85-a010-452d-be97-a8609a75f7ef',   // P22: ¿Qué número y letra continuarían la...
      'e3496297-3b81-4b6a-a762-1f4ce8286269',   // P23: Continúe la siguiente serie: B-19-Q...
      '79401026-2d69-4e46-ac4d-67f4dfe5a003',   // P24: En la serie que se le presenta, ind...
      'f5f98a6c-9e10-4502-8c26-0b3f468c6d6f',   // P25: En la siguiente serie, marque la le...
      '03e0dcb2-901a-4a13-bbb6-3402c283c390',   // P26: ¿Qué letra y número continuarían la...
      '72b8be19-7447-457e-8fff-0d6ff9f25950',   // P27: ¿Qué letra o número continúa la ser...
      '9391e032-ce46-4bfe-828d-fa5460ea3bcb',   // P28: ¿Qué número y/o letra habría que co...
      '30ae45ea-bd49-4a31-acfb-4579a53ddee0',   // P29: ¿Qué número y letra continuarían la...
      '379fc660-1d5b-46ba-9227-ed5a7677c902',   // P30: ¿Qué número y letra continuarían la...
      '9bef08e2-28a1-43f0-b25b-283f6f790662',   // P31: Indique el número y/o letra que cor...
      'ac5c1364-9d2f-4807-a979-5d59c5f4843a',   // P32: ¿Qué número y letra continuarían la...
      '732c355a-ad2f-480e-81ba-3d9c8557e536',   // P33: Marque la letra y/o número que cont...
      '04ec0ab8-cfe6-4fe6-8142-789c35d3c380'    // P34: ¿Qué letra o número seguiría el raz...
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
      
      case 'sequence_alphanumeric':
        return <SequenceAlphanumericQuestion {...questionProps} />
      
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