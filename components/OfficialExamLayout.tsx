// components/OfficialExamLayout.tsx - Examen Oficial (legislativo + psicotecnico)
'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext'

// Type for useAuth context (AuthContext is JS, so we type it manually)
interface AuthContextValue {
  user: { id: string; email?: string } | null
  supabase: ReturnType<typeof import('@supabase/supabase-js').createClient>
}
import ArticleModal from './ArticleModal'
import QuestionDispute from './QuestionDisputeFixed'
import PsychometricQuestionDispute from './v2/PsychometricQuestionDispute'

// Componentes psicotecnicos para renderizar content_data
import PieChartQuestion from './PieChartQuestion'
import DataTableQuestion from './DataTableQuestion'
import BarChartQuestion from './BarChartQuestion'
import LineChartQuestion from './LineChartQuestion'
import MixedChartQuestion from './MixedChartQuestion'
import ErrorDetectionQuestion from './ErrorDetectionQuestion'
import WordAnalysisQuestion from './WordAnalysisQuestion'
import SequenceNumericQuestion from './SequenceNumericQuestion'
import SequenceLetterQuestion from './SequenceLetterQuestion'
import SequenceAlphanumericQuestion from './SequenceAlphanumericQuestion'

// =====================================================
// TYPES
// =====================================================

type QuestionType = 'legislative' | 'psychometric'

type PsychometricSubtype =
  | 'pie_chart'
  | 'bar_chart'
  | 'line_chart'
  | 'data_tables'
  | 'mixed_chart'
  | 'error_detection'
  | 'word_analysis'
  | 'sequence_numeric'
  | 'sequence_letter'
  | 'sequence_alphanumeric'
  | 'synonym'
  | 'antonym'
  | 'text_question'
  | 'calculation'
  | 'percentage'
  | 'equation'

interface OfficialExamQuestion {
  id: string
  question: string
  questionText?: string
  options: string[]
  questionType: QuestionType
  questionSubtype?: PsychometricSubtype
  questionNumber?: number
  isReserva?: boolean
  articleNumber?: string | null
  lawName?: string | null
  explanation?: string | null
  difficulty?: string
  contentData?: Record<string, unknown> | null
}

interface ExamMetadata {
  examDate?: string
  legislativeCount?: number
  psychometricCount?: number
  reservaCount?: number
}

interface ExamConfig {
  examDate?: string
  backUrl?: string
  backText?: string
}

interface OfficialExamLayoutProps {
  questions: OfficialExamQuestion[]
  metadata?: ExamMetadata
  oposicion: string
  config?: ExamConfig
  // Props for resume functionality
  resumeTestId?: string
  initialAnswers?: Record<number, string>
}

interface ValidationResult {
  isCorrect: boolean
  correctAnswer: string
  correctIndex?: number
  explanation?: string | null
  userAnswer?: string | null
  questionType: QuestionType
}

interface ValidatedResults {
  results: (ValidationResult | null)[]
  summary: {
    totalCorrect: number
    totalIncorrect: number
    totalUnanswered: number
    percentage: number
  }
}

interface MotivationalMessage {
  emoji: string
  message: string
  color: string
  bgColor: string
  borderColor: string
}

// =====================================================
// HELPERS
// =====================================================

// Helper para convertir indice de respuesta a letra (0='A', 1='B', etc.)
function answerToLetter(index: number | null | undefined): string {
  if (index === null || index === undefined) return '?'
  const letters = ['A', 'B', 'C', 'D']
  return letters[index] || '?'
}

// Helper para convertir letra a indice
function letterToIndex(letter: string | null | undefined): number | null {
  if (!letter) return null
  const map: Record<string, number> = { 'a': 0, 'b': 1, 'c': 2, 'd': 3 }
  return map[letter.toLowerCase()] ?? null
}

