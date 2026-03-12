// lib/api/exam/client.ts — Client-side validateExam()
import { apiFetch } from '../client'
import { validatedResultsSchema, type ValidatedResults } from './schemas'

export type { ValidatedResults, ValidatedQuestionResult } from './schemas'

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
  answers: Array<{ questionId: string; userAnswer: string | null }>
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
