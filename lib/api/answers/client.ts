// lib/api/answers/client.ts — Client-side validateAnswer()
import { apiFetch } from '../client'
import { validateAnswerResponseSchema, type ValidateAnswerResponse } from './schemas'

/**
 * Valida una respuesta de pregunta legislativa via /api/answer.
 *
 * Timeout: 10s, retries: 2.
 * La respuesta se valida con Zod (validateAnswerResponseSchema).
 *
 * @throws ApiTimeoutError — si la API no responde en 10s tras 2 intentos
 * @throws ApiNetworkError — si hay error de red
 * @throws ApiHttpError — si la API devuelve HTTP 4xx/5xx
 */
export async function validateAnswer(
  questionId: string,
  userAnswer: number
): Promise<ValidateAnswerResponse> {
  if (!questionId || typeof questionId !== 'string' || questionId.length < 10) {
    throw new Error('Invalid questionId')
  }

  return apiFetch<ValidateAnswerResponse>(
    '/api/answer',
    { questionId, userAnswer },
    {
      timeoutMs: 10000,
      retries: 2,
      retryDelayMs: 1000,
      responseSchema: validateAnswerResponseSchema
    }
  )
}
