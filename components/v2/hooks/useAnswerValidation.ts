// components/v2/hooks/useAnswerValidation.ts
// Hook para validar respuestas de forma segura via API
// NUNCA devuelve una respuesta correcta falsa si la API falla (anti-scraping)

import { useCallback, useState } from 'react'
import type { ValidateAnswerResult } from '../types'

interface UseAnswerValidationReturn {
  validateAnswer: (questionId: string, userAnswer: number) => Promise<ValidateAnswerResult>
  isValidating: boolean
  lastError: string | null
}

/** Sentinel result when API fails — correctAnswer=-1 signals "unknown" */
function apiErrorResult(errorMsg?: string): ValidateAnswerResult {
  return {
    isCorrect: false,
    correctAnswer: -1,
    explanation: null,
    usedFallback: false,
    apiError: true,
  }
}

/**
 * Hook para validar respuestas de forma segura via API.
 * Si la API falla, devuelve apiError=true y correctAnswer=-1.
 * NUNCA devuelve una respuesta correcta inventada (0/A) como fallback.
 */
export function useAnswerValidation(): UseAnswerValidationReturn {
  const [isValidating, setIsValidating] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const validateAnswer = useCallback(async (
    questionId: string,
    userAnswer: number,
  ): Promise<ValidateAnswerResult> => {
    setIsValidating(true)
    setLastError(null)

    // Sin questionId válido → error, no fallback
    if (!questionId || typeof questionId !== 'string' || questionId.length < 10) {
      console.warn('⚠️ [SecureAnswer] Sin questionId válido')
      setLastError('questionId inválido')
      setIsValidating(false)
      return apiErrorResult('questionId inválido')
    }

    try {
      const response = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, userAnswer })
      })

      if (!response.ok) {
        console.warn('⚠️ [SecureAnswer] API error:', response.status)
        setLastError(`API error: ${response.status}`)
        setIsValidating(false)
        return apiErrorResult(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        console.log('✅ [SecureAnswer] Respuesta validada via API')
        setIsValidating(false)
        return {
          isCorrect: data.isCorrect,
          correctAnswer: data.correctAnswer,
          explanation: data.explanation,
          articleNumber: data.articleNumber,
          lawShortName: data.lawShortName,
          usedFallback: false,
        }
      }

      // API respondió pero no encontró la pregunta
      console.warn('⚠️ [SecureAnswer] Pregunta no encontrada en API')
      setLastError('Pregunta no encontrada')
      setIsValidating(false)
      return apiErrorResult('Pregunta no encontrada')

    } catch (error) {
      console.error('❌ [SecureAnswer] Error llamando API:', error)
      setLastError(error instanceof Error ? error.message : 'Error desconocido')
      setIsValidating(false)
      return apiErrorResult('Network error')
    }
  }, [])

  return {
    validateAnswer,
    isValidating,
    lastError
  }
}
