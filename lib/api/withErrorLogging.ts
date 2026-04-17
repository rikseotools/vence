// lib/api/withErrorLogging.ts
// Wrapper para route handlers que logea automáticamente errores a validation_error_logs.
// Fire-and-forget: nunca bloquea, nunca modifica la respuesta del handler.
// Para respuestas 5xx: genera un errorRef (UUID) que queda loggeado en BD y se inyecta
// en el body de la respuesta para que el usuario lo pueda citar al soporte.

import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { logValidationError, classifyError } from '@/lib/api/validation-error-log'

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

        // No logear 403 de límite diario — es operación normal, no un error
        if (response.status === 403 && errorMessage.includes('límite diario')) {
          return response
        }

        // Generar errorRef (solo para 5xx — errores críticos que el usuario podría reportar)
        const errorRef = response.status >= 500 ? randomUUID() : undefined

        const sanitizedBody = body ? sanitizeRequestBody(body) : undefined

        logValidationError({
          id: errorRef,
          endpoint,
          errorType: response.status >= 500 ? 'unknown' : classifyHttpStatus(response.status),
          errorMessage,
          questionId: (body?.questionId as string) || undefined,
          userId: (body?.userId as string) || undefined,
          requestBody: sanitizedBody,
          severity: getSeverity(response.status),
          httpStatus: response.status,
          durationMs: Date.now() - startTime,
          userAgent,
        })

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
      logValidationError({
        id: errorRef,
        endpoint,
        errorType: classifyError(error),
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        questionId: (body?.questionId as string) || undefined,
        userId: (body?.userId as string) || undefined,
        requestBody: body ? sanitizeRequestBody(body) : undefined,
        severity: 'critical',
        httpStatus: 500,
        durationMs: Date.now() - startTime,
        userAgent,
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
