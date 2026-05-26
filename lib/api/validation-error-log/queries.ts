// lib/api/validation-error-log/queries.ts
// Insert fire-and-forget de errores de validación via Drizzle
//
// CANARY pooler (Fase 5 — sweep final 2026-05-11):
// El audit logger usa el pooler propio cuando está activo. Si NO, cae a
// getTraceDb (Supavisor, sin statement_timeout). Esto evita pérdidas de
// audit log cuando Supavisor tiene blips (visto en logs 11 may: muchos
// "No se pudo guardar error log: CONNECT_TIMEOUT aws-0-eu-west-2.pooler...").

import { getTraceDb, getPoolerDb } from '@/db/client'
import { validationErrorLogs } from '@/db/schema'
import { emit } from '@/lib/observability/emit'
import type { ValidationErrorLogInput } from './schemas'

// after() de Next.js 15+ — registra una callback para ejecutarse tras
// enviar response pero antes de suspender la lambda. Garantiza que el
// INSERT completa con el runtime aún vivo → cierra conexión PG limpiamente.
// Fallback a void si estamos fuera de request context (cron Fargate,
// scripts standalone).
import { after } from 'next/server'

function getAuditLogDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getTraceDb()
}

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
 * NUNCA lanza excepciones, NUNCA bloquea al caller.
 *
 * Usar para 4xx (volumen alto). Internamente usa `after()` de Next.js
 * 15+ para que la promesa NO quede huérfana al terminar la lambda Vercel.
 *
 * INCIDENT 2026-05-26: la implementación anterior usaba
 * `_insertLog(input).catch(...)` sin await. La promise quedaba huérfana
 * cuando la lambda terminaba, dejando la conexión PG en wait_event=ClientRead
 * durante minutos → pool leak → spiral de 5xx en otros endpoints. Causó
 * ~110 errores user-facing en 3h. Ver postmortem #113.
 *
 * Para 5xx seguir usando [logValidationErrorAwait] porque queremos esperar
 * antes de devolver la response (errorRef inyectado al cliente).
 */
export function logValidationError(input: ValidationErrorLogInput): void {
  // No loguear errores en desarrollo local — solo ruido
  if (DEPLOY_VERSION === 'local') return

  // `after()` mantiene la lambda viva tras response, garantiza que el
  // INSERT y su cleanup de conexión TCP terminen. Fallback a void si no
  // estamos en request context (cron, script CLI).
  try {
    after(async () => {
      try {
        await _insertLog(input)
      } catch (err) {
        _logInsertFailure(input)(err)
      }
    })
  } catch {
    // after() solo funciona dentro de un request handler. Fuera de él
    // (raras llamadas desde lib utility, tests, etc.) caemos al patrón
    // anterior — riesgo de huérfano pero ya es contexto sin lambda.
    _insertLog(input).catch(_logInsertFailure(input))
  }
}

/**
 * Variante AWAITABLE para 5xx: garantiza que el INSERT completa antes
 * de que Vercel suspenda la lambda al `return response`. Sin esto, los
 * logs de 500/503/504 capturados por el handler (try/catch que devuelve
 * NextResponse con status>=500) se pierden si el INSERT no termina antes
 * del fin de la lambda — observado 2026-05-25 con statement_timeout en
 * /api/v2/admin/unread-sales que NO llegó a validation_error_logs.
 *
 * Nunca lanza: errores del propio logger solo van a console.error.
 * Coste: +5-20ms en el response del 5xx (aceptable, ya estás devolviendo
 * error al cliente).
 */
export async function logValidationErrorAwait(input: ValidationErrorLogInput): Promise<void> {
  if (DEPLOY_VERSION === 'local') return
  try {
    await _insertLog(input)
  } catch (err) {
    _logInsertFailure(input)(err)
  }
}

function _logInsertFailure(input: ValidationErrorLogInput) {
  return (err: unknown) => {
    // Si falla el logging mismo, solo console (no queremos loops).
    // Drizzle wrappea el error postgres-js, así que message es genérico
    // ("Failed query: insert..."); el detalle real está en err.cause.
    const e = err as { message?: string; cause?: { message?: string; code?: string; detail?: string; column?: string; constraint?: string } }
    const cause = e?.cause
    console.error('⚠️ [validation-error-log] No se pudo guardar error log:', {
      message: e?.message?.slice(0, 200),
      causeMessage: cause?.message,
      causeCode: cause?.code,
      causeDetail: cause?.detail,
      causeColumn: cause?.column,
      causeConstraint: cause?.constraint,
      endpoint: input.endpoint,
      errorType: input.errorType,
      severity: input.severity,
    })
  }
}

async function _insertLog(input: ValidationErrorLogInput): Promise<void> {
  const db = getAuditLogDb()  // canary pooler — evita pérdidas cuando Supavisor blip

  // Sanitizar requestBody: quitar campos sensibles
  const sanitizedBody = input.requestBody ? sanitizeRequestBody(input.requestBody) : {}

  // Espejo a observable_events — AWAITED secuencialmente para garantizar
  // sincronización con el INSERT a validation_error_logs.
  //
  // Antes (hasta 2026-05-26): emitFireAndForget() en paralelo → race con
  // el lifecycle de la lambda Vercel. Si la lambda terminaba antes de que
  // ambas promesas completaran, perdíamos eventos solo en una tabla
  // (medido: 47% pérdida en observable_events vs validation_error_logs).
  //
  // Solución: secuenciar dentro de la misma promesa. Cuando la promesa
  // externa se await (path 5xx vía logValidationErrorAwait), AMBOS INSERTs
  // están garantizados. En path 4xx fire-and-forget, si la lambda muere
  // antes ambos se pierden juntos (consistente, no race).
  //
  // emit() tiene try/catch interno (ver lib/observability/sink.ts) y nunca
  // propaga errores — el await aquí jamás romperá el INSERT principal.
  //
  // Deuda registrada: eliminar este dual-write completamente (Patrón 1
  // "una tabla") es proyecto aparte — ver docs/ARCHITECTURE_ROADMAP.md
  // sección «Bloque 4 — Eliminar dual-write observability».
  await emit({
    source: 'vercel',
    severity: (input.severity || 'critical') as 'critical' | 'error' | 'warn' | 'info' | 'debug',
    eventType: input.errorType === 'unknown' ? 'http_5xx' : input.errorType,
    endpoint: input.endpoint,
    userId: input.userId || null,
    deployVersion: DEPLOY_VERSION,
    durationMs: input.durationMs || null,
    httpStatus: input.httpStatus || null,
    errorMessage: input.errorMessage.slice(0, 2000),
    metadata: {
      vercelRegion: VERCEL_REGION,
      questionId: input.questionId || null,
      testId: input.testId || null,
      userAgent: input.userAgent?.slice(0, 200) || null,
    },
  })

  await db.insert(validationErrorLogs).values({
    ...(input.id ? { id: input.id } : {}),
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