// Funcion para obtener mensaje motivacional segun puntuacion
function getMotivationalMessage(notaSobre10: string, userName: string): MotivationalMessage {
  const nota = parseFloat(notaSobre10)
  const nombre = userName || 'alli'

  if (nota === 10) {
    return {
      emoji: '🏆',
      message: `PERFECTO, ${nombre}!`,
      color: 'text-yellow-600',
      bgColor: 'from-yellow-50 to-amber-50',
      borderColor: 'border-yellow-300'
    }
  } else if (nota >= 9) {
    return {
      emoji: '🎉',
      message: `EXCELENTE, ${nombre}!`,
      color: 'text-green-600',
      bgColor: 'from-green-50 to-emerald-50',
      borderColor: 'border-green-300'
    }
  } else if (nota >= 8) {
    return {
      emoji: '✨',
      message: `MUY BIEN, ${nombre}!`,
      color: 'text-green-600',
      bgColor: 'from-green-50 to-teal-50',
      borderColor: 'border-green-200'
    }
  } else if (nota >= 7) {
    return {
      emoji: '👏',
      message: `BIEN HECHO, ${nombre}!`,
      color: 'text-blue-600',
      bgColor: 'from-blue-50 to-indigo-50',
      borderColor: 'border-blue-200'
    }
  } else if (nota >= 6) {
    return {
      emoji: '💪',
      message: `BUEN INTENTO, ${nombre}!`,
      color: 'text-orange-600',
      bgColor: 'from-orange-50 to-amber-50',
      borderColor: 'border-orange-200'
    }
  } else if (nota >= 5) {
    return {
      emoji: '📚',
      message: `Sigue practicando, ${nombre}`,
      color: 'text-orange-500',
      bgColor: 'from-orange-50 to-yellow-50',
      borderColor: 'border-orange-200'
    }
  } else {
    return {
      emoji: '🎯',
      message: `No te rindas, ${nombre}!`,
      color: 'text-gray-600',
      bgColor: 'from-gray-50 to-slate-50',
      borderColor: 'border-gray-300'
    }
  }
}

// Formatear tiempo
function formatElapsedTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// =====================================================
// COMPONENT
// =====================================================

