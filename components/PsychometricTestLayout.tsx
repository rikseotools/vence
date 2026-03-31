'use client'
import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext'
import { useQuestionContext } from '../contexts/QuestionContext'
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
import PsychometricRegistrationManager from './PsychometricRegistrationManager'
import { useDailyGoal } from '../hooks/useDailyGoal'
import QuestionDispute from './QuestionDispute'
import PsychometricQuestionEvolution from './PsychometricQuestionEvolution'
import MarkdownExplanation from './MarkdownExplanation'
import PsychometricAIHelpButton from './PsychometricAIHelpButton'
import { getDifficultyInfo, formatDifficultyDisplay, isFirstAttempt, type DifficultyInfo } from '../lib/psychometricDifficulty'
import { useInteractionTracker } from '../hooks/useInteractionTracker'
import { validatePsychometricAnswer } from '@/lib/api/psychometric-answer/client'
import { useAnswerWatchdog } from '@/hooks/useAnswerWatchdog'
import { logClientError } from '@/lib/logClientError'

// ============================================
// TIPOS
// ============================================

interface PsychometricQuestion {
  id: string
  category_id: string
  question_text: string
  question_subtype: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option?: number // Opcional: NO se envía desde el servidor (seguridad anti-scraping)
  explanation?: string | null
  content_data: Record<string, unknown> | null
  question_type?: string
  [key: string]: unknown // campos adicionales de Supabase
}

interface TestConfig {
  backUrl?: string
  backText?: string
  testType?: string
  categories?: string[]
  [key: string]: unknown
}

interface ResumeData {
  sessionId: string
  questionsAnswered: number
  correctAnswers: number
  answeredQuestionIds: string[]
}

interface PsychometricTestLayoutProps {
  categoria: string
  config?: TestConfig | null
  questions: PsychometricQuestion[]
  resumeData?: ResumeData | null
}

interface DetailedAnswer {
  questionId: string
  questionText: string
  userAnswer: number
  correctAnswer: number | null
  isCorrect: boolean
  timeSpent: number
  timestamp: string
  questionOrder: number
}

interface TestSession {
  id: string
  [key: string]: unknown
}

interface SessionProgress {
  questionsAnswered: number
  correctAnswers: number
  accuracyPercentage: number
}

// SaveParams y ValidationResult types ahora vienen de lib/api/psychometric-answer/client

const SUBTYPE_NAMES: Record<string, string> = {
  'sequence_numeric': 'Serie numérica',
  'sequence_letter': 'Serie de letras',
  'sequence_alphanumeric': 'Serie alfanumérica',
  'pie_chart': 'Gráfico circular',
  'bar_chart': 'Gráfico de barras',
  'line_chart': 'Gráfico de líneas',
  'data_table': 'Tabla de datos',
  'data_tables': 'Tabla de datos',
  'mixed_chart': 'Gráfico mixto',
  'error_detection': 'Detección de errores',
  'word_analysis': 'Análisis de palabras',
  'text_question': 'Pregunta de texto',
  'calculation': 'Cálculo',
  'logic': 'Lógica',
  'synonym': 'Sinónimos',
  'antonym': 'Antónimos',
  'analogy': 'Analogía',
  'comprehension': 'Comprensión',
  'pattern': 'Patrón',
  'attention': 'Atención',
  'percentage': 'Porcentaje',
  'probability': 'Probabilidad',
  'definition': 'Definición',
  'classification': 'Clasificación',
  'alphabetical': 'Orden alfabético',
  'alphabetical_order': 'Orden alfabético',
  'code_equivalence': 'Equivalencia de códigos',
  'coding': 'Codificación'
}

// 🔒 Validación psicotécnica: usa lib/api/psychometric-answer/client.ts
// (timeout 10s, retry x2, Zod). Fallback local se mantiene en el componente.

