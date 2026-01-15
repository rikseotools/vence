// components/v2/DynamicTestAi.tsx
// Componente para tests generados con IA - Versión TypeScript
'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

// Tipos
import type {
  DynamicTestAiProps,
  AITestData,
  AIGeneratedQuestion,
  AIAnsweredQuestion,
  DifficultyConfig
} from './types'
import { DIFFICULTY_CONFIGS } from './types'

// Hooks
import { useAnswerValidation } from './hooks/useAnswerValidation'

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function DynamicTestAi({
  titulo,
  dificultad,
  backUrl = '/'
}: DynamicTestAiProps) {
  // Auth
  const { isPremium } = useAuth() as { isPremium: boolean }

  // Hook de validación
  const { validateAnswer, isValidating } = useAnswerValidation()

  // Estado del test
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testData, setTestData] = useState<AITestData | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [verifiedCorrectAnswer, setVerifiedCorrectAnswer] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [answeredQuestions, setAnsweredQuestions] = useState<AIAnsweredQuestion[]>([])
  const [showReview, setShowReview] = useState(false)
  const [startTime] = useState(Date.now())

  // Configuración de dificultad
  const config: DifficultyConfig = DIFFICULTY_CONFIGS[dificultad] || DIFFICULTY_CONFIGS.alta

  // Estado calculado
  const currentQ = testData?.questions[currentQuestion]
  const isTestCompleted = currentQuestion === (testData?.questions.length ?? 0) - 1 && showResult
  const mistakes = answeredQuestions.filter(q => !q.correct)

  // ============================================
  // GENERAR TEST
  // ============================================

  const generateTest = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Generar o recuperar sessionId
      let sessionId = sessionStorage.getItem('testSessionId')
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        sessionStorage.setItem('testSessionId', sessionId)
      }

      const response = await fetch('/api/generate-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({
          titulo,
          dificultad,
          numPreguntas: 20
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al generar el test')
      }

      setTestData(data.test)

    } catch (err) {
      console.error('Error generating test:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [titulo, dificultad])

  useEffect(() => {
    generateTest()
  }, [generateTest])

  // ============================================
  // HANDLERS
  // ============================================

  const handleAnswerClick = useCallback(async (answerIndex: number) => {
    if (showResult || isValidating || !currentQ) return

    setSelectedAnswer(answerIndex)
    setShowResult(true)

    // Validar respuesta via API (con fallback local para tests IA)
    const result = await validateAnswer(
      currentQ.id || '',
      answerIndex,
      currentQ.correct // fallback para tests generados por IA
    )

    setVerifiedCorrectAnswer(result.correctAnswer)

    if (result.isCorrect) {
      setScore(prev => prev + 1)
    }

    setAnsweredQuestions(prev => [...prev, {
      question: currentQuestion,
      selectedAnswer: answerIndex,
      correct: result.isCorrect,
      questionData: { ...currentQ, verifiedCorrect: result.correctAnswer }
    }])
  }, [showResult, isValidating, currentQ, currentQuestion, validateAnswer])

  const handleNextQuestion = useCallback(() => {
    if (!testData) return

    if (currentQuestion < testData.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1)
      setSelectedAnswer(null)
      setShowResult(false)
      setVerifiedCorrectAnswer(null)
    }
  }, [currentQuestion, testData])

  const handleRestartTest = useCallback(() => {
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setVerifiedCorrectAnswer(null)
    setScore(0)
    setAnsweredQuestions([])
    setShowReview(false)
    generateTest()
  }, [generateTest])

  // Guardar resultados al completar
  useEffect(() => {
    if (isTestCompleted && testData) {
      const saveResults = async () => {
        try {
          const tiempoTotal = Math.round((Date.now() - startTime) / 1000)
          await fetch('/api/save-test-results', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              testId: testData.id,
              respuestas: answeredQuestions,
              score,
              tiempoTotal
            })
          })
        } catch (err) {
          console.error('Error saving results:', err)
        }
      }
      saveResults()
    }
  }, [isTestCompleted, testData, answeredQuestions, score, startTime])

  // ============================================
  // RENDER: CARGANDO
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-yellow-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center max-w-md">
          <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            Generando Test con IA
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Creando 20 preguntas únicas de dificultad {config.name} sobre {titulo}...
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Esto puede tomar 10-30 segundos
          </p>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER: ERROR
  // ============================================

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-yellow-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center max-w-md">
          <div className="text-4xl mb-4">❌</div>
          <h3 className="text-xl font-bold text-red-800 dark:text-red-400 mb-2">
            Error al Generar Test
          </h3>
          <p className="text-red-600 dark:text-red-300 mb-4">{error}</p>
          <button
            onClick={generateTest}
            className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition font-semibold"
          >
            Intentar de Nuevo
          </button>
        </div>
      </div>
    )
  }

  if (!testData || !currentQ) return null

  // ============================================
  // RENDER: REVISIÓN DE ERRORES
  // ============================================

  if (showReview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-yellow-50 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {mistakes.length === 0 ? (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-6 text-center">
              <div className="text-4xl mb-4">🎉</div>
              <h3 className="text-xl font-bold text-green-800 dark:text-green-300 mb-2">
                ¡Perfecto!
              </h3>
              <p className="text-green-700 dark:text-green-400">
                No has cometido ningún error en este test generado por IA.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                  Revisión de Errores ({mistakes.length}/{testData.questions.length})
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Preguntas generadas con IA - Revisa los errores para mejorar
                </p>
              </div>

              {mistakes.map((mistake, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-red-500"
                >
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-red-600 dark:text-red-400 font-semibold">
                        Pregunta {mistake.question + 1} - {config.name}
                      </span>
                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                        IA Generated
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                      {mistake.questionData.question}
                    </h4>
                  </div>

                  <div className="grid gap-3 mb-4">
                    {mistake.questionData.options.map((option, optIndex) => (
                      <div
                        key={optIndex}
                        className={`p-3 rounded-lg border-2 ${
                          optIndex === mistake.questionData.verifiedCorrect
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : optIndex === mistake.selectedAnswer
                            ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                            : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center mr-3 font-bold text-xs">
                              {String.fromCharCode(65 + optIndex)}
                            </span>
                            <span className="text-sm">{option}</span>
                          </div>
                          <span className="text-sm">
                            {optIndex === mistake.questionData.verifiedCorrect ? '✅ Correcta' :
                             optIndex === mistake.selectedAnswer ? '❌ Tu respuesta' : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
                    <h5 className="font-bold text-blue-800 dark:text-blue-300 mb-2">
                      Explicación de IA:
                    </h5>
                    <p className="text-blue-700 dark:text-blue-400 text-sm leading-relaxed">
                      {mistake.questionData.explanation}
                    </p>
                  </div>

                  {mistake.questionData.article && (
                    <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                      <h5 className="font-bold text-gray-800 dark:text-gray-200 mb-2 text-sm">
                        {mistake.questionData.article.number}
                      </h5>
                      <p className="text-gray-700 dark:text-gray-300 text-sm italic">
                        &ldquo;{mistake.questionData.article.text}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="text-center pt-6">
            <button
              onClick={() => setShowReview(false)}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              ← Volver a Resultados
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center mt-4">
            DynamicTestAi (TypeScript)
          </p>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER: TEST COMPLETADO
  // ============================================

  if (isTestCompleted) {
    const percentage = Math.round((score / testData.questions.length) * 100)

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-yellow-50 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">
              {percentage >= 80 ? '🏆' : percentage >= 60 ? '🎯' : '📚'}
            </div>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              ¡Test con IA Completado!
            </h2>

            <div className="text-6xl font-bold mb-4">
              <span className={
                percentage >= 80 ? 'text-green-600' :
                percentage >= 60 ? 'text-yellow-600' : 'text-red-600'
              }>
                {score}/{testData.questions.length}
              </span>
            </div>

            <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">
              {percentage >= 80 ? `¡Excelente dominio de nivel ${config.name}!` :
               percentage >= 60 ? `¡Buen nivel ${config.name}! Sigue practicando` :
               `Requiere más estudio en nivel ${config.name}`}
            </p>

            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
              <p className="text-blue-800 dark:text-blue-300 text-sm">
                <strong>Test Generado con IA:</strong> Cada pregunta fue creada dinámicamente
                usando inteligencia artificial.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={handleRestartTest}
                className={`bg-gradient-to-r ${config.color} text-white px-4 py-3 rounded-lg hover:opacity-90 transition font-semibold`}
              >
                Nuevo Test IA
              </button>
              <button
                onClick={() => setShowReview(true)}
                className="bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition font-semibold"
              >
                Ver Fallos ({mistakes.length})
              </button>
              <Link
                href={backUrl}
                className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition font-semibold block text-center"
              >
                Otros Tests
              </Link>
              <Link
                href="/"
                className="bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition font-semibold block text-center"
              >
                Inicio
              </Link>
            </div>

            <p className="text-xs text-gray-400 mt-6">
              DynamicTestAi (TypeScript)
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER: TEST EN PROGRESO
  // ============================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-yellow-50 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href={backUrl}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
            >
              ← Volver
            </Link>
            <div className="flex items-center space-x-4">
              <div className={`px-3 py-1 rounded-full text-white text-sm font-semibold bg-gradient-to-r ${config.color}`}>
                {config.icon} {config.name} - IA
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {currentQuestion + 1} de {testData.questions.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Barra de progreso */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Progreso</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {Math.round(((currentQuestion + (showResult ? 1 : 0)) / testData.questions.length) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className={`bg-gradient-to-r ${config.color} h-3 rounded-full transition-all duration-500`}
                style={{ width: `${((currentQuestion + (showResult ? 1 : 0)) / testData.questions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Pregunta */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {currentQ.question}
                </h2>
                <div className="flex items-center space-x-2">
                  <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded font-semibold">
                    IA Generated
                  </span>
                </div>
              </div>
            </div>

            {/* Opciones */}
            <div className="space-y-3 mb-8">
              {currentQ.options.map((option, index) => {
                let buttonClass = "w-full p-4 text-left rounded-lg border-2 transition-all duration-300 font-medium "

                if (showResult && verifiedCorrectAnswer !== null) {
                  if (index === verifiedCorrectAnswer) {
                    buttonClass += "border-green-500 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                  } else if (index === selectedAnswer) {
                    buttonClass += "border-red-500 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                  } else {
                    buttonClass += "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  }
                } else {
                  buttonClass += "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-800 dark:text-gray-200 cursor-pointer"
                }

                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerClick(index)}
                    disabled={showResult || isValidating}
                    className={buttonClass}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center mr-4 font-bold text-sm">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className="leading-relaxed">{option}</span>
                      </div>
                      {showResult && verifiedCorrectAnswer !== null && (
                        <span className="text-xl">
                          {index === verifiedCorrectAnswer ? '✅' :
                           index === selectedAnswer ? '❌' : ''}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Botones rápidos A/B/C/D */}
            {!showResult && (
              <div className="mb-6">
                <div className="flex justify-center space-x-4">
                  {currentQ.options.map((_, index) => (
                    <button
                      key={`quick-${index}`}
                      onClick={() => handleAnswerClick(index)}
                      disabled={isValidating}
                      className={`w-14 h-14 rounded-lg border-2 font-bold text-lg transition-all duration-200 ${
                        selectedAnswer === index
                          ? 'border-blue-600 bg-blue-600 text-white shadow-lg transform scale-110'
                          : 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-800/30 text-blue-700 dark:text-blue-300 hover:shadow-lg'
                      } ${isValidating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {String.fromCharCode(65 + index)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Resultado y explicación */}
            {showResult && verifiedCorrectAnswer !== null && (
              <div className="mb-8">
                <div className={`p-4 rounded-lg border-l-4 mb-4 ${
                  selectedAnswer === verifiedCorrectAnswer
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-500'
                    : 'bg-red-50 dark:bg-red-900/30 border-red-500'
                }`}>
                  <div className="flex items-center mb-2">
                    <span className="text-2xl mr-2">
                      {selectedAnswer === verifiedCorrectAnswer ? '🎉' : '😔'}
                    </span>
                    <span className={`font-bold text-lg ${
                      selectedAnswer === verifiedCorrectAnswer
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-red-700 dark:text-red-300'
                    }`}>
                      {selectedAnswer === verifiedCorrectAnswer ? '¡Correcto!' : 'Incorrecto'}
                    </span>
                    <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded">
                      IA
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {currentQ.explanation}
                  </p>
                </div>

                {currentQ.article && (
                  <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-6 mb-6">
                    <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-3 text-lg">
                      {currentQ.article.number}
                    </h4>
                    <p className="text-gray-800 dark:text-gray-200 leading-relaxed italic">
                      &ldquo;{currentQ.article.text}&rdquo;
                    </p>
                  </div>
                )}

                {currentQuestion < testData.questions.length - 1 && (
                  <div className="text-center">
                    <button
                      onClick={handleNextQuestion}
                      className={`bg-gradient-to-r ${config.color} text-white px-8 py-3 rounded-lg hover:opacity-90 transition font-semibold`}
                    >
                      Siguiente Pregunta →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Loading indicator */}
            {isValidating && (
              <div className="flex justify-center items-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-600 border-t-transparent" />
                <span className="ml-3 text-gray-600 dark:text-gray-400">Validando respuesta...</span>
              </div>
            )}

            {/* Score */}
            <div className="flex justify-between items-center pt-4 border-t dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Aciertos: <span className="font-bold text-green-600">{score}</span> / {answeredQuestions.length}
              </div>
              <p className="text-xs text-gray-400">
                DynamicTestAi (TypeScript)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