export default function OfficialExamLayout({
  questions,
  metadata,
  oposicion,
  config,
  // Resume props
  resumeTestId,
  initialAnswers
}: OfficialExamLayoutProps) {
  const { user, supabase } = useAuth() as AuthContextValue

  // Estados del examen
  // Initialize with saved answers if resuming
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>(initialAnswers || {})
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [startTime] = useState(Date.now())
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isSaving, setIsSaving] = useState(false)

  // Session state for resume functionality
  const [currentTestSession, setCurrentTestSession] = useState<{ id: string } | null>(
    resumeTestId ? { id: resumeTestId } : null
  )
  const sessionCreationRef = React.useRef(false)

  // Resultados validados por API
  const [validatedResults, setValidatedResults] = useState<ValidatedResults | null>(null)

  // Modal de articulo
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<{ number: string | null; lawSlug: string | null }>({ number: null, lawSlug: null })
  const [selectedQuestionForModal, setSelectedQuestionForModal] = useState<OfficialExamQuestion | null>(null)
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null)

  // Cronometro
  useEffect(() => {
    if (isSubmitted) return

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [isSubmitted, startTime])

  // Initialize exam session (for resume functionality)
  useEffect(() => {
    if (!user || !questions?.length) return

    // Prevent double initialization (React Strict Mode)
    if (sessionCreationRef.current) {
      console.log('⏭️ [OfficialExam] Session already initialized, skipping')
      return
    }

    sessionCreationRef.current = true

    // If resuming, we already have the testId
    if (resumeTestId) {
      console.log('🔄 [OfficialExam] Resuming existing exam:', resumeTestId)
      setCurrentTestSession({ id: resumeTestId })
      return
    }

    // Initialize new exam session
    initializeExamSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, questions?.length, resumeTestId])

  // Initialize exam session via API
  async function initializeExamSession(): Promise<void> {
    try {
      console.log('🎯 [OfficialExam] Initializing exam session')

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        console.error('❌ [OfficialExam] No auth token available')
        return
      }

      const examDate = metadata?.examDate || config?.examDate || new Date().toISOString().split('T')[0]

      // Check if there's already a pending test for this exam
      try {
        const pendingResponse = await fetch(`/api/v2/official-exams/pending`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const pendingResult = await pendingResponse.json()

        if (pendingResult.success && pendingResult.exams?.length > 0) {
          // Find a pending exam with the same date
          const existingExam = pendingResult.exams.find(
            (e: { examDate: string; oposicion: string }) =>
              e.examDate === examDate && e.oposicion === oposicion
          )
          if (existingExam) {
            console.log(`🔄 [OfficialExam] Found existing pending exam: ${existingExam.id}`)
            setCurrentTestSession({ id: existingExam.id })
            return
          }
        }
      } catch (pendingError) {
        console.warn('⚠️ [OfficialExam] Could not check pending exams:', pendingError)
      }

      // No existing pending exam, create new one
      console.log('🆕 [OfficialExam] Creating new exam session')

      // Prepare questions data for init API
      const questionsForInit = questions.map((q, index) => ({
        id: q.id,
        questionType: q.questionType,
        questionOrder: index + 1,
        questionText: q.question,
        questionSubtype: q.questionSubtype || null,
        contentData: q.contentData || null,
        articleNumber: q.articleNumber || null,
        lawName: q.lawName || null,
        difficulty: q.difficulty || null,
      }))

      const response = await fetch('/api/v2/official-exams/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          examDate,
          oposicion,
          questions: questionsForInit,
          metadata: {
            legislativeCount: metadata?.legislativeCount || 0,
            psychometricCount: metadata?.psychometricCount || 0,
            reservaCount: metadata?.reservaCount || 0,
          }
        })
      })

      const result = await response.json()

      if (result.success) {
        console.log(`✅ [OfficialExam] Session created: ${result.testId}, ${result.savedCount} questions`)
        setCurrentTestSession({ id: result.testId })
      } else {
        console.error('❌ [OfficialExam] Init failed:', result.error)
      }
    } catch (error) {
      console.error('❌ [OfficialExam] Init error:', error)
    }
  }

  // Manejar seleccion de respuesta (with auto-save for resume)
  function handleAnswerSelect(questionIndex: number, option: number | string): void {
    if (isSubmitted) return

    // Option puede ser un indice (0-3) o una letra ('a'-'d')
    const normalizedOption = typeof option === 'number'
      ? ['a', 'b', 'c', 'd'][option]
      : option.toLowerCase()

    // Update local state immediately for responsive UI
    setUserAnswers(prev => ({
      ...prev,
      [questionIndex]: normalizedOption
    }))

    // Auto-save to API for resume functionality (fire-and-forget)
    if (currentTestSession?.id) {
      saveAnswerToApi(currentTestSession.id, questionIndex, normalizedOption)
    }
  }

  // Save answer to API (non-blocking)
  async function saveAnswerToApi(testId: string, questionIndex: number, answer: string): Promise<void> {
    try {
      const response = await fetch('/api/v2/official-exams/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId,
          questionOrder: questionIndex + 1, // 1-indexed
          userAnswer: answer,
        })
      })

      const result = await response.json()

      if (result.success) {
        console.log(`💾 [OfficialExam] Answer ${questionIndex + 1} saved`)
      } else {
        console.error(`❌ [OfficialExam] Error saving answer ${questionIndex + 1}:`, result.error)
      }
    } catch (error) {
      console.error(`❌ [OfficialExam] Error saving answer ${questionIndex + 1}:`, error)
    }
  }

  // Corregir examen
  async function handleSubmitExam(): Promise<void> {
    console.log('🎯 [OfficialExam] Iniciando correccion de examen oficial')
    setIsSaving(true)

    try {
      // Separar preguntas por tipo
      const legislativeQuestions: { questionId: string; userAnswer: string | null; index: number }[] = []
      const psychometricQuestions: { questionId: string; userAnswer: number | null; index: number }[] = []

      questions.forEach((q, index) => {
        const answer = userAnswers[index]
        if (q.questionType === 'legislative') {
          legislativeQuestions.push({
            questionId: q.id,
            userAnswer: answer || null,
            index
          })
        } else {
          psychometricQuestions.push({
            questionId: q.id,
            userAnswer: answer ? letterToIndex(answer) : null,
            index
          })
        }
      })

      console.log(`📊 Legislative: ${legislativeQuestions.length}, Psychometric: ${psychometricQuestions.length}`)

      // Inicializar resultados
      const allResults: (ValidationResult | null)[] = new Array(questions.length).fill(null)
      let totalCorrect = 0

      // Validar preguntas legislativas via /api/exam/validate
      if (legislativeQuestions.length > 0) {
        console.log('🔒 Validando preguntas legislativas...')
        const legResponse = await fetch('/api/exam/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            answers: legislativeQuestions.map(q => ({
              questionId: q.questionId,
              userAnswer: q.userAnswer
            }))
          })
        })

        const legResult = await legResponse.json()

        if (legResult.success) {
          legResult.results.forEach((result: ValidationResult, i: number) => {
            const originalIndex = legislativeQuestions[i].index
            allResults[originalIndex] = {
              ...result,
              questionType: 'legislative'
            }
            if (result.isCorrect) totalCorrect++
          })
        } else {
          console.error('❌ Error validando legislativas:', legResult.error)
        }
      }

      // Validar preguntas psicotecnicas EN PARALELO via /api/answer/psychometric
      if (psychometricQuestions.length > 0) {
        console.log('🔒 Validando preguntas psicotecnicas en paralelo...')

        const psyPromises = psychometricQuestions.map(async (pq) => {
          try {
            const psyResponse = await fetch('/api/answer/psychometric', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                questionId: pq.questionId,
                userAnswer: pq.userAnswer
              })
            })

            const psyResult = await psyResponse.json()

            if (psyResult.success) {
              return {
                index: pq.index,
                result: {
                  isCorrect: psyResult.isCorrect,
                  correctAnswer: answerToLetter(psyResult.correctAnswer).toLowerCase(),
                  correctIndex: psyResult.correctAnswer,
                  explanation: psyResult.explanation,
                  userAnswer: pq.userAnswer !== null ? answerToLetter(pq.userAnswer).toLowerCase() : null,
                  questionType: 'psychometric' as const
                }
              }
            }
            return null
          } catch (err) {
            console.error('❌ Error validando psicotecnica:', pq.questionId, err)
            return null
          }
        })

        const psyResults = await Promise.all(psyPromises)

        psyResults.forEach(item => {
          if (item) {
            allResults[item.index] = item.result
            if (item.result.isCorrect) totalCorrect++
          }
        })
      }

      // Calcular estadisticas
      const answeredCount = Object.keys(userAnswers).length
      const incorrectCount = answeredCount - totalCorrect
      const percentage = Math.round((totalCorrect / questions.length) * 100)

      setValidatedResults({
        results: allResults,
        summary: {
          totalCorrect,
          totalIncorrect: incorrectCount,
          totalUnanswered: questions.length - answeredCount,
          percentage
        }
      })

      setScore(totalCorrect)
      setIsSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })

      console.log(`✅ Examen corregido: ${totalCorrect}/${questions.length} (${percentage}%)`)

      // Guardar sesion de test para estadisticas (solo usuarios logueados)
      if (user && supabase) {
        try {
          const totalTimeSeconds = Math.round((Date.now() - startTime) / 1000)
          const examDateFormatted = metadata?.examDate || config?.examDate || ''

          // Obtener token de autenticación
          const { data: sessionData } = await supabase.auth.getSession()
          const token = sessionData?.session?.access_token

          if (!token) {
            console.error('❌ No se pudo obtener token de autenticación')
            return
          }

          // Si hay una sesión existente (creada por init para resume), usar /complete
          // Si no hay sesión, usar /save-results (flujo antiguo)
          if (currentTestSession?.id) {
            console.log('🔄 [OfficialExam] Completando sesión existente:', currentTestSession.id)

            // Preparar resultados para /complete
            const resultsForComplete = questions.map((q, index) => {
              const result = allResults[index]
              const answer = userAnswers[index] || ''
              return {
                questionOrder: index + 1,
                isCorrect: result?.isCorrect || false,
                correctAnswer: result?.correctAnswer || '',
                userAnswer: answer,
                questionType: q.questionType || 'legislative',
              }
            })

            const completeResponse = await fetch('/api/v2/official-exams/complete', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                testId: currentTestSession.id,
                results: resultsForComplete,
                totalTimeSeconds,
              })
            })

            const completeResult = await completeResponse.json()

            if (completeResult.success) {
              console.log(`✅ Examen completado via /complete: ${completeResult.correctCount}/${completeResult.answeredCount} (${completeResult.score}%)`)
              // Notificar a UserAvatar para refrescar stats
              window.dispatchEvent(new Event('exam-completed'))
            } else {
              console.error('❌ Error completando examen:', completeResult.error)
            }
          } else {
            // Flujo antiguo: crear nuevo test via /save-results
            console.log('📝 [OfficialExam] Creando nueva sesión via save-results')

            // Preparar datos para la API v2
            const resultsForApi = questions.map((q, index) => {
              const result = allResults[index]
              const answer = userAnswers[index] || null
              return {
                questionId: q.id,
                questionType: q.questionType || 'legislative',
                userAnswer: answer || 'sin_respuesta',
                correctAnswer: result?.correctAnswer || 'unknown',
                isCorrect: result?.isCorrect || false,
                questionText: q.questionText || q.question || 'Pregunta sin texto',
                articleNumber: q.articleNumber || null,
                lawName: q.lawName || null,
                difficulty: q.difficulty || 'medium'
              }
            })

            // Llamar a API v2
            const response = await fetch('/api/v2/official-exams/save-results', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                examDate: examDateFormatted,
                oposicion: oposicion,
                results: resultsForApi,
                totalTimeSeconds,
                metadata: {
                  legislativeCount: metadata?.legislativeCount || 0,
                  psychometricCount: metadata?.psychometricCount || 0,
                  reservaCount: metadata?.reservaCount || 0
                }
              })
            })

            const apiResult = await response.json()

            if (apiResult.success) {
              const legCount = questions.filter(q => q.questionType === 'legislative').length
              const psyCount = questions.filter(q => q.questionType === 'psychometric').length
              console.log(`✅ Examen guardado via API v2: ${apiResult.questionsSaved} preguntas (${legCount} legislativas, ${psyCount} psicotécnicas)`)
              // Notificar a UserAvatar para refrescar stats
              window.dispatchEvent(new Event('exam-completed'))
            } else {
              console.error('❌ Error guardando via API v2:', apiResult.error)
            }
          }
        } catch (saveError) {
          console.error('❌ Error guardando sesion:', saveError)
        }
      }

    } catch (error) {
      console.error('❌ Error corrigiendo examen:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Abrir modal de articulo
  function openArticleModal(
    articleNumber: string | null | undefined,
    lawName: string | null | undefined,
    question: OfficialExamQuestion | null = null,
    questionIndex: number | null = null
  ): void {
    const lawSlug = lawName?.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-') || 'ley-desconocida'
    setSelectedArticle({ number: articleNumber || null, lawSlug })
    setSelectedQuestionForModal(question)
    setSelectedQuestionIndex(questionIndex)
    setModalOpen(true)
  }

  // Cerrar modal
  function closeArticleModal(): void {
    setModalOpen(false)
    setSelectedArticle({ number: null, lawSlug: null })
    setSelectedQuestionForModal(null)
    setSelectedQuestionIndex(null)
  }

  // Renderizar pregunta legislativa
  function renderLegislativeQuestion(question: OfficialExamQuestion, index: number): React.ReactElement {
    const selectedOption = userAnswers[index]
    const validatedResult = validatedResults?.results?.[index]
    const correctOptionLetter = validatedResult?.correctAnswer || null
    const isCorrect = validatedResult?.isCorrect ?? false
    const showFeedback = !!(isSubmitted && validatedResult)

    return (
      <div className="space-y-3">
        {(['a', 'b', 'c', 'd'] as const).map((option, optIndex) => {
          const optionText = question.options[optIndex]
          const isSelected = selectedOption === option
          const isCorrectOption = option === correctOptionLetter

          let buttonStyle = 'border-gray-300 bg-white hover:bg-gray-50'

          if (showFeedback) {
            if (isCorrectOption) {
              buttonStyle = 'border-green-500 bg-green-50'
            } else if (isSelected && !isCorrect) {
              buttonStyle = 'border-red-500 bg-red-50'
            } else {
              buttonStyle = 'border-gray-200 bg-gray-50'
            }
          } else if (isSelected) {
            buttonStyle = 'border-blue-500 bg-blue-50'
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
                <div className="flex items-center mr-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    showFeedback
                      ? isCorrectOption
                        ? 'border-green-500 bg-green-50'
                        : isSelected && !isCorrect
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-300 bg-white'
                      : isSelected
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300 bg-white'
                  }`}>
                    {isSelected && !showFeedback && (
                      <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                    )}
                    {showFeedback && isCorrectOption && (
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                    )}
                    {showFeedback && isSelected && !isCorrect && (
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                    )}
                  </div>
                </div>
                <span className="font-bold text-gray-700 mr-3">
                  {option.toUpperCase()})
                </span>
                <span className="text-gray-900 flex-1">
                  {optionText}
                </span>
                {showFeedback && isCorrectOption && (
                  <span className="ml-2 text-green-600 font-bold">✓</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  // Renderizar pregunta psicotecnica
  function renderPsychometricQuestion(question: OfficialExamQuestion, index: number): React.ReactElement {
    const selectedOption = userAnswers[index]
    const selectedIndex = selectedOption ? letterToIndex(selectedOption) : null
    const validatedResult = validatedResults?.results?.[index]
    const showFeedback = !!(isSubmitted && validatedResult)
    const verifiedCorrectAnswer = validatedResult?.correctIndex ?? null
    const verifiedExplanation = validatedResult?.explanation || question.explanation

    // Props comunes para componentes psicotecnicos
    const commonProps = {
      question: {
        id: question.id,
        question_text: question.question,
        option_a: question.options[0],
        option_b: question.options[1],
        option_c: question.options[2],
        option_d: question.options[3],
        content_data: question.contentData,
        explanation: question.explanation,
        question_subtype: question.questionSubtype
      },
      onAnswer: (optIndex: number) => handleAnswerSelect(index, optIndex),
      selectedAnswer: selectedIndex,
      showResult: showFeedback,
      isAnswering: false,
      attemptCount: 0,
      verifiedCorrectAnswer: verifiedCorrectAnswer,
      verifiedExplanation: verifiedExplanation,
      disabled: isSubmitted
    }

    // Renderizar segun subtipo
    switch (question.questionSubtype) {
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

      // Para tipos de texto (synonym, antonym, text_question, calculation, percentage, equation)
      default:
        return renderTextPsychometricQuestion(question, index, selectedIndex, showFeedback, verifiedCorrectAnswer, verifiedExplanation)
    }
  }

  // Renderizar pregunta psicotecnica de texto
  function renderTextPsychometricQuestion(
    question: OfficialExamQuestion,
    index: number,
    selectedIndex: number | null,
    showFeedback: boolean,
    verifiedCorrectAnswer: number | null,
    verifiedExplanation: string | null | undefined
  ): React.ReactElement {
    return (
      <div className="space-y-3">
        {(['A', 'B', 'C', 'D'] as const).map((letter, optIndex) => {
          const optionText = question.options[optIndex]
          const isSelected = selectedIndex === optIndex
          const isCorrectOption = showFeedback && verifiedCorrectAnswer !== null
            ? optIndex === verifiedCorrectAnswer
            : false

          return (
            <button
              key={letter}
              onClick={() => !isSubmitted && handleAnswerSelect(index, optIndex)}
              disabled={isSubmitted}
              className={`w-full text-left p-4 rounded-lg border transition-all duration-200 ${
                showFeedback
                  ? isCorrectOption
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
                {showFeedback && isCorrectOption && (
                  <span className="text-green-600">✓</span>
                )}
                {showFeedback && isSelected && !isCorrectOption && (
                  <span className="text-red-600">✗</span>
                )}
              </div>
            </button>
          )
        })}

        {/* Explicacion */}
        {showFeedback && verifiedExplanation && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
            <h4 className="font-semibold text-blue-800 mb-2">📝 Explicacion:</h4>
            <div
              className="text-blue-700 whitespace-pre-line"
              dangerouslySetInnerHTML={{ __html: verifiedExplanation.replace(/\n/g, '<br>') }}
            />
          </div>
        )}
      </div>
    )
  }

  // Calculos de resultados
  const totalQuestions = questions.length
  const answeredCount = Object.keys(userAnswers).length
  const correctCount = score
  const incorrectCount = answeredCount - score
  const blankCount = totalQuestions - answeredCount

  // Nota sobre 10 (cada 3 fallos restan 1 correcta)
  const puntosBrutos = correctCount - (incorrectCount / 3)
  const notaSobre10 = isSubmitted
    ? Math.max(0, (puntosBrutos / totalQuestions) * 10).toFixed(2)
    : '0'

  // Loading state
  if (!questions || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Cargando examen oficial...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-3 py-6">

        {/* HEADER DEL EXAMEN */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-6">
          {/* Titulo */}
          <div className="mb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              🏛️ Examen Oficial
            </h1>
            <p className="text-sm text-gray-600">
              {metadata?.examDate && (
                <>Convocatoria: {new Date(metadata.examDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</>
              )}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {totalQuestions} preguntas
              {metadata?.legislativeCount && metadata.legislativeCount > 0 && metadata?.psychometricCount && metadata.psychometricCount > 0 && (
                <> ({metadata.legislativeCount} legislativas, {metadata.psychometricCount} psicotecnicas)</>
              )}
            </p>
            {metadata?.reservaCount && metadata.reservaCount > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                <span>📋 {metadata.reservaCount} reservas</span>
              </p>
            )}
          </div>

          {/* Grid de metricas: Cronometro + Respondidas */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Cronometro */}
            <div className="text-center px-3 py-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="text-xs text-purple-600 font-medium mb-1">⏱️ Tiempo</div>
              <div className="text-xl sm:text-2xl font-bold text-purple-700 font-mono">
                {formatElapsedTime(elapsedTime)}
              </div>
            </div>

            {/* Respondidas */}
            <div className="text-center px-3 py-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-xs text-blue-600 font-medium mb-1">📝 Respondidas</div>
              <div className="text-xl sm:text-2xl font-bold text-blue-700">
                {answeredCount}/{totalQuestions}
              </div>
            </div>
          </div>

          {/* Barra de progreso */}
          {!isSubmitted && (
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="bg-amber-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
              ></div>
            </div>
          )}

          {/* Resultado despues de corregir */}
          {isSubmitted && (() => {
            const userName = (user as { user_metadata?: { full_name?: string }; email?: string })?.user_metadata?.full_name
              || (user as { email?: string })?.email?.split('@')[0]
              || ''
            const motivationalData = getMotivationalMessage(notaSobre10, userName)
            return (
              <div className="relative">
                {/* Nota destacada */}
                <div className={`relative bg-gradient-to-r ${motivationalData.bgColor} border-2 ${motivationalData.borderColor} rounded-xl p-6 mb-6`}>
                  <div className="text-center mb-4">
                    <div className="text-6xl mb-3 animate-bounce">
                      {motivationalData.emoji}
                    </div>
                    <div className={`text-3xl sm:text-4xl font-bold ${motivationalData.color} mb-4`}>
                      {motivationalData.message}
                    </div>

                    <div className={`text-6xl font-bold ${motivationalData.color} mb-2`}>
                      {notaSobre10}
                    </div>
                    <div className="text-xl text-gray-700 font-medium">
                      sobre 10
                    </div>
                    <div className="text-sm text-gray-500 mt-2">
                      (Cada 3 fallos restan 1 correcta)
                    </div>
                  </div>

                  {/* Tiempo empleado */}
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-purple-600 font-medium">⏱️ Tiempo empleado:</span>
                      <span className="text-2xl font-bold text-purple-700 font-mono">
                        {formatElapsedTime(elapsedTime)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 text-center mt-2">
                      Promedio: {Math.round(elapsedTime / totalQuestions)}s por pregunta
                    </div>
                  </div>
                </div>

                {/* Desglose de resultados */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-600 mb-1">
                      {correctCount}
                    </div>
                    <div className="text-sm text-green-700 font-medium">
                      ✅ Correctas
                    </div>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-red-600 mb-1">
                      {incorrectCount}
                    </div>
                    <div className="text-sm text-red-700 font-medium">
                      ❌ Incorrectas
                    </div>
                    {incorrectCount > 0 && (
                      <div className="text-xs text-red-600 mt-1">
                        (-{(incorrectCount / 3).toFixed(2)} pts)
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-gray-600 mb-1">
                      {blankCount}
                    </div>
                    <div className="text-sm text-gray-700 font-medium">
                      ⚪ En blanco
                    </div>
                  </div>
                </div>

                {/* Boton volver */}
                <div className="text-center">
                  <Link
                    href={config?.backUrl || '/auxiliar-administrativo-estado/test'}
                    className="inline-block px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    ← {config?.backText || 'Volver a Tests'}
                  </Link>
                </div>
              </div>
            )
          })()}
        </div>

        {/* LISTA DE PREGUNTAS */}
        <div className="space-y-6">
          {questions.map((question, index) => {
            const selectedOption = userAnswers[index]
            const validatedResult = validatedResults?.results?.[index]
            const isCorrect = validatedResult?.isCorrect ?? false
            const showFeedback = !!(isSubmitted && validatedResult)
            const isPsychometric = question.questionType === 'psychometric'

            return (
              <div
                key={question.id || index}
                className={`bg-white rounded-lg shadow-sm p-6 border-2 transition-all ${
                  showFeedback
                    ? isCorrect
                      ? 'border-green-500'
                      : selectedOption
                        ? 'border-red-500'
                        : 'border-gray-200'
                    : selectedOption
                      ? 'border-blue-500'
                      : 'border-gray-200'
                }`}
              >
                {/* Cabecera de pregunta */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-600">
                      Pregunta {question.questionNumber || index + 1}
                    </span>
                    {question.isReserva && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                        RESERVA
                      </span>
                    )}
                    {isPsychometric && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                        Psicotecnica
                      </span>
                    )}
                    {!isPsychometric && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                        Legislativa
                      </span>
                    )}
                  </div>
                  {showFeedback && (
                    <div className={`text-sm font-bold ${isCorrect ? 'text-green-600' : selectedOption ? 'text-red-600' : 'text-gray-400'}`}>
                      {isCorrect ? '✅ Correcta' : selectedOption ? '❌ Incorrecta' : '⚪ No respondida'}
                    </div>
                  )}
                </div>

                {/* Texto de la pregunta */}
                <div className="mb-6">
                  <p className="text-lg text-gray-900 leading-relaxed">
                    {question.question}
                  </p>
                </div>

                {/* Opciones de respuesta segun tipo */}
                {isPsychometric
                  ? renderPsychometricQuestion(question, index)
                  : renderLegislativeQuestion(question, index)
                }

                {/* Explicacion (solo despues de corregir, para legislativas) */}
                {showFeedback && !isPsychometric && question.explanation && (
                  <div className="mt-6 p-5 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="font-semibold text-blue-900 mb-3 text-base">📖 Explicacion:</div>
                    <p className="text-blue-800 text-base leading-loose whitespace-pre-line">
                      {validatedResult?.explanation || question.explanation}
                    </p>
                  </div>
                )}

                {/* Info del articulo (solo legislativas) */}
                {showFeedback && !isPsychometric && question.articleNumber && question.lawName && (
                  <button
                    onClick={() => openArticleModal(
                      question.articleNumber,
                      question.lawName,
                      question,
                      index
                    )}
                    className="mt-4 text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors flex items-center gap-1"
                  >
                    Ver 📚 {question.lawName} - Articulo {question.articleNumber}
                    <span className="text-xs">▸</span>
                  </button>
                )}

                {/* Botones de accion (solo despues de corregir) */}
                {showFeedback && (
                  <div className="flex flex-wrap gap-2 items-center mt-4">
                    {isPsychometric ? (
                      <PsychometricQuestionDispute
                        questionId={question.id}
                        user={user}
                        supabase={supabase}
                      />
                    ) : (
                      <QuestionDispute
                        questionId={question.id}
                        user={user}
                        supabase={supabase}
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* BOTON CORREGIR (si no esta corregido) */}
        {!isSubmitted && (
          <div className="mt-8 mb-8">
            <button
              onClick={handleSubmitExam}
              disabled={isSaving}
              className="w-full py-4 rounded-lg font-bold text-white text-lg transition-colors shadow-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
            >
              {isSaving ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Corrigiendo...
                </span>
              ) : (
                <>✅ Corregir Examen ({answeredCount}/{totalQuestions} respondidas)</>
              )}
            </button>
          </div>
        )}

        {/* BOTON VOLVER A TESTS (al final) */}
        {isSubmitted && (
          <div className="mt-8 mb-8 text-center">
            <Link
              href={config?.backUrl || '/auxiliar-administrativo-estado/test'}
              className="inline-block px-8 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-semibold shadow-md"
            >
              ← {config?.backText || 'Volver a Tests'}
            </Link>
          </div>
        )}
      </div>

      {/* MODAL DE ARTICULO */}
      <ArticleModal
        isOpen={modalOpen}
        onClose={closeArticleModal}
        articleNumber={selectedArticle.number}
        lawSlug={selectedArticle.lawSlug}
        questionText={selectedQuestionForModal?.question}
        correctAnswer={selectedQuestionIndex !== null ? validatedResults?.results?.[selectedQuestionIndex]?.correctIndex : null}
        options={selectedQuestionForModal?.options || null}
      />
    </div>
  )
}
