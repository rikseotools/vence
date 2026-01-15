// components/v2/hooks/useAnswerValidation.ts
// Hook para validar respuestas de forma segura via API

import { useCallback, useState } from 'react'
import type { ValidateAnswerResult } from '../types'

interface UseAnswerValidationReturn {
  validateAnswer: (questionId: string, userAnswer: number, fallbackCorrect?: number) => Promise<ValidateAnswerResult>
  isValidating: boolean
  lastError: string | null
}

/**
 * Hook para validar respuestas de forma segura via API
 * Con fallback local si la API falla
 */
export function useAnswerValidation(): UseAnswerValidationReturn {
  const [isValidating, setIsValidating] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const validateAnswer = useCallback(async (
    questionId: string,
    userAnswer: number,
    fallbackCorrect?: number
  ): Promise<ValidateAnswerResult> => {
    setIsValidating(true)
    setLastError(null)

    // Si no hay questionId válido, usar fallback local
    if (!questionId || typeof questionId !== 'string' || questionId.length < 10) {
      console.log('⚠️ [SecureAnswer] Sin questionId válido, usando fallback local')
      setIsValidating(false)
      return {
        isCorrect: fallbackCorrect !== undefined ? userAnswer === fallbackCorrect : false,
        correctAnswer: fallbackCorrect ?? 0,
        explanation: null,
        usedFallback: true
      }
    }

    try {
      const response = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, userAnswer })
      })

      if (!response.ok) {
        console.warn('⚠️ [SecureAnswer] API error, usando fallback local')
        setIsValidating(false)
        return {
          isCorrect: fallbackCorrect !== undefined ? userAnswer === fallbackCorrect : false,
          correctAnswer: fallbackCorrect ?? 0,
          explanation: null,
          usedFallback: true
        }
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
          usedFallback: false
        }
      }

      // Si la API no encuentra la pregunta, fallback
      console.warn('⚠️ [SecureAnswer] Pregunta no encontrada en API, usando fallback')
      setIsValidating(false)
      return {
        isCorrect: fallbackCorrect !== undefined ? userAnswer === fallbackCorrect : false,
        correctAnswer: fallbackCorrect ?? 0,
        explanation: null,
        usedFallback: true
      }

    } catch (error) {
      console.error('❌ [SecureAnswer] Error llamando API:', error)
      setLastError(error instanceof Error ? error.message : 'Error desconocido')
      setIsValidating(false)

      // Fallback a validación local en caso de error
      return {
        isCorrect: fallbackCorrect !== undefined ? userAnswer === fallbackCorrect : false,
        correctAnswer: fallbackCorrect ?? 0,
        explanation: null,
        usedFallback: true
      }
    }
  }, [])

  return {
    validateAnswer,
    isValidating,
    lastError
  }
}
