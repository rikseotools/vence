// components/v2/hooks/useTestState.ts
// Hook para manejar el estado del test

import { useState, useCallback, useRef } from 'react'
import type {
  TestLayoutQuestion,
  AnsweredQuestion,
  DetailedAnswer,
  TestSession,
  ValidateAnswerResult
} from '../types'

interface UseTestStateProps {
  questions: TestLayoutQuestion[]
  tema: number
}

interface UseTestStateReturn {
  // Estado básico
  currentQuestion: number
  selectedAnswer: number | null
  showResult: boolean
  verifiedCorrectAnswer: number | null
  score: number
  answeredQuestions: AnsweredQuestion[]
  detailedAnswers: DetailedAnswer[]

  // Estado calculado
  currentQ: TestLayoutQuestion | undefined
  isTestCompleted: boolean
  effectiveQuestions: TestLayoutQuestion[]

  // Tracking
  questionStartTime: number
  interactionCount: number

  // Acciones
  selectAnswer: (answer: number) => void
  submitAnswer: (result: ValidateAnswerResult) => void
  nextQuestion: () => void
  resetQuestion: () => void
  incrementInteraction: () => void

  // Anti-duplicados
  processingAnswer: boolean
  setProcessingAnswer: (value: boolean) => void

  // Sesión
  currentTestSession: TestSession | null
  setCurrentTestSession: (session: TestSession | null) => void

  // Completado
  isExplicitlyCompleted: boolean
  setIsExplicitlyCompleted: (value: boolean) => void
}

export function useTestState({ questions, tema }: UseTestStateProps): UseTestStateReturn {
  // Estado básico
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [verifiedCorrectAnswer, setVerifiedCorrectAnswer] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [answeredQuestions, setAnsweredQuestions] = useState<AnsweredQuestion[]>([])
  const [detailedAnswers, setDetailedAnswers] = useState<DetailedAnswer[]>([])

  // Tracking
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  const [interactionCount, setInteractionCount] = useState(0)

  // Anti-duplicados
  const [processingAnswer, setProcessingAnswer] = useState(false)

  // Sesión
  const [currentTestSession, setCurrentTestSession] = useState<TestSession | null>(null)

  // Completado
  const [isExplicitlyCompleted, setIsExplicitlyCompleted] = useState(false)

  // Por ahora no usamos modo adaptativo, usamos las preguntas directamente
  const effectiveQuestions = questions
  const currentQ = effectiveQuestions?.[currentQuestion]
  const isTestCompleted = isExplicitlyCompleted ||
    (currentQuestion === effectiveQuestions?.length - 1 && showResult)

  // Acciones
  const selectAnswer = useCallback((answer: number) => {
    if (showResult || processingAnswer) return
    setSelectedAnswer(answer)
    setInteractionCount(prev => prev + 1)
  }, [showResult, processingAnswer])

  const submitAnswer = useCallback((result: ValidateAnswerResult) => {
    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000)

    // Actualizar estado
    setVerifiedCorrectAnswer(result.correctAnswer)
    setShowResult(true)

    if (result.isCorrect) {
      setScore(prev => prev + 1)
    }

    // Guardar respuesta
    const newAnsweredQuestion: AnsweredQuestion = {
      question: currentQuestion,
      selectedAnswer: selectedAnswer!,
      correct: result.isCorrect,
      timestamp: new Date().toISOString()
    }
    setAnsweredQuestions(prev => [...prev, newAnsweredQuestion])

    // Guardar respuesta detallada
    const newDetailedAnswer: DetailedAnswer = {
      questionIndex: currentQuestion,
      questionOrder: currentQuestion + 1,
      selectedAnswer: selectedAnswer!,
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

  }, [currentQuestion, selectedAnswer, questionStartTime, interactionCount, currentQ])

  const nextQuestion = useCallback(() => {
    if (currentQuestion < effectiveQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1)
      resetQuestion()
    } else {
      setIsExplicitlyCompleted(true)
    }
  }, [currentQuestion, effectiveQuestions.length])

  const resetQuestion = useCallback(() => {
    setSelectedAnswer(null)
    setShowResult(false)
    setVerifiedCorrectAnswer(null)
    setQuestionStartTime(Date.now())
    setInteractionCount(0)
  }, [])

  const incrementInteraction = useCallback(() => {
    setInteractionCount(prev => prev + 1)
  }, [])

  return {
    // Estado básico
    currentQuestion,
    selectedAnswer,
    showResult,
    verifiedCorrectAnswer,
    score,
    answeredQuestions,
    detailedAnswers,

    // Estado calculado
    currentQ,
    isTestCompleted,
    effectiveQuestions,

    // Tracking
    questionStartTime,
    interactionCount,

    // Acciones
    selectAnswer,
    submitAnswer,
    nextQuestion,
    resetQuestion,
    incrementInteraction,

    // Anti-duplicados
    processingAnswer,
    setProcessingAnswer,

    // Sesión
    currentTestSession,
    setCurrentTestSession,

    // Completado
    isExplicitlyCompleted,
    setIsExplicitlyCompleted,
  }
}
