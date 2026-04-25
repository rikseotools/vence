'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import SpellingQuestion from './SpellingQuestion'
import MarkdownExplanation from './MarkdownExplanation'
import DeviceLimitModal from './DeviceLimitModal'
import { useDeviceLimitModal } from '@/hooks/useDeviceLimitModal'
import { useAuth } from '@/contexts/AuthContext'

// ============================================
// TIPOS
// ============================================

export interface SpellingQuestionData {
  id: string
  question_text: string
  options: {
    letter: string
    text: string
    // isCorrectlyWritten NO se envía al cliente (anti-scraping)
  }[]
  category: 'ortografia' | 'gramatica'
}

interface SpellingTestLayoutProps {
  questions: SpellingQuestionData[]
  backUrl: string
  backText?: string
  title?: string
}

interface AnswerResult {
  questionId: string
  selectedIndices: number[]
  score: number
  isFullyCorrect: boolean
  incorrectIndices: number[]
  explanation: string | null
}

// ============================================
// COMPONENTE
// ============================================

export default function SpellingTestLayout({
  questions,
  backUrl,
  backText = 'Volver',
  title = 'Test de Ortografía',
}: SpellingTestLayoutProps) {
  const { user } = useAuth()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [results, setResults] = useState<Map<string, AnswerResult>>(new Map())
  const [isValidating, setIsValidating] = useState(false)
  const [testFinished, setTestFinished] = useState(false)
  const [currentResult, setCurrentResult] = useState<AnswerResult | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())

  const sessionCreated = useRef(false)

  // Device limit modal
  const { isDeviceLimitOpen, openDeviceLimitModal, closeDeviceLimit, retryAfterDeviceRemoval } = useDeviceLimitModal()

  const currentQ = questions[currentIndex]
  const totalQuestions = questions.length

  // Crear sesión al iniciar (solo usuarios logueados)
  useEffect(() => {
    if (sessionCreated.current || !user || !questions.length) return
    sessionCreated.current = true

    fetch('/api/spelling/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        category: questions[0]?.category || null,
        totalQuestions: questions.length,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setSessionId(data.sessionId)
          console.log('✅ [SpellingTest] Sesión creada:', data.sessionId)
        }
      })
      .catch(err => console.error('❌ [SpellingTest] Error creando sesión:', err))
  }, [user, questions])

  // Validar respuesta via API
  const handleAnswer = useCallback(async (selectedIndices: number[]) => {
    if (!currentQ || isValidating) return
    setIsValidating(true)

    const timeSpentSeconds = Math.round((Date.now() - questionStartTime) / 1000)

    try {
      const response = await fetch('/api/answer/spelling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQ.id,
          selectedIndices,
          // Datos de tracking (la API los usa si hay sesión)
          sessionId,
          questionOrder: currentIndex + 1,
          timeSpentSeconds,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.deviceLimitReached) {
          openDeviceLimitModal()
          return
        }
        console.error('❌ [SpellingTest] API error:', data.error)
        return
      }

      const result: AnswerResult = {
        questionId: currentQ.id,
        selectedIndices,
        score: data.score,
        isFullyCorrect: data.isFullyCorrect,
        incorrectIndices: data.incorrectIndices,
        explanation: data.explanation,
      }

      setResults(prev => new Map(prev).set(currentQ.id, result))
      setCurrentResult(result)
      setShowResult(true)
    } catch (error) {
      console.error('❌ [SpellingTest] Error:', error)
    } finally {
      setIsValidating(false)
    }
  }, [currentQ, isValidating, openDeviceLimitModal, sessionId, currentIndex, questionStartTime])

  // Completar sesión
  const completeSession = useCallback(() => {
    if (!sessionId || !user) return

    const allResults = Array.from(results.values())
    const correctAnswers = allResults.filter(r => r.isFullyCorrect).length

    fetch('/api/spelling/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'complete',
        sessionId,
        correctAnswers,
        totalAnswered: allResults.length,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) console.log('✅ [SpellingTest] Sesión completada')
      })
      .catch(err => console.error('❌ [SpellingTest] Error completando sesión:', err))
  }, [sessionId, user, results])

  // Siguiente pregunta
  const handleNext = useCallback(() => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(prev => prev + 1)
      setShowResult(false)
      setCurrentResult(null)
      setQuestionStartTime(Date.now())
    } else {
      completeSession()
      setTestFinished(true)
    }
  }, [currentIndex, totalQuestions, completeSession])

  // Calcular estadísticas finales
  const stats = (() => {
    const allResults = Array.from(results.values())
    const totalAnswered = allResults.length
    const fullyCorrect = allResults.filter(r => r.isFullyCorrect).length
    const avgScore = totalAnswered > 0
      ? allResults.reduce((sum, r) => sum + r.score, 0) / totalAnswered
      : 0
    return { totalAnswered, fullyCorrect, avgScore }
  })()

  // Enriquecer opciones con datos de la API tras responder
  const enrichedOptions = currentQ?.options.map((opt, i) => ({
    ...opt,
    isCorrectlyWritten: currentResult
      ? !currentResult.incorrectIndices.includes(i)
      : true, // antes de responder, no importa (no se muestra)
  })) ?? []

  // ============================================
  // PANTALLA DE RESULTADOS
  // ============================================
  if (testFinished) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Resultados del Test
            </h2>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/30 rounded-xl">
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {stats.fullyCorrect}/{stats.totalAnswered}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Correctas</p>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {Math.round(stats.avgScore * 100)}%
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Acierto</p>
              </div>
            </div>

            {/* Resumen por pregunta */}
            <div className="space-y-2 mb-8">
              {questions.map((q, i) => {
                const r = results.get(q.id)
                return (
                  <div key={q.id} className={`flex items-center justify-between p-3 rounded-lg ${
                    r?.isFullyCorrect
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : r
                        ? 'bg-red-50 dark:bg-red-900/20'
                        : 'bg-gray-50 dark:bg-gray-700'
                  }`}>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Pregunta {i + 1}
                    </span>
                    <span className="text-sm font-medium">
                      {r?.isFullyCorrect ? '✅' : r ? '❌' : '—'}
                    </span>
                  </div>
                )
              })}
            </div>

            <Link
              href={backUrl}
              className="block w-full text-center py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              {backText}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ============================================
  // PANTALLA DE PREGUNTA
  // ============================================
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Link href={backUrl} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
            ← {backText}
          </Link>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {currentIndex + 1} / {totalQuestions}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-6">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + (showResult ? 1 : 0)) / totalQuestions) * 100}%` }}
          />
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          {/* Category badge */}
          <div className="mb-4">
            <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${
              currentQ.category === 'ortografia'
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                : 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
            }`}>
              {currentQ.category === 'ortografia' ? 'Ortografía' : 'Gramática'}
            </span>
          </div>

          {/* Question */}
          <SpellingQuestion
            questionText={currentQ.question_text}
            options={enrichedOptions}
            explanation={null}
            onAnswer={handleAnswer}
            showResult={showResult}
            questionNumber={currentIndex + 1}
          />

          {/* Loading */}
          {isValidating && (
            <div className="mt-4 text-center text-gray-500 dark:text-gray-400">
              Validando...
            </div>
          )}

          {/* Explanation after answer */}
          {showResult && currentResult?.explanation && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                Explicación
              </h4>
              <MarkdownExplanation content={currentResult.explanation} />
            </div>
          )}

          {/* Next button */}
          {showResult && (
            <button
              onClick={handleNext}
              className="mt-6 w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              {currentIndex < totalQuestions - 1 ? 'Siguiente pregunta →' : 'Ver resultados'}
            </button>
          )}
        </div>

        {/* Score counter */}
        <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          {stats.fullyCorrect} de {stats.totalAnswered} correctas
          {stats.totalAnswered > 0 && ` (${Math.round(stats.avgScore * 100)}%)`}
        </div>
      </div>

      {/* Device limit modal */}
      <DeviceLimitModal
        isOpen={isDeviceLimitOpen}
        onClose={closeDeviceLimit}
        onRetry={retryAfterDeviceRemoval}
      />
    </div>
  )
}
