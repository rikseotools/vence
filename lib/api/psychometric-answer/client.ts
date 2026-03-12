// lib/api/psychometric-answer/client.ts — Client-side validatePsychometricAnswer()
import { apiFetch } from '../client'
import { psychometricAnswerResponseSchema, type PsychometricAnswerResponse } from './schemas'

export type { PsychometricAnswerResponse } from './schemas'

export interface PsychometricSaveParams {
  sessionId: string
  userId: string
  questionOrder: number
  timeSpentSeconds: number
  questionSubtype: string | null
  totalQuestions: number
}

/**
 * Valida una respuesta psicotécnica via /api/answer/psychometric.
 *
 * Timeout: 10s, retries: 2.
 * La respuesta se valida con Zod (psychometricAnswerResponseSchema).
 *
 * @throws ApiTimeoutError — si la API no responde en 10s tras 2 intentos
 * @throws ApiNetworkError — si hay error de red
 * @throws ApiHttpError — si la API devuelve HTTP 4xx/5xx
 */
export async function validatePsychometricAnswer(
  questionId: string,
  userAnswer: number,
  saveParams?: PsychometricSaveParams | null
): Promise<PsychometricAnswerResponse> {
  if (!questionId || typeof questionId !== 'string' || questionId.length < 10) {
    throw new Error('Invalid questionId')
  }

  const payload: Record<string, unknown> = { questionId, userAnswer }
  if (saveParams) {
    Object.assign(payload, saveParams)
  }

  return apiFetch<PsychometricAnswerResponse>(
    '/api/answer/psychometric',
    payload,
    {
      timeoutMs: 10000,
      retries: 2,
      retryDelayMs: 1000,
      responseSchema: psychometricAnswerResponseSchema
    }
  )
}
