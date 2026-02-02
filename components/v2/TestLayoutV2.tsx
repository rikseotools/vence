// components/v2/TestLayoutV2.tsx
// Versión TypeScript del componente TestLayout
// Usa Drizzle + Zod para type safety
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useQuestionContext } from '@/contexts/QuestionContext'
import MarkdownExplanation from '@/components/MarkdownExplanation'
import { useTestCompletion } from '@/hooks/useTestCompletion'
import { useDailyQuestionLimit } from '@/hooks/useDailyQuestionLimit'
import { useInteractionTracker } from '@/hooks/useInteractionTracker'

// Tipos
import type { TestLayoutV2Props, ValidateAnswerResult, DetailedAnswer, AnsweredQuestion } from './types'
import { isLegalArticle, formatTemaName, NON_LEGAL_CONTENT } from './types'

// Hooks personalizados
import { useAnswerValidation } from './hooks/useAnswerValidation'

// Utilidades del test original (reutilizamos las existentes)
import { formatTime } from '@/utils/testAnalytics'

// Componentes adicionales
import QuestionDispute from '@/components/QuestionDispute'
import QuestionEvolution from '@/components/QuestionEvolution'
import ArticleDropdown from './ArticleDropdown'
import dynamic from 'next/dynamic'

// Carga dinámica del ShareQuestion para evitar problemas de SSR
const ShareQuestion = dynamic(() => import('@/components/ShareQuestion'), { ssr: false })

