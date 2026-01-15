// components/v2/PsychometricTestLayoutV2.tsx
// Tests psicotécnicos - Versión TypeScript
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useQuestionContext } from '@/contexts/QuestionContext'

// Tipos
import type {
  PsychometricTestLayoutV2Props,
  PsychometricQuestion,
  PsychometricAnsweredQuestion,
  PsychometricValidationResult
} from './types'
import { PSYCHOMETRIC_SUBTYPE_NAMES } from './types'

// Componentes de preguntas especializados
import PieChartQuestion from '@/components/PieChartQuestion'
import DataTableQuestion from '@/components/DataTableQuestion'
import BarChartQuestion from '@/components/BarChartQuestion'
import LineChartQuestion from '@/components/LineChartQuestion'
import MixedChartQuestion from '@/components/MixedChartQuestion'
import ErrorDetectionQuestion from '@/components/ErrorDetectionQuestion'
import WordAnalysisQuestion from '@/components/WordAnalysisQuestion'
import SequenceNumericQuestion from '@/components/SequenceNumericQuestion'
import SequenceLetterQuestion from '@/components/SequenceLetterQuestion'
import SequenceAlphanumericQuestion from '@/components/SequenceAlphanumericQuestion'

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function PsychometricTestLayoutV2({
  categoria,
  config,
  questions
}: PsychometricTestLayoutV2Props) {
  // Auth
  const { user, supabase } = useAuth() as {
    user: { id: string } | null
    supabase: any
  }
  const { setQuestionContext, clearQuestionContext } = useQuestionContext()

  // Estado del test
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState(0)
  const [answeredQuestions, setAnsweredQuestions] = useState<PsychometricAnsweredQuestion[]>([])
  const [startTime] = useState(Date.now())
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  const [isTestCompleted, setIsTestCompleted] = useState(false)

  // Validación
  const [isAnswering, setIsAnswering] = useState(false)
  const [verifiedCorrectAnswer, setVerifiedCorrectAnswer] = useState<number | null>(null)
  const [verifiedExplanation, setVerifiedExplanation] = useState<string | null>(null)

  // Anti-duplicados
  const answeredQuestionsRef = useRef(new Set<string>())
  const sessionCreatedRef = useRef(false)
  const testSessionIdRef = useRef<string | null>(null)

  // Estado calculado
  const currentQ = questions[currentQuestion]
  const totalQuestions = questions.length

  // ============================================
  // EFECTOS
  // ============================================

  // Crear sesión de test
  useEffect(() => {
    if (!user || !questions.length || sessionCreatedRef.current) return

    sessionCreatedRef.current = true

    async function createSession() {
      try {
        const { data, error } = await supabase
          .from('psychometric_test_sessions')
          .insert({
            user_id: user!.id,
            category_id: questions[0].category_id,
            session_type: 'psychometric',
            total_questions: questions.length,
            questions_data: { question_ids: questions.map(q => q.id) },
            started_at: new Date().toISOString()
          })
          .select()
          .single()

        if (data) {
          testSessionIdRef.current = data.id
          console.log('✅ Sesión psicotécnica creada:', data.id)
        }
      } catch (error) {
        console.error('Error creando sesión:', error)
      }
    }

    createSession()
  }, [user, questions, supabase])

  // Actualizar contexto para chat AI
  useEffect(() => {
    if (!currentQ) return

    setQuestionContext({
      id: currentQ.id,
      question_text: currentQ.question_text,
      option_a: currentQ.option_a,
      option_b: currentQ.option_b,
      option_c: currentQ.option_c,
      option_d: currentQ.option_d,
      correct: showResult ? verifiedCorrectAnswer : null,
      explanation: currentQ.explanation,
      isPsicotecnico: true,
      questionSubtype: currentQ.question_subtype,
      questionTypeName: PSYCHOMETRIC_SUBTYPE_NAMES[currentQ.question_subtype] || currentQ.question_subtype,
      categoria: categoria,
      contentData: currentQ.content_data || null
    })

    return () => clearQuestionContext()
  }, [currentQuestion, currentQ, showResult, verifiedCorrectAnswer, setQuestionContext, clearQuestionContext, categoria])

  // ============================================
  // HANDLERS
  // ============================================

  const handleAnswer = useCallback(async (optionIndex: number) => {
    if (!currentQ || isAnswering || answeredQuestionsRef.current.has(currentQ.id)) {
      return
    }

    setIsAnswering(true)
    setSelectedAnswer(optionIndex)
    answeredQuestionsRef.current.add(currentQ.id)

    try {
      const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000)

      // Validar via API
      console.log('🔒 Validando respuesta psicotécnica via API...')

      const response = await fetch('/api/answer/psychometric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQ.id,
          userAnswer: optionIndex
        })
      })

      const apiResult: PsychometricValidationResult = await response.json()

      let isCorrect = false
      let correctAnswer: number | null = null

      if (apiResult.success) {
        isCorrect = apiResult.isCorrect
        correctAnswer = apiResult.correctAnswer
        setVerifiedCorrectAnswer(correctAnswer)
        setVerifiedExplanation(apiResult.explanation || currentQ.explanation || null)
        console.log('✅ Respuesta validada:', { isCorrect, correctAnswer })
      } else {
        console.error('Error en validación:', apiResult.error)
        setVerifiedCorrectAnswer(null)
        setVerifiedExplanation(null)
      }

      // Actualizar score
      if (isCorrect) {
        setScore(prev => prev + 1)
      }

      // Guardar respuesta
      const answeredQuestion: PsychometricAnsweredQuestion = {
        questionId: currentQ.id,
        questionText: currentQ.question_text,
        userAnswer: optionIndex,
        correctAnswer,
        isCorrect,
        timeSpent,
        timestamp: new Date().toISOString(),
        questionOrder: currentQuestion + 1
      }

      setAnsweredQuestions(prev => [...prev, answeredQuestion])

      // Guardar en BD si hay sesión
      if (testSessionIdRef.current && user) {
        await supabase.from('psychometric_test_answers').insert({
          test_session_id: testSessionIdRef.current,
          user_id: user.id,
          question_id: currentQ.id,
          question_order: currentQuestion + 1,
          user_answer: optionIndex,
          is_correct: isCorrect,
          time_spent_seconds: timeSpent,
          question_subtype: currentQ.question_subtype,
          created_at: new Date().toISOString()
        })

        // Actualizar progreso de sesión
        const newAnswered = currentQuestion + 1
        const newCorrect = answeredQuestions.filter(q => q.isCorrect).length + (isCorrect ? 1 : 0)

        await supabase
          .from('psychometric_test_sessions')
          .update({
            questions_answered: newAnswered,
            correct_answers: newCorrect,
            accuracy_percentage: Math.round((newCorrect / newAnswered) * 100)
          })
          .eq('id', testSessionIdRef.current)
      }

      setShowResult(true)

    } catch (error) {
      console.error('Error procesando respuesta:', error)
    } finally {
      setIsAnswering(false)
    }
  }, [currentQ, isAnswering, questionStartTime, currentQuestion, answeredQuestions, user, supabase])

  const handleNextQuestion = useCallback(() => {
    if (currentQuestion < totalQuestions - 1) {
      setCurrentQuestion(prev => prev + 1)
      setSelectedAnswer(null)
      setShowResult(false)
      setQuestionStartTime(Date.now())
      setVerifiedCorrectAnswer(null)
      setVerifiedExplanation(null)
    } else {
      completeTest()
    }
  }, [currentQuestion, totalQuestions])

  const completeTest = useCallback(async () => {
    if (testSessionIdRef.current && user) {
      await supabase
        .from('psychometric_test_sessions')
        .update({
          is_completed: true,
          correct_answers: score,
          accuracy_percentage: Math.round((score / totalQuestions) * 100),
          completed_at: new Date().toISOString()
        })
        .eq('id', testSessionIdRef.current)
    }

    setIsTestCompleted(true)
  }, [score, totalQuestions, user, supabase])

  // ============================================
  // RENDER: SIN PREGUNTAS
  // ============================================

  if (!questions.length) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">No hay preguntas disponibles</p>
      </div>
    )
  }

  // ============================================
  // RENDER: TEST COMPLETADO
  // ============================================

  if (isTestCompleted) {
    const accuracy = Math.round((score / totalQuestions) * 100)
    const testDuration = Math.round((Date.now() - startTime) / 1000)

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Test Psicotécnico Completado - {categoria.replace('-', ' ')}
            </h1>
          </div>
        </div>

        {/* Resultados */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-8 text-center">
            <div className="mb-6">
              <div className="text-6xl mb-4">
                {accuracy >= 80 ? '🎉' : accuracy >= 60 ? '👍' : '📚'}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                ¡Test Completado!
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                {accuracy >= 80 ? '¡Excelente resultado!' :
                 accuracy >= 60 ? '¡Buen trabajo!' :
                 'Sigue practicando'}
              </p>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {score}/{totalQuestions}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Preguntas Correctas
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {accuracy}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Precisión
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {Math.floor(testDuration / 60)}:{String(testDuration % 60).padStart(2, '0')}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Tiempo Total
                </div>
              </div>
            </div>

            {/* Botón volver */}
            <div className="flex justify-center">
              <Link
                href={config?.backUrl || "/auxiliar-administrativo-estado/test"}
                className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                {config?.backText || "Volver a Tests"}
              </Link>
            </div>

            <p className="text-xs text-gray-400 mt-6">
              PsychometricTestLayoutV2 (TypeScript)
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER: PREGUNTA
  // ============================================

  const renderQuestion = () => {
    if (!currentQ) return null

    const commonProps = {
      question: currentQ,
      onAnswer: handleAnswer,
      selectedAnswer,
      showResult,
      isAnswering,
      attemptCount: 0,
      verifiedCorrectAnswer,
      verifiedExplanation
    }

    switch (currentQ.question_subtype) {
      case 'pie_chart':
        return <PieChartQuestion {...commonProps} />
      case 'bar_chart':
        return <BarChartQuestion {...commonProps} />
      case 'line_chart':
        return <LineChartQuestion {...commonProps} />
      case 'data_tables':
        return <DataTableQuestion {...commonProps} />
      case 'mixed_chart':
        return <MixedChartQuestion {...commonProps} />
      case 'error_detection':
        return <ErrorDetectionQuestion {...commonProps} />
      case 'word_analysis':
        return <WordAnalysisQuestion {...commonProps} />
      case 'sequence_numeric':
        return <SequenceNumericQuestion {...commonProps} />
      case 'sequence_letter':
        return <SequenceLetterQuestion {...commonProps} />
      case 'sequence_alphanumeric':
        return <SequenceAlphanumericQuestion {...commonProps} />

      case 'text_question':
      default:
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
              {currentQ.question_text}
            </h3>

            <div className="grid gap-4 mb-8">
              {(['a', 'b', 'c', 'd'] as const).map((letter, index) => {
                const optionKey = `option_${letter}` as keyof PsychometricQuestion
                const optionText = currentQ[optionKey] as string
                const isSelected = selectedAnswer === index
                const isCorrectOption = showResult && verifiedCorrectAnswer !== null
                  ? index === verifiedCorrectAnswer
                  : false

                return (
                  <button
                    key={letter}
                    onClick={() => !showResult && handleAnswer(index)}
                    disabled={showResult || isAnswering}
                    className={`text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                      showResult
                        ? isCorrectOption
                          ? 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-800 dark:text-green-300'
                          : isSelected
                            ? 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-800 dark:text-red-300'
                            : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                        : isSelected
                          ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 text-blue-800 dark:text-blue-300'
                          : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="font-bold text-lg">{letter.toUpperCase()})</span>
                      <span className="flex-1">{optionText}</span>
                      {showResult && isCorrectOption && (
                        <span className="text-green-600 dark:text-green-400">✓</span>
                      )}
                      {showResult && isSelected && !isCorrectOption && (
                        <span className="text-red-600 dark:text-red-400">✗</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Explicación */}
            {showResult && verifiedExplanation && (
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-6 mt-6">
                <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
                  📝 Explicación:
                </h4>
                <p className="text-blue-700 dark:text-blue-200 whitespace-pre-line">
                  {verifiedExplanation}
                </p>
                {/* Botón para abrir IA */}
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('openAIChat', {
                      detail: {
                        message: `Explícame paso a paso cómo resolver esta pregunta psicotécnica: "${currentQ.question_text}"`,
                        suggestion: 'explicar_psico'
                      }
                    }))
                  }}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <span>✨</span>
                  <span>No lo tengo claro</span>
                </button>
              </div>
            )}
          </div>
        )
    }
  }

  // ============================================
  // RENDER PRINCIPAL
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href={config?.backUrl || "/auxiliar-administrativo-estado/test"}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-2"
              >
                ← {config?.backText || "Volver a Tests"}
              </Link>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                Test Psicotécnico - {categoria.replace('-', ' ')}
              </h1>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Pregunta {currentQuestion + 1} de {totalQuestions}
              </div>
              <div className="text-sm font-medium text-green-600 dark:text-green-400">
                {score} correctas
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-2">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestion + 1) / totalQuestions) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Pregunta */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {renderQuestion()}
      </div>

      {/* Botón siguiente */}
      {showResult && (
        <div className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 py-6">
          <div className="max-w-4xl mx-auto px-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-4">
              <button
                onClick={handleNextQuestion}
                className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-lg flex items-center justify-center gap-2"
              >
                {currentQuestion < totalQuestions - 1 ? (
                  <>
                    Siguiente Pregunta
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                ) : (
                  <>
                    Finalizar Test
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Espaciado inferior */}
      <div className="h-16" />
    </div>
  )
}
