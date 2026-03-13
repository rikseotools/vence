// lib/api/withErrorLogging.ts
// Wrapper para route handlers que logea automáticamente errores 500+ a validation_error_logs.
// Fire-and-forget: nunca bloquea, nunca modifica la respuesta del handler.

import { NextResponse } from 'next/server'
import { logValidationError, classifyError } from '@/lib/api/validation-error-log'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (...args: any[]) => Promise<Response> | Response

/**
 * Envuelve un route handler para capturar y logar errores automáticamente.
 *
 * - Errores no manejados (throw sin catch): logea + devuelve 500 genérico
 * - Respuestas 500+: logea con contexto del request (body, userId, questionId)
 * - Respuestas 4xx y 2xx: no logea (son esperadas)
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

      // Logar errores 500+ aunque el handler los haya "manejado"
      if (response.status >= 500) {
        let errorMessage = `HTTP ${response.status}`
        try {
          const responseBody = await response.clone().json()
          errorMessage = responseBody.error || responseBody.message || errorMessage
        } catch {}

        logValidationError({
          endpoint,
          errorType: 'unknown',
          errorMessage,
          questionId: (body?.questionId as string) || undefined,
          userId: (body?.userId as string) || undefined,
          requestBody: body,
          httpStatus: response.status,
          durationMs: Date.now() - startTime,
          userAgent,
        })
      }

      return response
    } catch (error) {
      // Error no manejado — logar y devolver 500 genérico
      logValidationError({
        endpoint,
        errorType: classifyError(error),
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        questionId: (body?.questionId as string) || undefined,
        userId: (body?.userId as string) || undefined,
        requestBody: body,
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
