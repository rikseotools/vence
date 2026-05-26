// lib/api/withErrorLogging.ts
// Wrapper para route handlers que logea automáticamente errores a validation_error_logs.
// Fire-and-forget: nunca bloquea, nunca modifica la respuesta del handler.
// Para respuestas 5xx: genera un errorRef (UUID) que queda loggeado en BD y se inyecta
// en el body de la respuesta para que el usuario lo pueda citar al soporte.

import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import * as Sentry from '@sentry/nextjs'
import { logValidationError, logValidationErrorAwait, classifyError } from '@/lib/api/validation-error-log'
import { emitFireAndForget } from '@/lib/observability/emit'

/**
 * Sampling rate para eventos `request_completed` 2xx/3xx (Bloque 5
 * Fase E.4.5.b). 100% en 4xx/5xx (todos), pero en éxito muestreamos
 * 10% para mantener volumen razonable mientras conservamos precisión
 * estadística de los percentiles (con ~5000 samples/24h tienes p99
 * confidence interval estrecho).
 */
const SUCCESS_TIMING_SAMPLE_RATE = 0.1

const DEPLOY_VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || 'local'

/**
 * Enriquece eventos Sentry con tags + user context. Bloque 4 — completa
 * la integración Sentry. Captura explícitamente respuestas 5xx que NO
 * lanzan excepción (Sentry no las pillaría sin esto) y enriquece eventos
 * con userId/endpoint/deployVersion para filtrado en dashboard.
 *
 * Se llama:
 *   - Cuando el handler DEVUELVE Response 5xx (no throw)
 *   - Cuando el handler LANZA (Sentry ya capturó via instrumentation,
 *     enriquecemos el evento más reciente con el scope correcto)
 */