// Helper para convertir índice de respuesta a letra (0='A', 1='B', etc.)
function answerToLetter(index: number | null | undefined): string {
  if (index === null || index === undefined) return '?'
  const letters = ['A', 'B', 'C', 'D']
  return letters[index] || '?'
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function TestLayoutV2({
  tema,
  testNumber,
  config,
  questions,
  children
}: TestLayoutV2Props) {
  // Contextos
  const { user, loading: authLoading, supabase, isPremium } = useAuth() as {
    user: { id: string; email?: string } | null
    loading: boolean
    supabase: any
    isPremium: boolean
  }
  const { setQuestionContext, clearQuestionContext } = useQuestionContext()
  const { notifyTestCompletion } = useTestCompletion()
  const {
    hasLimit,
    isLimitReached,
    questionsToday,
    resetTime,
    showUpgradeModal,
    setShowUpgradeModal,
    recordAnswer
  } = useDailyQuestionLimit()

  // Hook de validación
  const { validateAnswer, isValidating } = useAnswerValidation()

  // 📊 Tracking de interacciones de usuario
  const { trackTestAction } = useInteractionTracker()

  // Estado básico del test
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [verifiedCorrectAnswer, setVerifiedCorrectAnswer] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [answeredQuestions, setAnsweredQuestions] = useState<AnsweredQuestion[]>([])
  const [detailedAnswers, setDetailedAnswers] = useState<DetailedAnswer[]>([])
  const [startTime] = useState(Date.now())

  // Tracking
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  const [interactionCount, setInteractionCount] = useState(0)

  // UI
  const [isExplicitlyCompleted, setIsExplicitlyCompleted] = useState(false)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true)
  const [showScrollFeedback, setShowScrollFeedback] = useState(false)
  const [showShareQuestion, setShowShareQuestion] = useState(false)

  // Generación automática de explicaciones
  const [generatedExplanation, setGeneratedExplanation] = useState<string | null>(null)
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false)

  // Anti-duplicados
  const [processingAnswer, setProcessingAnswer] = useState(false)

  // Refs
  const explanationRef = useRef<HTMLDivElement>(null)
  const questionHeaderRef = useRef<HTMLHeadingElement>(null)
  const pathname = usePathname()

  // Estado calculado
  const effectiveQuestions = questions
  const currentQ = effectiveQuestions?.[currentQuestion]
  const isTestCompleted = isExplicitlyCompleted ||
    (currentQuestion === effectiveQuestions?.length - 1 && showResult)

  // ============================================
  // EFECTOS
  // ============================================

  // Actualizar contexto de pregunta
  useEffect(() => {
    if (!currentQ) return

    setQuestionContext({
      id: currentQ.id,
      question_text: currentQ.question,
      option_a: currentQ.options[0],
      option_b: currentQ.options[1],
      option_c: currentQ.options[2],
      option_d: currentQ.options[3],
      correct: showResult ? verifiedCorrectAnswer : null,
      explanation: currentQ.explanation,
      law: currentQ.law_slug || currentQ.law_name || currentQ.article?.law_short_name || currentQ.article?.law_name,
      article_number: currentQ.article_number || currentQ.article?.number || currentQ.article?.article_number,
      difficulty: currentQ.difficulty,
      source: currentQ.exam_source
    })

    return () => clearQuestionContext()
  }, [currentQ, showResult, verifiedCorrectAnswer, setQuestionContext, clearQuestionContext])

  // Auto-scroll a explicación
  useEffect(() => {
    if (showResult && autoScrollEnabled && explanationRef.current) {
      setTimeout(() => {
        explanationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [showResult, autoScrollEnabled])

  // ============================================
  // HANDLERS
  // ============================================

  // Toggle auto-scroll
  const toggleAutoScroll = useCallback(() => {
    setAutoScrollEnabled(prev => !prev)
    setShowScrollFeedback(true)
    setTimeout(() => setShowScrollFeedback(false), 2000)
  }, [])

  const handleAnswerClick = useCallback(async (answerIndex: number) => {
    // Prevenir múltiples clicks
    if (showResult || processingAnswer || isValidating) return
    if (selectedAnswer === answerIndex) return

    setSelectedAnswer(answerIndex)
    setInteractionCount(prev => prev + 1)
    setProcessingAnswer(true)

    // 📊 Tracking de interacción
    trackTestAction('answer_selected', currentQ?.id, {
      answerIndex,
      questionIndex: currentQuestion,
      timeToDecide: Date.now() - questionStartTime,
      isChange: selectedAnswer !== null
    })

    try {
      // Validar respuesta via API
      const result = await validateAnswer(currentQ?.id || '', answerIndex)

      // Actualizar estado
      setVerifiedCorrectAnswer(result.correctAnswer)
      setShowResult(true)

      if (result.isCorrect) {
        setScore(prev => prev + 1)
      }

      // Guardar respuesta
      const timeSpent = Math.round((Date.now() - questionStartTime) / 1000)

      const newAnsweredQuestion: AnsweredQuestion = {
        question: currentQuestion,
        selectedAnswer: answerIndex,
        correct: result.isCorrect,
        timestamp: new Date().toISOString()
      }
      setAnsweredQuestions(prev => [...prev, newAnsweredQuestion])

      const newDetailedAnswer: DetailedAnswer = {
        questionIndex: currentQuestion,
        questionOrder: currentQuestion + 1,
        selectedAnswer: answerIndex,
        correctAnswer: result.correctAnswer,
        isCorrect: result.isCorrect,
        timeSpent,
        timestamp: new Date().toISOString(),
        questionData: currentQ ? {
          id: currentQ.id,
          question: currentQ.question,
          options: currentQ.options as string[],
          correct: result.correctAnswer,
          article: currentQ.article_number ? {
            number: currentQ.article_number,
            law_short_name: currentQ.law_slug ?? null
          } : null,
          metadata: null
        } : null,
        confidence: null,
        interactions: interactionCount
      }
      setDetailedAnswers(prev => [...prev, newDetailedAnswer])

      // Registrar para límite diario
      if (recordAnswer) {
        recordAnswer()
      }

      // Generar explicación automáticamente si no existe
      if (!currentQ?.explanation && currentQ?.id) {
        generateExplanationIfMissing(currentQ.id, currentQ.question, currentQ.options as string[], result.correctAnswer)
      }

    } catch (error) {
      console.error('Error validando respuesta:', error)
    } finally {
      setProcessingAnswer(false)
    }
  }, [
    showResult,
    processingAnswer,
    isValidating,
    selectedAnswer,
    currentQ,
    currentQuestion,
    questionStartTime,
    interactionCount,
    validateAnswer,
    recordAnswer
  ])

  // Handler para compartir rápido en redes sociales
  const handleQuickShare = useCallback((platform: string) => {
    if (!currentQ) return
    const questionText = encodeURIComponent(currentQ.question.substring(0, 100) + '...')
    const url = encodeURIComponent(window.location.href)
    const text = encodeURIComponent(`📚 Test de Oposiciones\n\n"${currentQ.question.substring(0, 100)}..."\n\n¿Cuál es la respuesta correcta?`)

    let shareUrl = ''
    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${text}%20${url}`
        break
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${url}&text=${text}`
        break
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`
        break
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`
        break
    }
    if (shareUrl) window.open(shareUrl, '_blank', 'width=600,height=400')
  }, [currentQ])

  // Función para generar explicación automáticamente si no existe
  const generateExplanationIfMissing = useCallback(async (
    questionId: string,
    questionText: string,
    options: string[],
    correctAnswer: number
  ) => {
    setIsGeneratingExplanation(true)
    try {
      const response = await fetch('/api/generate-explanation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          questionText,
          options,
          correctAnswer,
          articleNumber: currentQ?.article_number,
          lawName: currentQ?.law_name
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.explanation) {
          setGeneratedExplanation(data.explanation)
          console.log(`✅ Explicación ${data.source === 'generated' ? 'generada' : 'obtenida'} para pregunta`)
        }
      }
    } catch (error) {
      console.error('Error generando explicación:', error)
    } finally {
      setIsGeneratingExplanation(false)
    }
  }, [currentQ?.article_number, currentQ?.law_name])

  const handleNextQuestion = useCallback(() => {
    if (currentQuestion < effectiveQuestions.length - 1) {
      // 📊 Tracking de navegación
      trackTestAction('navigation_next', effectiveQuestions[currentQuestion]?.id, {
        fromQuestion: currentQuestion,
        toQuestion: currentQuestion + 1,
        totalQuestions: effectiveQuestions.length
      })

      setCurrentQuestion(prev => prev + 1)
      setSelectedAnswer(null)
      setShowResult(false)
      setVerifiedCorrectAnswer(null)
      setQuestionStartTime(Date.now())
      setInteractionCount(0)
      setGeneratedExplanation(null) // Reset explicación generada

      // Scroll al header
      if (questionHeaderRef.current) {
        questionHeaderRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    } else {
      // 📊 Tracking de test completado
      trackTestAction('test_completed', null, {
        totalQuestions: effectiveQuestions.length,
        correctAnswers: score,
        accuracy: Math.round((score / effectiveQuestions.length) * 100),
        totalTimeMs: Date.now() - startTime,
        testType: tema ? 'tema' : 'general'
      })

      setIsExplicitlyCompleted(true)
      notifyTestCompletion?.()
    }
  }, [currentQuestion, effectiveQuestions, notifyTestCompletion, trackTestAction, score, startTime, tema])

  // ============================================
  // RENDER: CARGANDO
  // ============================================

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER: SIN PREGUNTAS
  // ============================================

  if (!questions || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg max-w-md">
          <div className="text-6xl mb-4">📭</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">No hay preguntas</h2>
          <p className="text-gray-600 mb-6">
            No se encontraron preguntas para este test.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER: TEST COMPLETADO
  // ============================================

  if (isTestCompleted) {
    const percentage = Math.round((score / effectiveQuestions.length) * 100)
    const totalTime = Math.round((Date.now() - startTime) / 1000)

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="text-6xl mb-4">
              {percentage >= 80 ? '🏆' : percentage >= 60 ? '👍' : '💪'}
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              ¡Test Completado!
            </h1>
            <p className="text-gray-600 mb-6">{config.name}</p>

            {/* Resultados */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-green-50 rounded-xl p-4">
                <div className="text-3xl font-bold text-green-600">{score}</div>
                <div className="text-sm text-green-700">Aciertos</div>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <div className="text-3xl font-bold text-red-600">
                  {effectiveQuestions.length - score}
                </div>
                <div className="text-sm text-red-700">Errores</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="text-3xl font-bold text-blue-600">{percentage}%</div>
                <div className="text-sm text-blue-700">Precisión</div>
              </div>
              <div className="bg-purple-50 rounded-xl p-4">
                <div className="text-3xl font-bold text-purple-600">
                  {formatTime(totalTime)}
                </div>
                <div className="text-sm text-purple-700">Tiempo</div>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/"
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
              >
                Volver al inicio
              </Link>
              <button
                onClick={() => window.location.reload()}
                className={`px-6 py-3 text-white rounded-lg transition font-medium bg-gradient-to-r ${config.color || 'from-blue-500 to-cyan-600'}`}
              >
                Repetir test
              </button>
            </div>

          </div>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER: TEST EN PROGRESO
  // ============================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className={`bg-gradient-to-r ${config.color || 'from-blue-500 to-cyan-600'} text-white py-4 px-4 shadow-lg`}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <span>{config.icon || '📝'}</span>
                <span>{config.name}</span>
              </h1>
              {config.subtitle && (
                <p className="text-sm opacity-90">{config.subtitle}</p>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{score}/{currentQuestion + (showResult ? 1 : 0)}</div>
              <div className="text-sm opacity-90">
                {effectiveQuestions.length - currentQuestion - (showResult ? 1 : 0)} restantes
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-4xl mx-auto py-6 px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Barra de progreso */}
          <div className="h-2 bg-gray-200 dark:bg-gray-700">
            <div
              className={`h-full bg-gradient-to-r ${config.color || 'from-blue-500 to-cyan-600'} transition-all duration-300`}
              style={{ width: `${((currentQuestion + (showResult ? 1 : 0)) / effectiveQuestions.length) * 100}%` }}
            />
          </div>

          {/* Botones de acción */}
          <div className="flex items-center gap-2 p-4 pb-0">
            {/* Botón "Volver a Tests" */}
            {!isTestCompleted && (
              <button
                onClick={() => {
                  if (config.customNavigationLinks?.backToLaw) {
                    window.location.href = config.customNavigationLinks.backToLaw.href
                  } else {
                    window.location.href = config.isLawTest ? '/leyes' : '/auxiliar-administrativo-estado/test'
                  }
                }}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm border border-gray-700"
              >
                <span>←</span>
                <span>{config.customNavigationLinks?.backToLaw?.text || 'Volver a Tests'}</span>
              </button>
            )}
            {/* Botón de configuración de scroll automático */}
            <div className="relative flex-1">
              <button
                onClick={toggleAutoScroll}
                title={autoScrollEnabled ? 'Desactivar scroll automático' : 'Activar scroll automático'}
                className={`w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm border ${
                  autoScrollEnabled
                    ? 'bg-blue-500 hover:bg-blue-600 text-white border-blue-600 hover:shadow-md'
                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                }`}
              >
                <span className="text-sm">{autoScrollEnabled ? '📜' : '🚫'}</span>
                <span>{autoScrollEnabled ? 'Auto-scroll' : 'No scroll'}</span>
              </button>
              {/* Feedback temporal */}
              {showScrollFeedback && (
                <div className={`absolute top-full mt-2 right-0 px-3 py-2 rounded-lg shadow-lg text-xs font-medium whitespace-nowrap z-50 ${
                  autoScrollEnabled
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-white'
                }`}>
                  {autoScrollEnabled
                    ? '✅ Scroll automático activado'
                    : '⏸️ No scroll al responder'}
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            {/* Info de pregunta */}
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Pregunta {currentQuestion + 1} de {effectiveQuestions.length}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-500">
                {Math.round(((currentQuestion + (showResult ? 1 : 0)) / effectiveQuestions.length) * 100)}%
              </span>
            </div>

            {/* Pregunta */}
            <div className="mb-6">
              <h2
                ref={questionHeaderRef}
                className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4"
              >
                Pregunta {currentQuestion + 1}
              </h2>
              <p className="text-lg text-gray-700 dark:text-gray-200 leading-relaxed">
                {currentQ?.question}
              </p>
            </div>

            {/* Opciones */}
            <div className="space-y-3 mb-6">
              {(currentQ?.options as string[] | undefined)?.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerClick(index)}
                  disabled={showResult || processingAnswer}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                    showResult && verifiedCorrectAnswer !== null
                      ? index === verifiedCorrectAnswer
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                        : index === selectedAnswer && selectedAnswer !== verifiedCorrectAnswer
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                        : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      : selectedAnswer === index
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-800 dark:text-gray-200'
                  } ${!showResult && !processingAnswer ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className="inline-flex items-center">
                    <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm font-bold mr-3 ${
                      showResult && verifiedCorrectAnswer !== null
                        ? index === verifiedCorrectAnswer
                          ? 'border-green-500 bg-green-500 text-white'
                          : index === selectedAnswer && selectedAnswer !== verifiedCorrectAnswer
                          ? 'border-red-500 bg-red-500 text-white'
                          : 'border-gray-300 dark:border-gray-500 text-gray-500 dark:text-gray-400'
                        : selectedAnswer === index
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-gray-300 dark:border-gray-500 text-gray-600 dark:text-gray-400'
                    }`}>
                      {String.fromCharCode(65 + index)}
                    </span>
                    {option}
                  </span>

                  {showResult && verifiedCorrectAnswer !== null && (
                    <span className="float-right text-lg">
                      {index === verifiedCorrectAnswer ? '✅' :
                       index === selectedAnswer && selectedAnswer !== verifiedCorrectAnswer ? '❌' : ''}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Botones rápidos A/B/C/D */}
            {!showResult && currentQ?.options && (
              <div className="flex justify-center space-x-4 mb-6">
                {currentQ.options.map((_, index) => (
                  <button
                    key={`quick-${index}`}
                    onClick={() => handleAnswerClick(index)}
                    disabled={processingAnswer}
                    className={`w-14 h-14 rounded-lg border-2 font-bold text-lg transition-all duration-200 ${
                      selectedAnswer === index
                        ? 'border-blue-600 bg-blue-600 text-white shadow-lg transform scale-110'
                        : 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-800/30 text-blue-700 dark:text-blue-300 hover:shadow-lg'
                    } ${processingAnswer ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {String.fromCharCode(65 + index)}
                  </button>
                ))}
              </div>
            )}

            {/* Sección de resultado */}
            {showResult && verifiedCorrectAnswer !== null && (
              <div ref={explanationRef} className="mt-6 border-t dark:border-gray-600 pt-6">
                {/* Box de resultado (Correcto/Incorrecto) */}
                <div className={`p-4 rounded-lg mb-4 ${
                  selectedAnswer === verifiedCorrectAnswer
                    ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700'
                    : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700'
                }`}>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-2xl">
                      {selectedAnswer === verifiedCorrectAnswer ? '🎉' : '😔'}
                    </span>
                    <span className={`font-bold ${
                      selectedAnswer === verifiedCorrectAnswer
                        ? 'text-green-800 dark:text-green-300'
                        : 'text-red-800 dark:text-red-300'
                    }`}>
                      {selectedAnswer === verifiedCorrectAnswer ? '¡Correcto!' : 'Incorrecto'}
                    </span>
                  </div>
                  <p className={`text-sm ${
                    selectedAnswer === verifiedCorrectAnswer
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}>
                    La respuesta correcta es: <strong>{String.fromCharCode(65 + verifiedCorrectAnswer)}</strong>
                  </p>
                </div>

                {/* Explicación - muestra original, generada, o estado de carga */}
                {(currentQ?.explanation || generatedExplanation || isGeneratingExplanation) && (
                  <div
                    className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-5 mb-5 select-none"
                    onCopy={(e) => e.preventDefault()}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    {/* Header con título y botón IA arriba a la derecha */}
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-blue-800 dark:text-blue-300 text-base">
                        📖 Explicación:
                        {generatedExplanation && !currentQ?.explanation && (
                          <span className="ml-2 text-xs font-normal bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                            ✨ Generada con IA
                          </span>
                        )}
                      </h4>
                      <button
                        onClick={() => {
                          const questionText = currentQ?.question_text || ''
                          const correctLetter = answerToLetter(verifiedCorrectAnswer)
                          window.dispatchEvent(new CustomEvent('openAIChat', {
                            detail: {
                              message: `Explícame por qué la respuesta correcta es "${correctLetter}" en la pregunta: "${questionText.substring(0, 100)}..."`,
                              suggestion: 'explicar_respuesta'
                            }
                          }))
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs font-medium"
                      >
                        <span>✨</span>
                        <span>No lo tengo claro</span>
                      </button>
                    </div>

                    {/* Estado de carga */}
                    {isGeneratingExplanation && !currentQ?.explanation && !generatedExplanation && (
                      <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent" />
                        <span className="text-sm">Generando explicación con IA...</span>
                      </div>
                    )}

                    {/* Contenido de la explicación */}
                    {(currentQ?.explanation || generatedExplanation) && (
                      <MarkdownExplanation
                        content={currentQ?.explanation || generatedExplanation || ''}
                        className="text-blue-700 dark:text-blue-400 text-sm"
                      />
                    )}

                    {/* Botón al final de la explicación */}
                    <button
                      onClick={() => {
                        const questionText = currentQ?.question_text || ''
                        const correctLetter = answerToLetter(verifiedCorrectAnswer)
                        window.dispatchEvent(new CustomEvent('openAIChat', {
                          detail: {
                            message: `Explícame por qué la respuesta correcta es "${correctLetter}" en la pregunta: "${questionText.substring(0, 100)}..."`,
                            suggestion: 'explicar_respuesta'
                          }
                        }))
                      }}
                      className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      <span>✨</span>
                      <span>Explícamelo mejor, no lo tengo claro</span>
                    </button>
                  </div>
                )}

                {/* Impugnar pregunta */}
                <QuestionDispute
                  questionId={currentQ?.id || ''}
                  user={user}
                  supabase={supabase}
                />

                {/* Botón siguiente (azul) y compartir */}
                {currentQuestion < effectiveQuestions.length - 1 ? (
                  <div className="space-y-3 mt-4">
                    <button
                      onClick={handleNextQuestion}
                      className={`w-full px-6 py-4 rounded-lg font-semibold text-white transition-all bg-gradient-to-r ${config.color || 'from-blue-500 to-cyan-600'} hover:opacity-90 shadow-lg hover:shadow-xl text-lg`}
                    >
                      Siguiente Pregunta → ({currentQuestion + 2}/{effectiveQuestions.length})
                    </button>

                    {/* Botones de compartir */}
                    <div className="flex justify-center items-center gap-3 pt-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Compartir:</span>
                      <button onClick={() => handleQuickShare('whatsapp')} className="p-1.5 rounded-full hover:bg-green-50 dark:hover:bg-green-900/30" title="WhatsApp">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </button>
                      <button onClick={() => handleQuickShare('telegram')} className="p-1.5 rounded-full hover:bg-cyan-50 dark:hover:bg-cyan-900/30" title="Telegram">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0088cc"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                      </button>
                      <button onClick={() => handleQuickShare('facebook')} className="p-1.5 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30" title="Facebook">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      </button>
                      <button onClick={() => handleQuickShare('twitter')} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700" title="X">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleNextQuestion}
                    className={`mt-4 w-full px-6 py-4 rounded-lg font-semibold text-white transition-all bg-gradient-to-r ${config.color || 'from-blue-500 to-cyan-600'} hover:opacity-90 shadow-lg hover:shadow-xl text-lg`}
                  >
                    Ver Resultados →
                  </button>
                )}

                {/* Tu evolución en esta pregunta */}
                {user && currentQ?.id && (
                  <QuestionEvolution
                    userId={user.id}
                    questionId={currentQ.id}
                    currentResult={{
                      is_correct: verifiedCorrectAnswer !== null && selectedAnswer === verifiedCorrectAnswer,
                      timeSpent: Math.round((Date.now() - questionStartTime) / 1000),
                      confidence: null
                    }}
                  />
                )}

                {/* Ver artículo completo desplegable (solo si hay full_text y es contenido legal) */}
                {(currentQ?.article as { full_text?: string })?.full_text &&
                 isLegalArticle(currentQ?.article?.law_short_name || currentQ?.law_slug) && (
                  <ArticleDropdown
                    article={{
                      article_number: currentQ.article_number || currentQ.article?.article_number,
                      display_number: currentQ.article?.number,
                      title: currentQ.article?.title,
                      full_text: (currentQ.article as { full_text?: string })?.full_text,
                      content: (currentQ.article as { content?: string })?.content,
                      law_short_name: currentQ.article?.law_short_name || currentQ.law_slug,
                    }}
                    currentQuestion={{
                      question: currentQ.question,
                      correct: verifiedCorrectAnswer ?? undefined,
                      options: currentQ.options as string[],
                    }}
                  />
                )}
              </div>
            )}

            {/* Loading indicator */}
            {processingAnswer && (
              <div className="flex justify-center items-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
                <span className="ml-3 text-gray-600 dark:text-gray-400">Validando respuesta...</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {children}
    </div>
  )
}
