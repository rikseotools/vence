// lib/api/withErrorLogging.ts
// Wrapper para route handlers que logea automáticamente errores a validation_error_logs.
// Fire-and-forget: nunca bloquea, nunca modifica la respuesta del handler.

import { NextResponse } from 'next/server'
import { logValidationError, classifyError } from '@/lib/api/validation-error-log'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (...args: any[]) => Promise<Response> | Response

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

      // Logar respuestas 4xx y 5xx
      if (response.status >= 400) {
        let errorMessage = `HTTP ${response.status}`
        try {
          const responseBody = await response.clone().json()
          errorMessage = responseBody.error || responseBody.message || errorMessage
        } catch {}

        // Filtrar ruido: no logear 400 con body vacío (bots/crawlers haciendo requests sin parámetros)
        const isEmptyBodyNoise = response.status === 400
          && (!body || Object.keys(body).length === 0)
          && (errorMessage.includes('inválidos') || errorMessage.includes('invalid') || errorMessage.includes('Usa POST'))
        if (isEmptyBodyNoise) {
          return response
        }

        logValidationError({
          endpoint,
          errorType: response.status >= 500 ? 'unknown' : classifyHttpStatus(response.status),
          errorMessage,
          questionId: (body?.questionId as string) || undefined,
          userId: (body?.userId as string) || undefined,
          requestBody: body,
          severity: getSeverity(response.status),
          httpStatus: response.status,
          durationMs: Date.now() - startTime,
          userAgent,
        })
      }

      return response
    } catch (error) {
      // Error no manejado — logar como critical y devolver 500 genérico
      logValidationError({
        endpoint,
        errorType: classifyError(error),
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        questionId: (body?.questionId as string) || undefined,
        userId: (body?.userId as string) || undefined,
        requestBody: body,
        severity: 'critical',
        httpStatus: 500,
        durationMs: Date.now() - startTime,
        userAgent,
      })

      return NextResponse.json(
        { success: false, error: 'Error interno del servidor' },
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