function enrichSentryEvent(opts: {
  endpoint: string
  httpStatus: number
  errorMessage: string
  userId?: string
  errorRef?: string
  capturedFromThrow?: boolean
  originalError?: unknown
}): void {
  try {
    Sentry.withScope((scope) => {
      scope.setTag('endpoint', opts.endpoint)
      scope.setTag('http_status', String(opts.httpStatus))
      scope.setTag('deploy_version', DEPLOY_VERSION)
      if (opts.userId) {
        scope.setUser({ id: opts.userId })
      }
      if (opts.errorRef) {
        scope.setTag('error_ref', opts.errorRef)
      }
      // Si fue capturado vía return Response (no throw), capture explícito
      // — Sentry no lo vería de otro modo
      if (!opts.capturedFromThrow) {
        Sentry.captureMessage(
          `[${opts.httpStatus}] ${opts.endpoint} — ${opts.errorMessage}`,
          'error',
        )
      } else if (opts.originalError instanceof Error) {
        // Si el handler lanzó, Sentry YA capturó via instrumentation.
        // captureException aquí dispara un segundo evento — mejor evitarlo
        // y solo enriquecer el scope para el próximo evento del thread.
        // (NO captureException aquí — duplicaría)
      }
    })
  } catch {
    // Sentry caído jamás rompe el flujo
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (...args: any[]) => Promise<Response> | Response

const HEAVY_BODY_KEYS = ['mouseEvents', 'scrollEvents', 'interactionEvents', 'explanation', 'options', 'questionText', 'metadata']

function sanitizeRequestBody(body: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(body)) {
    if (HEAVY_BODY_KEYS.includes(key)) continue
    clean[key] = val
  }
  return clean
}

/**
 * Determina la severidad según el HTTP status code.
 * - 500+: critical (errores del servidor)
 * - 401, 403: warning (auth/permisos)
 * - 400, 404, 405, 409, 422, 429: info (errores del cliente esperados)
 */
function getSeverity(status: number): 'critical' | 'warning' | 'info' {
  if (status >= 500) return 'critical'
  if (status === 401 || status === 403) return 'warning'
  return 'info'
}

/**
 * Envuelve un route handler para capturar y logar errores automáticamente.
 *
 * - Errores no manejados (throw sin catch): logea como critical + devuelve 500 genérico
 * - Respuestas 500+: severity critical
 * - Respuestas 401/403: severity warning
 * - Respuestas 400, 404, etc: severity info
 * - Respuestas 2xx/3xx: no logea
 * - Extrae body de POST/PUT/PATCH para enriquecer los logs
 *
 * Uso:
 *   export const POST = withErrorLogging('/api/mi-endpoint', async (request) => {
 *     // handler normal...
 *   })
 */
export function withErrorLogging(endpoint: string, handler: RouteHandler): RouteHandler {
  return async (...args: unknown[]) => {
    const request = args[0] as Request
    const startTime = Date.now()
    let body: Record<string, unknown> | undefined

    const userAgent = request?.headers?.get?.('user-agent') ?? null

    // Parsear body para POST/PUT/PATCH (contexto para logs)
    if (request?.method && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      try {
        body = await request.clone().json()
      } catch {
        // Body no es JSON o está vacío — no pasa nada
      }
    }

    try {
      const response = await handler(...args)

      // ============================================================
      // Bloque 5 Fase E.4.5.b — emitir timing a observable_events.
      // Permite calcular p50/p95/p99 latencia por host (preview-aws vs
      // www) en el dashboard /admin/slos.
      //
      // 2xx/3xx: sampling 10% (alto volumen → mantenemos ~5k samples/24h
      //   suficiente para p99 sólido sin inflar la tabla).
      // 4xx/5xx: 100% (todos los errores, ya están abajo en otro bloque,
      //   incluyen duration_ms; aquí solo emit para los 2xx/3xx).
      //
      // metadata.host distingue preview-aws.vence.es de www.vence.es,
      // crítico para comparativa apples-to-apples del cutover.
      // ============================================================
      if (response.status < 400 && Math.random() < SUCCESS_TIMING_SAMPLE_RATE) {
        const durationMs = Date.now() - startTime
        const host = request?.headers?.get?.('host') ?? null
        emitFireAndForget({
          source: 'vercel',
          severity: 'info',
          eventType: 'request_completed',
          endpoint,
          httpStatus: response.status,
          durationMs,
          metadata: {
            host,
            method: request?.method ?? 'GET',
            sampled: 'true', // marca que este evento es sample, no censo
          },
        })
      }

      // Logar respuestas 4xx y 5xx
      if (response.status >= 400) {
        let errorMessage = `HTTP ${response.status}`
        let responseBody: Record<string, unknown> | null = null
        try {
          responseBody = await response.clone().json() as Record<string, unknown>
          errorMessage = (responseBody?.error as string) || (responseBody?.message as string) || errorMessage
        } catch {}

        // Filtrar ruido: no logear 400 con body vacío (bots/crawlers haciendo requests sin parámetros)
        const isEmptyBodyNoise = response.status === 400
          && (!body || Object.keys(body).length === 0)
          && (errorMessage.includes('inválid') || errorMessage.includes('invalid') || errorMessage.includes('Usa POST') || errorMessage.includes('no válida'))
        if (isEmptyBodyNoise) {
          return response
        }

        // No logear 403 de límites diarios — es comportamiento esperado, no errores.
        // Device limit SÍ se loguea: alimenta la tab "Device limit" en /admin/fraudes.
        if (response.status === 403 && (
          errorMessage.includes('límite diario') ||
          errorMessage.includes('mucha demanda')
        )) {
          return response
        }

        // Generar errorRef (solo para 5xx — errores críticos que el usuario podría reportar)
        const errorRef = response.status >= 500 ? randomUUID() : undefined

        const sanitizedBody = body ? sanitizeRequestBody(body) : undefined

        // userId: buscar en request body, luego en response body (device limit lo incluye ahí)
        const resolvedUserId = (body?.userId as string)
          || (responseBody?.userId as string)
          || undefined

        const logInput = {
          id: errorRef,
          endpoint,
          errorType: response.status >= 500 ? 'unknown' : classifyHttpStatus(response.status),
          errorMessage,
          questionId: (body?.questionId as string) || undefined,
          userId: resolvedUserId,
          requestBody: sanitizedBody,
          severity: getSeverity(response.status),
          httpStatus: response.status,
          durationMs: Date.now() - startTime,
          userAgent,
        }
        // 5xx: awaitar para garantizar persistencia antes de que Vercel
        // suspenda la lambda al `return response`. Sin esto se pierden los
        // logs de 500/503 capturados por try/catch del handler — observado
        // 2026-05-25 con statement_timeout en /api/v2/admin/unread-sales.
        // 4xx: fire-and-forget — volumen alto, pérdida ocasional aceptable.
        if (response.status >= 500) {
          await logValidationErrorAwait(logInput)
        } else {
          logValidationError(logInput)
        }

        // Bloque 4 — enriquecer Sentry con tags + userId. Solo para 5xx
        // (4xx típicamente son comportamiento esperado: 401/403/404/429).
        if (response.status >= 500) {
          enrichSentryEvent({
            endpoint,
            httpStatus: response.status,
            errorMessage,
            userId: resolvedUserId,
            errorRef,
            capturedFromThrow: false,
          })
        }

        // Para 5xx: inyectar errorRef en el body y devolver una respuesta nueva.
        // Preservamos headers/status del response original.
        if (errorRef && responseBody) {
          const newBody = { ...responseBody, errorRef }
          return NextResponse.json(newBody, {
            status: response.status,
            headers: response.headers,
          })
        }
      }

      return response
    } catch (error) {
      // Error no manejado — logar como critical y devolver 500 genérico
      const errorRef = randomUUID()
      const throwUserId = (body?.userId as string) || undefined
      const throwErrorMessage = error instanceof Error ? error.message : String(error)

      // 5xx por throw: awaitar (ver justificación arriba en bloque 4xx/5xx).
      await logValidationErrorAwait({
        id: errorRef,
        endpoint,
        errorType: classifyError(error),
        errorMessage: throwErrorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
        questionId: (body?.questionId as string) || undefined,
        userId: throwUserId,
        requestBody: body ? sanitizeRequestBody(body) : undefined,
        severity: 'critical',
        httpStatus: 500,
        durationMs: Date.now() - startTime,
        userAgent,
      })

      // Sentry ya capturó vía instrumentation.onRequestError, pero el scope
      // global puede no tener nuestro userId/endpoint. Enriquecer ahora —
      // útil para próximo error en el mismo request thread.
      enrichSentryEvent({
        endpoint,
        httpStatus: 500,
        errorMessage: throwErrorMessage,
        userId: throwUserId,
        errorRef,
        capturedFromThrow: true,
        originalError: error,
      })

      return NextResponse.json(
        { success: false, error: 'Error interno del servidor', errorRef },
        { status: 500 }
      )
    }
  }
}

/**
 * Clasifica un HTTP status 4xx en un errorType descriptivo.
 */
function classifyHttpStatus(status: number): string {
  switch (status) {
    case 400: return 'validation'
    case 401: return 'auth'
    case 403: return 'forbidden'
    case 404: return 'not_found'
    case 405: return 'method_not_allowed'
    case 409: return 'conflict'
    case 422: return 'validation'
    case 429: return 'rate_limit'
    default: return 'client_error'
  }
}