export default function PsychometricTestLayout({
  categoria,
  config,
  questions,
  resumeData,
}: PsychometricTestLayoutProps) {
  const { user, supabase } = useAuth() as { user: { id: string; user_metadata?: Record<string, unknown> } | null; supabase: ReturnType<typeof import('@supabase/supabase-js').createClient> }
  const { setQuestionContext, clearQuestionContext } = useQuestionContext()

  // 📊 Meta diaria (registrar respuestas psicotécnicas)
  const { recordAnswerForGoal } = useDailyGoal()

  // 📊 Tracking de interacciones de usuario
  const { trackPsychometricAction } = useInteractionTracker()

  // Estados del test básicos
  const [currentQuestion, setCurrentQuestion] = useState<number>(resumeData?.questionsAnswered ?? 0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState<boolean>(false)
  const [score, setScore] = useState<number>(resumeData?.correctAnswers ?? 0)
  const [answeredQuestions, setAnsweredQuestions] = useState<DetailedAnswer[]>([])
  const [startTime, setStartTime] = useState<number>(Date.now())
  const [testSession, setTestSession] = useState<TestSession | null>(
    resumeData ? { id: resumeData.sessionId } : null
  )
  const [isAnswering, setIsAnswering] = useState<boolean>(false)
  const [isTestCompleted, setIsTestCompleted] = useState<boolean>(false)

  // Watchdog: detecta UI congelada si isAnswering se queda en true >20s
  useAnswerWatchdog({
    isProcessing: isAnswering,
    onReset: () => {
      setIsAnswering(false)
      setSelectedAnswer(null)
      alert('La validación tardó demasiado. Inténtalo de nuevo.')
    },
    component: 'PsychometricTestLayout',
    questionId: questions[currentQuestion]?.id,
    userId: user?.id,
  })

  // Estados para usuarios no logueados (igual que TestLayout)
  const [detailedAnswers, setDetailedAnswers] = useState<DetailedAnswer[]>([])
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now())

  // Estados para dificultad adaptativa
  const [difficultyInfo, setDifficultyInfo] = useState<DifficultyInfo | null>(null)
  const [isFirstTime, setIsFirstTime] = useState<boolean>(true)

  // 🔒 SEGURIDAD: Estado para respuesta correcta validada por API
  // La respuesta correcta SOLO viene de la API después de responder
  const [verifiedCorrectAnswer, setVerifiedCorrectAnswer] = useState<number | null>(null)
  const [verifiedExplanation, setVerifiedExplanation] = useState<string | null>(null)

  // Anti-duplicados
  const answeringTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const answeredQuestionsGlobal = useRef<Set<string>>(new Set(resumeData?.answeredQuestionIds ?? []))
  const sessionCreated = useRef<boolean>(!!resumeData)

  const currentQ = questions[currentQuestion]
  const totalQuestions = questions.length

  // Función para obtener el conteo de intentos de una pregunta
  const getAttemptCount = (_questionId: string): number => {
    // En el sistema actual, cada pregunta se intenta solo una vez por sesión
    // Retornar 0 para indicar primer intento
    return 0
  }

  // Crear sesión de test al iniciar (solo para usuarios logueados)
  useEffect(() => {
    async function createTestSession() {
      if (!user || !questions.length) {
        console.log('📊 No user logged in, running in guest mode')
        return
      }

      try {
        const response = await fetch('/api/psychometric/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            categoryId: questions[0].category_id || null,
            totalQuestions: questions.length,
            questionIds: questions.map(q => q.id),
          }),
        })

        const result = await response.json()
        if (result.success) {
          setTestSession({ id: result.sessionId } as TestSession)
          console.log('✅ Psychometric test session created:', result.sessionId)
        } else {
          console.error('❌ Error creating psychometric test session:', result.error)
        }
      } catch (err) {
        console.error('❌ Error creating psychometric test session:', err)
      }
    }

    // Solo crear sesión si no se ha creado ya una (y no estamos reanudando)
    if (!sessionCreated.current && user && questions.length > 0 && !resumeData) {
      sessionCreated.current = true
      createTestSession()
    }
  }, [user, questions?.length, supabase, resumeData]) // Usar questions.length en lugar de questions completo

  // Cargar información de dificultad cuando cambie la pregunta
  useEffect(() => {
    async function loadDifficultyInfo() {
      if (!currentQ || !user || !supabase) return

      try {
        console.log('🎯 Loading difficulty info for question:', currentQ.id)
        
        // Cargar información de dificultad
        const diffInfo = await getDifficultyInfo(supabase, currentQ.id, user.id)
        setDifficultyInfo(diffInfo)
        
        // Verificar si es primera vez para este usuario
        const firstTime = await isFirstAttempt(supabase, user.id, currentQ.id)
        setIsFirstTime(firstTime)
        
        console.log('✅ Difficulty info loaded:', diffInfo)
        console.log('🆕 Is first time:', firstTime)
      } catch (error) {
        console.error('❌ Error loading difficulty info:', error)
      }
    }

    loadDifficultyInfo()
  }, [currentQuestion, currentQ, user, supabase])

  // 💬 Actualizar contexto de pregunta para el chat AI (psicotécnicos)
  useEffect(() => {
    if (currentQ) {
      setQuestionContext({
        id: currentQ.id,
        question_text: currentQ.question_text,
        option_a: currentQ.option_a,
        option_b: currentQ.option_b,
        option_c: currentQ.option_c,
        option_d: currentQ.option_d,
        // 🔒 SEGURIDAD: Solo exponer respuesta correcta DESPUÉS de responder
        correct: showResult ? verifiedCorrectAnswer : null,
        explanation: currentQ.explanation,
        // Campos específicos de psicotécnicos
        isPsicotecnico: true,
        questionSubtype: currentQ.question_subtype,
        questionTypeName: SUBTYPE_NAMES[currentQ.question_subtype] || currentQ.question_subtype,
        categoria: categoria,
        // Datos del contenido (gráficos, series, etc.)
        contentData: currentQ.content_data || null
      })
    }

    // Limpiar contexto al desmontar
    return () => {
      clearQuestionContext()
    }
  }, [currentQuestion, currentQ, setQuestionContext, clearQuestionContext, categoria, showResult, verifiedCorrectAnswer])

  const handleAnswer = async (optionIndex: number, _metadata: Record<string, unknown> | null = null) => {
    if (!currentQ || isAnswering || answeredQuestionsGlobal.current.has(currentQ.id)) {
      console.log('🚫 Answer blocked - already answered or processing')
      return
    }

    const timeoutKey = `${currentQ.id}_${optionIndex}`
    if (answeringTimeouts.current.has(timeoutKey)) {
      console.log('🚫 Answer blocked - timeout exists')
      return
    }

    setIsAnswering(true)
    setSelectedAnswer(optionIndex)
    answeredQuestionsGlobal.current.add(currentQ.id)

    // 📊 Tracking de respuesta psicotécnica
    trackPsychometricAction('answer_selected', currentQ?.id, {
      answerIndex: optionIndex,
      questionIndex: currentQuestion,
      questionType: currentQ?.question_type,
      timeToDecide: Date.now() - questionStartTime
    })

    // Timeout para evitar respuestas duplicadas
    const timeout = setTimeout(() => {
      answeringTimeouts.current.delete(timeoutKey)
    }, 2000)
    answeringTimeouts.current.set(timeoutKey, timeout)

    try {
      const questionTime = Date.now() - questionStartTime
      const timeTakenSeconds = Math.floor(questionTime / 1000)

      // 🔒 API centralizada: validar + guardar + actualizar sesión (timeout 10s, retry x2, Zod)
      console.log('🔒 [SecureAnswer] Validando respuesta psicotécnica via API...')

      // Si hay sesión (usuario logueado), enviar datos de guardado junto con la validación
      const saveParams = (testSession && user) ? {
        sessionId: testSession.id,
        userId: user.id,
        questionOrder: currentQuestion + 1,
        timeSpentSeconds: timeTakenSeconds,
        questionSubtype: currentQ.question_subtype || null,
        totalQuestions,
      } : null

      let isCorrect: boolean
      let correctAnswer: number | null
      let explanation: string | null
      let saved = false
      let sessionProgress: { questionsAnswered: number; correctAnswers: number; accuracyPercentage: number } | null = null

      try {
        const apiResult = await validatePsychometricAnswer(currentQ.id, optionIndex, saveParams)
        isCorrect = apiResult.isCorrect
        correctAnswer = apiResult.correctAnswer
        explanation = apiResult.explanation
        saved = apiResult.saved
        sessionProgress = apiResult.sessionProgress ?? null
      } catch (apiError: any) {
        console.error('❌ [SecureAnswer] Psicotécnico: validación fallida:', apiError)
        setSelectedAnswer(null)
        setIsAnswering(false)
        // Los errores de validación se registran automáticamente en validation_error_logs por el servidor
        logClientError('/api/answer/psychometric', apiError, { component: 'PsychometricTestLayout', questionId: currentQ.id, userId: user?.id })
        alert('Error temporal al validar tu respuesta. Inténtalo de nuevo.')
        return
      }

      setVerifiedCorrectAnswer(correctAnswer)
      setVerifiedExplanation(explanation || currentQ.explanation || null)

      if (saved) {
        console.log('✅ [SecureAnswer] Validada + guardada via API:', sessionProgress)
        recordAnswerForGoal()
      } else {
        console.log('✅ [SecureAnswer] Validada via API (guest mode, sin guardar)')
      }

      // Actualizar score
      if (isCorrect) {
        setScore(prev => prev + 1)
      }

      // Crear objeto de respuesta detallada (para estado local)
      const detailedAnswer = {
        questionId: currentQ.id,
        questionText: currentQ.question_text,
        userAnswer: optionIndex,
        correctAnswer: correctAnswer,
        isCorrect,
        timeSpent: timeTakenSeconds,
        timestamp: new Date().toISOString(),
        questionOrder: currentQuestion + 1
      }

      // Actualizar estado de preguntas respondidas (ambos tipos de usuario)
      setAnsweredQuestions(prev => [...prev, detailedAnswer])
      setDetailedAnswers(prev => [...prev, detailedAnswer])

      setShowResult(true)

    } catch (error) {
      console.error('❌ Error processing answer:', error)
    } finally {
      setIsAnswering(false)
    }
  }

  const nextQuestion = (): void => {
    if (currentQuestion < totalQuestions - 1) {
      // 📊 Tracking de navegación
      trackPsychometricAction('navigation_next', questions[currentQuestion]?.id, {
        fromQuestion: currentQuestion,
        toQuestion: currentQuestion + 1,
        totalQuestions
      })

      setCurrentQuestion(prev => prev + 1)
      setSelectedAnswer(null)
      setShowResult(false)
      setQuestionStartTime(Date.now()) // Reset timer para nueva pregunta
      // Limpiar estados de dificultad para la nueva pregunta
      setDifficultyInfo(null)
      setIsFirstTime(true)
      // 🔒 SEGURIDAD: Limpiar respuesta verificada para nueva pregunta
      setVerifiedCorrectAnswer(null)
      setVerifiedExplanation(null)
    } else {
      // Test completado
      completeTest()
    }
  }

  const completeTest = async (): Promise<void> => {
    // 📊 Tracking de test completado
    trackPsychometricAction('test_completed', undefined, {
      totalQuestions,
      correctAnswers: score,
      accuracy: Math.round((score / totalQuestions) * 100),
      categoria
    })

    if (testSession && user) {
      // Usuario logueado - completar sesión via API (bypasses RLS)
      try {
        const response = await fetch('/api/psychometric/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: testSession.id,
            userId: user.id,
            correctAnswers: score,
            totalQuestions,
          }),
        })

        const result = await response.json()
        if (result.success) {
          console.log('✅ Test session completed and saved')
        } else {
          console.error('❌ Error completing test session:', result.error)
        }
      } catch (err) {
        console.error('❌ Error completing test session:', err)
      }
    } else {
      console.log('📊 Guest user completed test, showing results')
    }
    
    // Mostrar pantalla de resultados en lugar de redirigir
    setIsTestCompleted(true)
  }

  const renderQuestion = (): React.ReactNode => {
    if (!currentQ) return null

    // Renderizar según el tipo de pregunta
    switch (currentQ.question_subtype) {
      case 'pie_chart':
        return (
          <PieChartQuestion
            question={currentQ}
            onAnswer={handleAnswer}
            selectedAnswer={selectedAnswer}
            showResult={showResult}
            isAnswering={isAnswering}
            attemptCount={0}
            verifiedCorrectAnswer={verifiedCorrectAnswer}
            verifiedExplanation={verifiedExplanation}
          />
        )

      case 'bar_chart':
        return (
          <BarChartQuestion
            question={currentQ}
            onAnswer={handleAnswer}
            selectedAnswer={selectedAnswer}
            showResult={showResult}
            isAnswering={isAnswering}
            attemptCount={0}
            verifiedCorrectAnswer={verifiedCorrectAnswer}
            verifiedExplanation={verifiedExplanation}
          />
        )

      case 'line_chart':
        return (
          <LineChartQuestion
            question={currentQ}
            onAnswer={handleAnswer}
            selectedAnswer={selectedAnswer}
            showResult={showResult}
            isAnswering={isAnswering}
            attemptCount={0}
            verifiedCorrectAnswer={verifiedCorrectAnswer}
            verifiedExplanation={verifiedExplanation}
          />
        )

      case 'data_tables':
        return (
          <DataTableQuestion
            question={currentQ}
            onAnswer={handleAnswer}
            selectedAnswer={selectedAnswer}
            showResult={showResult}
            isAnswering={isAnswering}
            attemptCount={0}
            verifiedCorrectAnswer={verifiedCorrectAnswer}
            verifiedExplanation={verifiedExplanation}
          />
        )

      case 'mixed_chart':
        return (
          <MixedChartQuestion
            question={currentQ}
            onAnswer={handleAnswer}
            selectedAnswer={selectedAnswer}
            showResult={showResult}
            isAnswering={isAnswering}
            attemptCount={0}
            verifiedCorrectAnswer={verifiedCorrectAnswer}
            verifiedExplanation={verifiedExplanation}
          />
        )

      case 'error_detection':
        return (
          <ErrorDetectionQuestion
            question={currentQ}
            onAnswer={handleAnswer}
            selectedAnswer={selectedAnswer}
            showResult={showResult}
            isAnswering={isAnswering}
            attemptCount={0}
            verifiedCorrectAnswer={verifiedCorrectAnswer}
            verifiedExplanation={verifiedExplanation}
          />
        )

      case 'word_analysis':
        return (
          <WordAnalysisQuestion
            question={currentQ}
            onAnswer={handleAnswer}
            selectedAnswer={selectedAnswer}
            showResult={showResult}
            isAnswering={isAnswering}
            attemptCount={0}
            verifiedCorrectAnswer={verifiedCorrectAnswer}
            verifiedExplanation={verifiedExplanation}
          />
        )

      case 'sequence_numeric':
        return (
          <SequenceNumericQuestion
            question={currentQ}
            onAnswer={handleAnswer}
            selectedAnswer={selectedAnswer}
            showResult={showResult}
            isAnswering={isAnswering}
            attemptCount={getAttemptCount(currentQ.id)}
            verifiedCorrectAnswer={verifiedCorrectAnswer}
            verifiedExplanation={verifiedExplanation}
          />
        )

      case 'sequence_letter':
        return (
          <SequenceLetterQuestion
            question={currentQ}
            onAnswer={handleAnswer}
            selectedAnswer={selectedAnswer}
            showResult={showResult}
            isAnswering={isAnswering}
            attemptCount={getAttemptCount(currentQ.id)}
            verifiedCorrectAnswer={verifiedCorrectAnswer}
            verifiedExplanation={verifiedExplanation}
          />
        )

      case 'sequence_alphanumeric':
        return (
          <SequenceAlphanumericQuestion
            question={currentQ}
            onAnswer={handleAnswer}
            selectedAnswer={selectedAnswer}
            showResult={showResult}
            isAnswering={isAnswering}
            attemptCount={getAttemptCount(currentQ.id)}
            verifiedCorrectAnswer={verifiedCorrectAnswer}
            verifiedExplanation={verifiedExplanation}
          />
        )
      
      // Preguntas simples de 4 opciones (texto + respuestas A/B/C/D)
      case 'synonym':
      case 'antonym':
      case 'text_question':
      case 'calculation':
      case 'percentage':
      case 'probability':
      case 'definition':
      case 'analogy':
      case 'classification':
      case 'alphabetical':
      case 'alphabetical_order':
      case 'code_equivalence':
      case 'coding':
        const cd = currentQ.content_data || {} as Record<string, unknown>
        const tdData = cd.table_data as { title?: string; headers?: string[]; rows?: string[][] } | undefined
        const cdInstruction = cd.instruction as string | undefined
        const cdInstructions = cd.instructions as string[] | undefined
        const cdTextPassage = cd.text_passage as string | undefined
        const hasCD = tdData || cdInstruction || cdInstructions || cdTextPassage
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            {/* Renderizar content_data si existe */}
            {hasCD && (
              <div className="mb-6">
                {cdInstructions && Array.isArray(cdInstructions) && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-700 rounded-lg p-4 mb-4">
                    <div className="text-gray-800 dark:text-gray-200 text-sm space-y-2">
                      {cdInstructions.map((line: string, i: number) => <p key={i}>{line}</p>)}
                    </div>
                  </div>
                )}
                {cdTextPassage && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
                    <p className="text-gray-800 dark:text-gray-200 text-sm">{cdTextPassage}</p>
                  </div>
                )}
                {tdData && (
                  <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-700 rounded-lg p-4 mb-4">
                    {tdData.title && <h4 className="font-bold text-gray-900 dark:text-white mb-2">{tdData.title}</h4>}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-orange-300 dark:border-orange-600">
                        {tdData.headers && (
                          <thead>
                            <tr className="bg-orange-100 dark:bg-orange-800/40">
                              {tdData.headers.map((h: string, i: number) => (
                                <th key={i} className="border border-orange-300 dark:border-orange-600 px-3 py-2 text-orange-800 dark:text-orange-300 font-semibold text-sm">{h}</th>
                              ))}
                            </tr>
                          </thead>
                        )}
                        <tbody>
                          {(tdData.rows || []).map((row: string[], ri: number) => (
                            <tr key={ri}>
                              {row.map((cell: string, ci: number) => (
                                <td key={ci} className="border border-orange-300 dark:border-orange-600 px-3 py-2 text-center text-gray-700 dark:text-gray-300 text-sm font-medium">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {cdInstruction && (
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-200 dark:border-indigo-700 rounded-lg p-4 text-center mb-4">
                    <p className="text-indigo-800 dark:text-indigo-300 font-bold text-lg">{cdInstruction}</p>
                  </div>
                )}
              </div>
            )}

            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 whitespace-pre-line">
              {currentQ.question_text}
            </h3>

            <div className="grid gap-4 mb-8">
              {['A', 'B', 'C', 'D'].map((letter, index) => {
                const optionKey = `option_${letter.toLowerCase()}` as keyof PsychometricQuestion
                const optionText = currentQ[optionKey] as string
                const isSelected = selectedAnswer === index
                // 🔒 SEGURIDAD: Usar verifiedCorrectAnswer de API, no currentQ.correct_option
                const isCorrectOption = showResult && verifiedCorrectAnswer !== null
                  ? index === verifiedCorrectAnswer
                  : false

                return (
                  <button
                    key={letter}
                    onClick={() => !showResult && handleAnswer(index)}
                    disabled={showResult || isAnswering}
                    className={`text-left p-4 rounded-lg border transition-all duration-200 ${
                      showResult
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
                      {showResult && isCorrectOption && (
                        <span className="text-green-600">✓</span>
                      )}
                      {showResult && isSelected && !isCorrectOption && (
                        <span className="text-red-600">✗</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* 🔒 SEGURIDAD: Usar verifiedExplanation de API */}
            {showResult && verifiedExplanation && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
                <h4 className="font-semibold text-blue-800 mb-2">📝 Explicación:</h4>
                <MarkdownExplanation
                  content={verifiedExplanation}
                  className="text-blue-700"
                />
              </div>
            )}
            {showResult && (
              <PsychometricAIHelpButton question={currentQ} className="mt-4" />
            )}
          </div>
        )
      
      default:
        return (
          <div className="text-center py-8">
            <p className="text-gray-600">
              Tipo de pregunta no soportado: {currentQ.question_subtype}
            </p>
          </div>
        )
    }
  }

  if (!questions.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">No hay preguntas disponibles</p>
      </div>
    )
  }

  // Pantalla de resultados
  if (isTestCompleted) {
    const accuracy = Math.round((score / totalQuestions) * 100)
    const testDuration = Math.round((Date.now() - startTime) / 1000)
    
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <h1 className="text-xl font-bold text-gray-900">
              Test Psicotécnico Completado - {categoria.replace('-', ' ')}
            </h1>
          </div>
        </div>

        {/* Resultados */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow-lg p-8 mb-8 text-center">
            <div className="mb-6">
              <div className="text-6xl mb-4">
                {accuracy >= 80 ? '🎉' : accuracy >= 60 ? '👍' : '📚'}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                ¡Test Completado!
              </h2>
              <p className="text-lg text-gray-600">
                {accuracy >= 80 ? '¡Excelente resultado!' : 
                 accuracy >= 60 ? '¡Buen trabajo!' : 
                 'Sigue practicando'}
              </p>
            </div>

            {/* Estadísticas principales */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{score}/{totalQuestions}</div>
                <div className="text-sm text-gray-600">Preguntas Correctas</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{accuracy}%</div>
                <div className="text-sm text-gray-600">Precisión</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">{Math.floor(testDuration/60)}:{String(testDuration%60).padStart(2, '0')}</div>
                <div className="text-sm text-gray-600">Tiempo Total</div>
              </div>
            </div>

            {/* Botones de navegación */}
            <div className="flex justify-center">
              <Link
                href={(config && config.backUrl) || "/auxiliar-administrativo-estado/test"}
                className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                🏠 {(config && config.backText) || "Volver a Tests"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <PsychometricRegistrationManager
      categoria={categoria}
      currentQuestion={currentQuestion}
      totalQuestions={totalQuestions}
      answeredQuestions={answeredQuestions}
      showResult={showResult}
      score={score}
      startTime={startTime}
      isTestCompleted={isTestCompleted}
      enabled={true}
    >
      <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link 
                href={(config && config.backUrl) || "/auxiliar-administrativo-estado/test"}
                className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
              >
                ← {(config && config.backText) || "Volver a Tests"}
              </Link>
              <h1 className="text-xl font-bold text-gray-900 mt-2">
                Test Psicotécnico - {categoria.replace('-', ' ')}
              </h1>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">
                Pregunta {currentQuestion + 1} de {totalQuestions}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestion + 1) / totalQuestions) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>


      {/* Question Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {renderQuestion()}

        {/* Impugnación, navegación y evolución — debajo de la explicación */}
        {showResult && (
          <div className="mt-6 space-y-4">
            {/* Botón de impugnación */}
            <QuestionDispute
              questionId={questions[currentQuestion]?.id || ''}
              user={user}
              isPsychometric
            />

            <button
              onClick={nextQuestion}
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

            {/* Evolución en esta pregunta (todos los tipos) */}
            {user && (
              <PsychometricQuestionEvolution
                userId={user.id}
                questionId={questions[currentQuestion]?.id}
                currentResult={{
                  isCorrect: verifiedCorrectAnswer !== null && selectedAnswer === verifiedCorrectAnswer,
                  timeSpent: 0,
                  answer: selectedAnswer
                }}
              />
            )}
          </div>
        )}
      </div>
      
      {/* Espaciado inferior para evitar problemas con footer */}
      <div className="h-16"></div>
      
      </div>
    </PsychometricRegistrationManager>
  )
}