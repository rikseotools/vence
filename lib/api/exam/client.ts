// lib/api/exam/client.ts — Client-side validateExam()
//
// ⚠️ ESTAS LLAMADAS VAN **CON** `Authorization: Bearer`, Y NO ES OPCIONAL (T-669, 07/08/2026).
// `apiFetch` no adjunta credenciales por su cuenta: manda `Content-Type` y lo que se le pase. Eso
// fue inofensivo mientras `/api/exam/validate` no miraba de quién era el examen — y dejó de serlo
// el mismo día en que [T-565] le puso (con razón) una guarda de propiedad: sin token el servidor
// no ve identidad, `callerUserId` sale `null`, el examen SÍ tiene dueño, y la guarda **bloquea al
// propio dueño** con un 403 «No tienes acceso a este recurso».
//
// Lo que vio el usuario: termina el examen, pulsa corregir y la app dice que no hay conexión.
// Medido: **190 rechazos en `/api/exam/validate` en 24 h, 191 de 222 sin identidad del que pide**,
// 20 personas distintas, y **cuatro usuarias premium escribiendo el mismo día**. Cero en los 10
// días anteriores.
//
// El arreglo NO es relajar la guarda —cerraba un agujero real: con solo el UUID del test se leían
// las respuestas de otra persona— sino mandar la identidad, que es lo que el resto de la API ya
// hace. Por eso se reutiliza `getAuthHeaders()` en vez de construir la cabecera aquí: el token lo
// sirve un solo sitio (`auth.getAccessToken()`), y una segunda forma de pedirlo es exactamente lo
// que causó T-210.
import { apiFetch } from '../client'
import { getAuthHeaders } from '../authHeaders'
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
      responseSchema: validatedResultsSchema,
      headers: await getAuthHeaders(),
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
      headers: await getAuthHeaders(),
    }
  )
}
