// components/v2/ExamLayoutV2.tsx
// Modo Examen - Todas las preguntas visibles, corrección al final
// Versión TypeScript
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

// Tipos
import type {
  ExamLayoutV2Props,
  ExamQuestion,
  ExamValidationResponse,
  ExamValidationResult
} from './types'
import { getMotivationalMessage, isLegalArticle } from './types'

// ============================================
// UTILIDADES
// ============================================

function formatElapsedTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function ExamLayoutV2({
  tema,
  testNumber = 1,
  config,
  questions,
  resumeTestId = null,
  initialAnswers = null,
  children
}: ExamLayoutV2Props) {
  // Auth
  const { user, loading: authLoading } = useAuth() as {
    user: { id: string; email?: string; user_metadata?: { full_name?: string } } | null
    loading: boolean
  }

  // Estado del examen
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>(initialAnswers || {})
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [startTime] = useState(Date.now())
  const [elapsedTime, setElapsedTime] = useState(0)

  // Estado de validación
  const [validatedResults, setValidatedResults] = useState<ExamValidationResponse | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  // Refs
  const sessionCreatedRef = useRef(false)
  const testSessionIdRef = useRef<string | null>(resumeTestId)

  // Calculos
  const totalQuestions = questions.length
  const answeredCount = Object.keys(userAnswers).length
  const correctCount = score
  const incorrectCount = answeredCount - score
  const blankCount = totalQuestions - answeredCount

  // Nota sobre 10 (cada 3 fallos restan 1 correcta)
  const puntosBrutos = correctCount - (incorrectCount / 3)
  const notaSobre10 = isSubmitted
    ? Math.max(0, (puntosBrutos / totalQuestions) * 10)
    : 0

  // Mensaje motivacional
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0]
  const motivationalData = getMotivationalMessage(notaSobre10, userName)

  // ============================================
  // EFECTOS
  // ============================================

  // Cronómetro
  useEffect(() => {
    if (isSubmitted) return

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [isSubmitted, startTime])

  // Inicializar sesión de examen
  useEffect(() => {
    if (authLoading || !questions.length || sessionCreatedRef.current) return

    sessionCreatedRef.current = true

    if (resumeTestId) {
      testSessionIdRef.current = resumeTestId
      console.log('🔄 Reanudando examen:', resumeTestId)
    } else {
      initializeExamSession()
    }
  }, [authLoading, questions.length, resumeTestId])

  // ============================================
  // FUNCIONES
  // ============================================

  async function initializeExamSession() {
    try {
      // Crear sesión simple para tracking
      const sessionId = `exam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      testSessionIdRef.current = sessionId
      console.log('📝 Nueva sesión de examen:', sessionId)
    } catch (error) {
      console.error('Error inicializando sesión:', error)
    }
  }

  const handleAnswerSelect = useCallback((questionIndex: number, option: string) => {
    if (isSubmitted) return

    setUserAnswers(prev => ({
      ...prev,
      [questionIndex]: option
    }))
  }, [isSubmitted])

  const handleSubmitExam = useCallback(async () => {
    if (isValidating) return

    setIsValidating(true)
    console.log('🔒 Enviando examen para validación...')

    try {
      // Preparar respuestas para la API
      const answersForApi = questions.map((question, index) => ({
        questionId: question.id,
        userAnswer: userAnswers[index] || null
      }))

      const response = await fetch('/api/exam/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersForApi })
      })

      const apiResult: ExamValidationResponse = await response.json()

      if (!apiResult.success) {
        console.error('Error validando examen:', apiResult.error)
        setIsSubmitted(true)
        setIsValidating(false)
        return
      }

      // Guardar resultados validados
      setValidatedResults(apiResult)
      setScore(apiResult.summary.totalCorrect)
      setIsSubmitted(true)

      console.log(`✅ Examen validado: ${apiResult.summary.totalCorrect}/${totalQuestions}`)

      // Scroll al inicio para ver resultados
      window.scrollTo({ top: 0, behavior: 'smooth' })

    } catch (error) {
      console.error('Error en validación:', error)
    } finally {
      setIsValidating(false)
    }
  }, [questions, userAnswers, totalQuestions, isValidating])

  // ============================================
  // RENDER: CARGANDO
  // ============================================

  if (authLoading || !questions.length) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400 text-sm">Cargando examen...</p>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER PRINCIPAL
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-3 py-6">

        {/* HEADER */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6 mb-6">
          <div className="mb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
              📝 Modo Examen
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {config.name || `Tema ${tema}`} - {totalQuestions} preguntas
            </p>
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Cronómetro */}
            <div className="text-center px-3 py-3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg">
              <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">
                ⏱️ Tiempo
              </div>
              <div className="text-xl sm:text-2xl font-bold text-purple-700 dark:text-purple-300 font-mono">
                {formatElapsedTime(elapsedTime)}
              </div>
            </div>

            {/* Respondidas */}
            <div className="text-center px-3 py-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
                📝 Respondidas
              </div>
              <div className="text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-300">
                {answeredCount}/{totalQuestions}
              </div>
            </div>
          </div>

          {/* Barra de progreso */}
          {!isSubmitted && (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
              />
            </div>
          )}

          {/* RESULTADOS (después de corregir) */}
          {isSubmitted && (
            <div className="relative">
              {/* Nota destacada */}
              <div className={`bg-gradient-to-r ${motivationalData.bgColor} border-2 ${motivationalData.borderColor} rounded-xl p-6 mb-6`}>
                <div className="text-center mb-4">
                  <div className="text-6xl mb-3 animate-bounce">
                    {motivationalData.emoji}
                  </div>
                  <div className={`text-3xl sm:text-4xl font-bold ${motivationalData.color} mb-4`}>
                    {motivationalData.message}
                  </div>
                  <div className={`text-6xl font-bold ${motivationalData.color} mb-2`}>
                    {notaSobre10.toFixed(2)}
                  </div>
                  <div className="text-xl text-gray-700 dark:text-gray-300 font-medium">
                    sobre 10
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    (Cada 3 fallos restan 1 correcta)
                  </div>
                </div>

                {/* Tiempo empleado */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-purple-600 dark:text-purple-400 font-medium">
                      ⏱️ Tiempo empleado:
                    </span>
                    <span className="text-2xl font-bold text-purple-700 dark:text-purple-300 font-mono">
                      {formatElapsedTime(elapsedTime)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                    Promedio: {Math.round(elapsedTime / totalQuestions)}s por pregunta
                  </div>
                </div>
              </div>

              {/* Desglose de resultados */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
                    {correctCount}
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-300 font-medium">
                    ✅ Correctas
                  </div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-1">
                    {incorrectCount}
                  </div>
                  <div className="text-sm text-red-700 dark:text-red-300 font-medium">
                    ❌ Incorrectas
                  </div>
                  {incorrectCount > 0 && (
                    <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                      (-{(incorrectCount / 3).toFixed(2)} pts)
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-gray-600 dark:text-gray-300 mb-1">
                    {blankCount}
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-400 font-medium">
                    ⚪ En blanco
                  </div>
                </div>
              </div>

              {/* Botón volver */}
              <div className="text-center">
                <Link
                  href={tema && tema !== 0
                    ? `/auxiliar-administrativo-estado/test/tema/${tema}`
                    : '/auxiliar-administrativo-estado/test'
                  }
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  ← Volver a tests
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* LISTA DE PREGUNTAS */}
        <div className="space-y-6">
          {questions.map((question, index) => {
            const selectedOption = userAnswers[index]
            const validatedResult = validatedResults?.results?.[index]
            const correctOptionLetter = validatedResult?.correctAnswer || null
            const isCorrect = validatedResult?.isCorrect ?? false
            const showFeedback = isSubmitted && validatedResult

            return (
              <div
                key={index}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border-2 transition-all ${
                  showFeedback
                    ? isCorrect
                      ? 'border-green-500'
                      : selectedOption
                        ? 'border-red-500'
                        : 'border-gray-200 dark:border-gray-600'
                    : selectedOption
                      ? 'border-blue-500'
                      : 'border-gray-200 dark:border-gray-600'
                }`}
              >
                {/* Número y estado */}
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                    Pregunta {index + 1} de {totalQuestions}
                  </div>
                  {showFeedback && (
                    <div className={`text-sm font-bold ${
                      isCorrect
                        ? 'text-green-600 dark:text-green-400'
                        : selectedOption
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-400'
                    }`}>
                      {isCorrect ? '✅ Correcta' : selectedOption ? '❌ Incorrecta' : '⚪ No respondida'}
                    </div>
                  )}
                </div>

                {/* Texto de la pregunta */}
                <div className="mb-6">
                  <p className="text-lg text-gray-900 dark:text-gray-100 leading-relaxed">
                    {question.question_text}
                  </p>
                </div>

                {/* Opciones */}
                <div className="space-y-3">
                  {(['a', 'b', 'c', 'd'] as const).map(option => {
                    const optionKey = `option_${option}` as keyof ExamQuestion
                    const optionText = question[optionKey] as string
                    const isSelected = selectedOption === option
                    const isCorrectOption = option === correctOptionLetter

                    let buttonStyle = 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'

                    if (showFeedback) {
                      if (isCorrectOption) {
                        buttonStyle = 'border-green-500 bg-green-50 dark:bg-green-900/30'
                      } else if (isSelected && !isCorrect) {
                        buttonStyle = 'border-red-500 bg-red-50 dark:bg-red-900/30'
                      } else {
                        buttonStyle = 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                      }
                    } else if (isSelected) {
                      buttonStyle = 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    }

                    return (
                      <button
                        key={option}
                        onClick={() => handleAnswerSelect(index, option)}
                        disabled={isSubmitted}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${buttonStyle} ${
                          isSubmitted ? 'cursor-default' : 'cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start">
                          {/* Radio visual */}
                          <div className="flex items-center mr-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              showFeedback
                                ? isCorrectOption
                                  ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                                  : isSelected && !isCorrect
                                    ? 'border-red-500 bg-red-50 dark:bg-red-900/30'
                                    : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700'
                                : isSelected
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700'
                            }`}>
                              {isSelected && !showFeedback && (
                                <div className="w-2.5 h-2.5 rounded-full bg-white" />
                              )}
                              {showFeedback && isCorrectOption && (
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                              )}
                              {showFeedback && isSelected && !isCorrect && (
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                              )}
                            </div>
                          </div>
                          <span className="font-bold text-gray-700 dark:text-gray-300 mr-3">
                            {option.toUpperCase()})
                          </span>
                          <span className="text-gray-900 dark:text-gray-100 flex-1">
                            {optionText}
                          </span>
                          {showFeedback && isCorrectOption && (
                            <span className="ml-2 text-green-600 dark:text-green-400 font-bold">✓</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Explicación */}
                {showFeedback && question.explanation && (
                  <div className="mt-6 p-5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                    <div className="font-semibold text-blue-900 dark:text-blue-300 mb-3 text-base">
                      📖 Explicación:
                    </div>
                    <p className="text-blue-800 dark:text-blue-200 text-base leading-loose whitespace-pre-line">
                      {question.explanation}
                    </p>
                  </div>
                )}

                {/* Info del artículo */}
                {showFeedback && question.articles?.article_number && isLegalArticle(question.articles.laws?.short_name) && (
                  <div className="mt-4 text-sm text-blue-600 dark:text-blue-400">
                    📚 {question.articles.laws?.short_name} - Artículo {question.articles.article_number}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* BOTÓN CORREGIR */}
        {!isSubmitted && (
          <div className="mt-8 mb-8">
            <button
              onClick={handleSubmitExam}
              disabled={isValidating}
              className={`w-full py-4 rounded-lg font-bold text-white text-lg transition-colors shadow-lg ${
                isValidating
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isValidating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Corrigiendo...
                </span>
              ) : (
                `✅ Corregir Examen (${answeredCount}/${totalQuestions} respondidas)`
              )}
            </button>
          </div>
        )}

        {/* BOTÓN VOLVER (después de corregir) */}
        {isSubmitted && (
          <div className="mt-8 mb-8 text-center">
            <Link
              href={tema && tema !== 0
                ? `/auxiliar-administrativo-estado/test/tema/${tema}`
                : '/auxiliar-administrativo-estado/test'
              }
              className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-md"
            >
              {tema && tema !== 0 ? `← Volver al tema ${tema}` : '← Volver a tests'}
            </Link>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-4">
          <p className="text-xs text-gray-400">
            ExamLayoutV2 (TypeScript)
          </p>
        </div>
      </div>

      {children}
    </div>
  )
}
