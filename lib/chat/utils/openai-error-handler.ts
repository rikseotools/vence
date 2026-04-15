// lib/chat/utils/openai-error-handler.ts
//
// Helper compartido para detectar y loguear errores específicos de OpenAI
// (principalmente 429 quota exceeded, que ocurre cuando la cuenta se queda
// sin saldo/créditos o supera el límite mensual del plan).
//
// Caso de origen: 14-15/4/2026 — quota OpenAI agotada silenciosamente. 72/77
// chats IA fallaron en 14h antes de que un usuario (Tinokero) lo reportara.
// Sin esta detección, el error se enmascaraba como "Hubo un error al verificar
// la respuesta. Por favor, intenta de nuevo." para el usuario, y el admin no
// recibía alerta.
//
// Objetivos:
// - Detectar 429 "You exceeded your current quota" como categoría propia
// - Loguear a validation_error_logs con severity='critical' → aparece en el
//   panel admin de errores sin revisar, y activa los badges de alerta
// - Devolver un mensaje más honesto al usuario ("servicio temporalmente no
//   disponible") en vez del genérico "error al verificar"
// - Rate-limit del log (1 vez por minuto por endpoint) para no saturar la BD
//   cuando todos los usuarios dispararon el mismo error en cascada

import { getAdminDb as getDb } from '@/db/client'
import { validationErrorLogs } from '@/db/schema'
import { sql } from 'drizzle-orm'

export type OpenAIErrorCategory =
  | 'quota_exceeded'      // 429 "You exceeded your current quota" — facturación
  | 'rate_limit'          // 429 "Rate limit reached" — TPS/RPS
  | 'auth'                // 401 API key inválida
  | 'invalid_request'     // 400 prompt/model mal construido
  | 'server_error'        // 5xx lado OpenAI
  | 'timeout'             // timeout/abort
  | 'unknown'

export interface ClassifiedOpenAIError {
  category: OpenAIErrorCategory
  status: number | null
  message: string
  /** Mensaje listo para mostrar al usuario (más informativo que el genérico). */
  userFacingMessage: string
  /** Severity sugerido para validation_error_logs. */
  severity: 'critical' | 'warning' | 'info'
  /** Raw error para forensics. */
  raw: unknown
}

/**
 * Clasifica un error capturado tras llamar a openai.chat.completions.create().
 * No lanza — siempre devuelve un objeto con la clasificación.
 */
export function classifyOpenAIError(error: unknown): ClassifiedOpenAIError {
  const e = error as { status?: number; message?: string; code?: string; type?: string } | null
  const message = e?.message || String(error)
  const status = typeof e?.status === 'number' ? e.status : null

  // Quota exceeded (facturación) — puede venir con status 429 o sin status
  // explícito pero con keywords de billing/quota en el mensaje.
  if (/exceeded your current quota|insufficient_quota|\bbilling\b/i.test(message)) {
    return {
      category: 'quota_exceeded',
      status: status || 429,
      message,
      userFacingMessage:
        'El asistente de IA está temporalmente no disponible. Ya nos hemos dado cuenta y lo estamos solucionando. Mientras tanto puedes seguir haciendo tests con normalidad. Disculpa las molestias.',
      severity: 'critical',
      raw: error,
    }
  }

  // 429 sin keywords de quota → rate limit de throughput
  if (status === 429 || /\b429\b|rate.?limit/i.test(message)) {
    return {
      category: 'rate_limit',
      status: 429,
      message,
      userFacingMessage:
        'Hay muchas consultas a la vez y nuestro asistente está saturado. Inténtalo en unos segundos.',
      severity: 'warning',
      raw: error,
    }
  }

  if (status === 401 || /invalid.*api.*key|authentication/i.test(message)) {
    return {
      category: 'auth',
      status: 401,
      message,
      userFacingMessage:
        'Hay un problema de configuración con el asistente. Ya estamos revisándolo.',
      severity: 'critical',
      raw: error,
    }
  }

  if (status === 400 || /invalid_request|context length|maximum context/i.test(message)) {
    return {
      category: 'invalid_request',
      status: status || 400,
      message,
      userFacingMessage:
        'No hemos podido procesar tu consulta. Inténtalo con otra pregunta o reformula la actual.',
      severity: 'warning',
      raw: error,
    }
  }

  if (status && status >= 500 && status < 600) {
    return {
      category: 'server_error',
      status,
      message,
      userFacingMessage:
        'El asistente está teniendo problemas técnicos. Inténtalo en unos segundos.',
      severity: 'warning',
      raw: error,
    }
  }

  if (/timeout|abort|aborted|etimedout/i.test(message)) {
    return {
      category: 'timeout',
      status,
      message,
      userFacingMessage:
        'La respuesta tardó demasiado. Vuelve a intentarlo.',
      severity: 'warning',
      raw: error,
    }
  }

  return {
    category: 'unknown',
    status,
    message,
    userFacingMessage:
      'Hubo un error al verificar la respuesta. Por favor, intenta de nuevo.',
    severity: 'warning',
    raw: error,
  }
}

// Rate-limit en memoria del log: no escribir el mismo (endpoint, category) más
// de una vez por minuto. Evita saturar validation_error_logs cuando todos los
// usuarios disparan el mismo quota_exceeded en cascada.
// En serverless (Vercel) cada instance tiene su propio Map pero suficiente:
// el primer hit de cada instance alertará y los siguientes quedan silenciados
// hasta la siguiente ventana.
const lastLoggedAt = new Map<string, number>()
const LOG_COOLDOWN_MS = 60_000

/**
 * Loguea el error clasificado a validation_error_logs respetando cooldown.
 * Retorna true si se escribió a BD, false si se saltó por cooldown.
 *
 * Es fire-and-forget para quien llama (awaitable pero no lanza nunca).
 */
export async function logOpenAIError(
  classified: ClassifiedOpenAIError,
  context: {
    endpoint: string
    userId?: string | null
    deployVersion?: string | null
  }
): Promise<boolean> {
  const key = `${context.endpoint}::${classified.category}`
  const now = Date.now()
  const last = lastLoggedAt.get(key) || 0
  if (now - last < LOG_COOLDOWN_MS) {
    return false
  }
  lastLoggedAt.set(key, now)

  try {
    const db = getDb()
    await db.insert(validationErrorLogs).values({
      endpoint: context.endpoint,
      errorType: `openai_${classified.category}`,
      errorMessage: `[OpenAI ${classified.category}] ${classified.message}`,
      userId: context.userId || null,
      deployVersion: context.deployVersion || null,
      httpStatus: classified.status,
      severity: classified.severity,
    })
    return true
  } catch (err) {
    // Nunca reventar la request por fallos de logging
    console.error('⚠️ [openai-error-handler] Error guardando log:', err)
    return false
  }
}

// Test-only: resetear el rate-limit (uso en tests unitarios)
export const __testing = {
  resetCooldown: () => lastLoggedAt.clear(),
}
