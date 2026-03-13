// lib/api/validation-error-log/queries.ts
// Insert fire-and-forget de errores de validación via Drizzle

import { getDb } from '@/db/client'
import { validationErrorLogs } from '@/db/schema'
import type { ValidationErrorLogInput } from './schemas'

// Deploy version: Vercel inyecta VERCEL_GIT_COMMIT_SHA en build time
const DEPLOY_VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || 'local'
const VERCEL_REGION = process.env.VERCEL_REGION || null

/**
 * Clasifica un error en un errorType conocido.
 */
export function classifyError(error: unknown): 'timeout' | 'network' | 'db_connection' | 'validation' | 'unknown' {
  if (!(error instanceof Error)) return 'unknown'

  const msg = error.message.toLowerCase()

  // DB connection checks FIRST (connect_timeout contiene "timeout" pero es de DB)
  if (msg.includes('connect_timeout') || msg.includes('too many clients') || msg.includes('pool') || msg.includes('connection terminated') || msg.includes('connection refused')) {
    return 'db_connection'
  }
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('etimedout') || msg.includes('aborted')) {
    return 'timeout'
  }
  if (msg.includes('econnrefused') || msg.includes('econnreset') || msg.includes('fetch failed') || msg.includes('network')) {
    return 'network'
  }
  if (msg.includes('invalid') || msg.includes('validation') || msg.includes('parse')) {
    return 'validation'
  }

  return 'unknown'
}

/**
 * Persiste un error de validación en la BD.
 * Fire-and-forget: NUNCA lanza excepciones, NUNCA bloquea al caller.
 */
export function logValidationError(input: ValidationErrorLogInput): void {
  // Ejecutar async sin await — fire-and-forget
  _insertLog(input).catch((err) => {
    // Si falla el logging mismo, solo console (no queremos loops)
    console.error('⚠️ [validation-error-log] No se pudo guardar error log:', err?.message)
  })
}

async function _insertLog(input: ValidationErrorLogInput): Promise<void> {
  const db = getDb()

  // Sanitizar requestBody: quitar campos sensibles
  const sanitizedBody = input.requestBody ? sanitizeRequestBody(input.requestBody) : {}

  await db.insert(validationErrorLogs).values({
    endpoint: input.endpoint,
    errorType: input.errorType,
    errorMessage: input.errorMessage.slice(0, 2000),
    errorStack: input.errorStack?.slice(0, 5000) || null,
    userId: input.userId || null,
    questionId: input.questionId || null,
    testId: input.testId || null,
    requestBody: sanitizedBody,
    severity: input.severity || 'critical',
    deployVersion: DEPLOY_VERSION,
    vercelRegion: VERCEL_REGION,
    httpStatus: input.httpStatus || null,
    durationMs: input.durationMs || null,
    userAgent: input.userAgent?.slice(0, 1000) || null,
  })
}

/** Elimina campos sensibles del body antes de guardarlo */
function sanitizeRequestBody(body: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...body }
  // No guardar tokens, passwords, etc.
  delete sanitized.token
  delete sanitized.password
  delete sanitized.authorization
  // Truncar campos grandes (opciones de preguntas, etc.)
  for (const key of Object.keys(sanitized)) {
    const val = sanitized[key]
    if (typeof val === 'string' && val.length > 500) {
      sanitized[key] = val.slice(0, 500) + '...[truncated]'
    }
  }
  return sanitized
}
