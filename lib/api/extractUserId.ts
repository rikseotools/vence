// lib/api/extractUserId.ts
// Extracción robusta del userId asociado a una request, para enriquecer logs
// de error (validation_error_logs) y eventos de observabilidad.
//
// Función pura, sin efectos secundarios. Reutilizable por cualquier logger
// futuro (Sentry scope enrichment, observability emit, etc.).
//
// MOTIVACIÓN — incidente 2026-05-31 /api/profile:
//   477 errores 5xx aparecían con user_id=NULL en validation_error_logs
//   porque el wrapper solo miraba body.userId (POST/PUT) y responseBody.userId
//   (device limit), no el query param ?userId=... de los GET. El diagnóstico
//   empezó pensando "1 user anónimo, será un bot" cuando eran 478 users reales
//   con 8+ User-Agents distintos. Documentado en roadmap observability-capacity.

/**
 * Extrae el userId asociado a una request HTTP siguiendo una cascada de fuentes.
 *
 * Devuelve el primer string no vacío encontrado en este orden:
 *   1. `body.userId` — POST/PUT/PATCH con JSON body (ej. /api/answer, /api/v2/answer-and-save).
 *   2. `responseBody.userId` — endpoints que devuelven el userId en la respuesta
 *      (ej. device limit responde con el userId que fue bloqueado).
 *   3. Query param `?userId=...` — convención para GETs (/api/profile, /api/topics/[numero],
 *      /api/exam/resume, /api/exam/pending, /api/stats, /api/user/theme-stats,
 *      /api/v2/user-stats, /api/v2/difficulty-insights y ~15 endpoints más).
 *
 * Si ninguna fuente devuelve un string válido, devuelve `undefined`.
 *
 * @param request Request HTTP. Puede ser `undefined` (defensivo — algunos tests pasan handlers sin request).
 * @param body Body ya parseado del request, si aplica (POST/PUT/PATCH).
 * @param responseBody Body ya parseado de la response, si fue error 4xx/5xx con JSON.
 * @returns userId como string, o `undefined` si no se encontró en ninguna fuente.
 *
 * NOTA DE SEGURIDAD: este valor es lo que el cliente PIDIÓ, no lo verificado por
 * auth. Es correcto para fines de logging y diagnóstico (sabemos qué cliente
 * pidió qué). NUNCA usar este valor para autorización ni decisiones de negocio.
 */
export function extractUserIdFromRequest(
  request: Request | undefined,
  body: Record<string, unknown> | undefined,
  responseBody: Record<string, unknown> | null | undefined,
): string | undefined {
  const fromBody = body?.userId
  if (typeof fromBody === 'string' && fromBody.length > 0) {
    return fromBody
  }

  const fromResponse = responseBody?.userId
  if (typeof fromResponse === 'string' && fromResponse.length > 0) {
    return fromResponse
  }

  // URL parsing dentro de try/catch: si request.url es relativo o inválido en
  // entornos de test, no debe romper el logger. El logger es fire-and-forget
  // por contrato — cualquier excepción aquí cancelaría el log y silenciaría
  // el incidente que estamos intentando capturar.
  try {
    const url = request?.url
    if (typeof url === 'string' && url.length > 0) {
      const fromQuery = new URL(url).searchParams.get('userId')
      if (fromQuery && fromQuery.length > 0) {
        return fromQuery
      }
    }
  } catch {
    // Ignorar: URL malformada, request fake en test, etc.
  }

  return undefined
}
