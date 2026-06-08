// lib/api/exam/client.ts — Client-side validateExam()
import { apiFetch } from '../client'
import {
  validatedResultsSchema,
  validatedPsychometricResultsSchema,
  type ValidatedResults,
  type ValidatedPsychometricResults,
} from './schemas'

export type {
  ValidatedResults,
  ValidatedQuestionResult,
  ValidatedPsychometricResults,
  ValidatedPsychometricResult,
} from './schemas'

/**
 * Valida un examen completo (batch) via /api/exam/validate.
 *
 * Timeout: 30s (batch puede tener 100+ preguntas), retries: 2.
 * La respuesta se valida con Zod (validatedResultsSchema).
 *
 * @throws ApiTimeoutError — si la API no responde en 30s tras 2 intentos
 * @throws ApiNetworkError — si hay error de red
 * @throws ApiHttpError — si la API devuelve HTTP 4xx/5xx
 */
export async function validateExam(
  testId: string | undefined,
  answers: Array<{
    questionId: string
    userAnswer: string | null
    // Enriquecimiento opcional: permite a validate persistir test_questions en
    // bloque (fiable) en vez de depender de saves fire-and-forget durante el examen.
    questionOrder?: number
    questionText?: string
    articleId?: string | null
    articleNumber?: string | null
    lawName?: string | null
    temaNumber?: number | null
    difficulty?: string | null
  }>
): Promise<ValidatedResults> {
  if (!answers || answers.length === 0) {
    throw new Error('Empty answers array')
  }

  return apiFetch<ValidatedResults>(
    '/api/exam/validate',
    { testId, answers },
    {
      timeoutMs: 30000,
      retries: 2,
      retryDelayMs: 1000,
      responseSchema: validatedResultsSchema
    }
  )
}

/**
 * Valida un examen psicotécnico completo (batch) via /api/exam/validate/psychometric.
 *
 * Espejo de validateExam() para preguntas psicotécnicas. Diferencias:
 *   - userAnswer es número (índice 0-4) en vez de letra
 *   - acepta null para preguntas en blanco (y aun así devuelve la respuesta correcta)
 *
 * Timeout: 30s, retries: 2.
 */
export async function validateExamPsychometric(
  answers: Array<{ questionId: string; userAnswer: number | null }>
): Promise<ValidatedPsychometricResults> {
  if (!answers || answers.length === 0) {
    throw new Error('Empty answers array')
  }

  return apiFetch<ValidatedPsychometricResults>(
    '/api/exam/validate/psychometric',
    { answers },
    {
      timeoutMs: 30000,
      retries: 2,
      retryDelayMs: 1000,
      responseSchema: validatedPsychometricResultsSchema,
    }
  )
}
