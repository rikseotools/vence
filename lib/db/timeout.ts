// lib/db/timeout.ts
// Wrapper "quick-fail" para queries de BD: corta el await del lambda a un
// timeout configurable y lanza DbTimeoutError. Phase 3 del roadmap de
// hardening contra blips del pooler de Supabase.
//
// Contexto: con statement_timeout=30000 (db/client.ts:30-32), Postgres
// aborta queries lentas a los 30s. Pero el lambda Vercel tiene
// maxDuration típicamente 30-300s y se queda esperando hasta agotarse,
// devolviendo 504. Durante el cascade del 5 may 21:29-21:35 UTC, todos
// los endpoints sin cache mantenían lambdas vivos esperando al pooler
// inalcanzable, agotando capacidad y propagando 504s.
//
// Con withDbTimeout(fn, 8000): el lambda devuelve 503 a los 8s — el
// usuario ve "Reintenta" rápido en vez de loading interminable, y la
// instancia serverless queda libre para servir requests subsiguientes
// que SÍ pueden conectar.
//
// LIMITACIÓN CONOCIDA: cuando el timeout dispara, postgres-js NO cancela
// la query subyacente. El statement_timeout=30s del DSN es el backstop
// que la mata Postgres-side. Significa que la conexión del pool max:1
// queda ocupada hasta los 30s, pero el lambda ya respondió y está libre.
// Mejora futura: integración con AbortController + cancelación nativa
// de postgres-js (sql.cancel()) para liberar el slot inmediatamente.
//
// OBSERVABILIDAD: cuando el timeout dispara, capturamos el evento en Sentry
// inmediatamente (Sentry.captureException). Sin esto, los handlers que
// devuelven 503 retornado (no throw) no llegan a Sentry vía withErrorLogging.
// El tag quick_fail=db_timeout permite filtrar en panel y medir saturación.

import * as Sentry from '@sentry/nextjs'

/**
 * Error específico que indica que una operación de BD excedió el timeout
 * impuesto por withDbTimeout. Permite a callers distinguir entre fallos
 * reales de BD (5xx) y saturación temporal (503 con retry).
 */
export class DbTimeoutError extends Error {
  public readonly timeoutMs: number

  constructor(timeoutMs: number) {
    super(`Database operation exceeded ${timeoutMs}ms timeout (quick-fail)`)
    this.name = 'DbTimeoutError'
    this.timeoutMs = timeoutMs
  }
}

/**
 * Type guard: distingue DbTimeoutError de otros errores.
 * Útil en route handlers para decidir si responder 503 (saturación) o 5xx
 * (error real). Robusto a cross-realm: comprueba name + propiedad
 * timeoutMs en vez de instanceof (que falla si el error cruzó worker).
 */
export function isDbTimeoutError(err: unknown): err is DbTimeoutError {
  return (
    err instanceof Error &&
    err.name === 'DbTimeoutError' &&
    typeof (err as DbTimeoutError).timeoutMs === 'number'
  )
}

/**
 * Type guard: detecta CONNECT_TIMEOUT del cliente postgres-js cuando
 * no consigue establecer conexión TCP al pooler (típicamente blips del
 * Supavisor regional `aws-0-eu-west-2.pooler.supabase.com:6543`).
 *
 * postgres-js emite errores con `.code` para fallos de transporte. El
 * mensaje suele ser "write CONNECT_TIMEOUT <hostname>:<port>". También
 * incluimos CONNECTION_DESTROYED y el match por mensaje como fallback
 * por si el .code cambia entre versiones del driver.
 */
export function isConnectTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const code = (err as { code?: string }).code
  if (code === 'CONNECT_TIMEOUT' || code === 'CONNECTION_DESTROYED') return true
  return /CONNECT_TIMEOUT|CONNECTION_DESTROYED/i.test(err.message)
}

/**
 * Reintenta `fn` una vez si el primer intento falla con CONNECT_TIMEOUT.
 * Diseñado para mitigar blips cortos del pooler regional sin propagar
 * 503 al usuario en el primer fallo.
 *
 * - Backoff fijo (default 500ms) entre intentos. No exponencial — los
 *   blips típicos se resuelven en <1s y no queremos sumar latencia.
 * - Si el segundo intento también falla → se propaga el error original
 *   (caller decide: stale-if-error, 503, etc.).
 * - NO reintenta otros errores (timeouts de query, errores SQL, etc.).
 *
 * IMPORTANTE: envolver en `withDbTimeout` para acotar el tiempo total.
 * Sin acotar, dos CONNECT_TIMEOUT consecutivos pueden tardar >10s.
 *
 * @example
 *   const result = await withDbTimeout(
 *     () => withConnectRetry(() => getFilteredQuestions(input)),
 *     15000,
 *   )
 */
export async function withConnectRetry<T>(
  fn: () => Promise<T>,
  backoffMs: number = 500,
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (!isConnectTimeoutError(err)) throw err
    await new Promise((r) => setTimeout(r, backoffMs))
    return await fn()
  }
}

/**
 * Race una operación contra un timeout. Si la operación tarda más de
 * `timeoutMs`, rechaza con DbTimeoutError. Si la operación termina antes
 * (resolve o reject normal), el timer se limpia y el resultado se
 * propaga tal cual.
 *
 * @param fn Función que produce la promesa de BD. Se invoca dentro del
 *           wrapper para que la promesa empiece dentro del race.
 * @param timeoutMs Timeout en milisegundos. Default 8000ms (8s) — balance
 *                  entre dar margen a queries normales y cortar antes
 *                  del límite Vercel.
 * @returns El valor resuelto por fn, o lanza DbTimeoutError / el error
 *          original de fn.
 *
 * @example
 *   try {
 *     const profile = await withDbTimeout(
 *       () => getProfileForSelfCached(userId),
 *       8000,
 *     )
 *     return NextResponse.json(profile)
 *   } catch (e) {
 *     if (isDbTimeoutError(e)) {
 *       return NextResponse.json(
 *         { error: 'Servicio saturado, reintenta' },
 *         { status: 503, headers: { 'Retry-After': '300' } },
 *       )
 *     }
 *     throw e
 *   }
 */
export async function withDbTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number = 8000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new DbTimeoutError(timeoutMs)
      // Capturar a Sentry como warning ANTES de propagar el reject.
      // Sin esto, los handlers de routes catchean DbTimeoutError y
      // retornan NextResponse(503) — no throw → withErrorLogging no
      // captura → Sentry ciego. Tags coherentes con sentry-hooks.ts:
      // tagDbTimeoutEvent (defensa en profundidad: si en el futuro
      // alguien throws el error, beforeSend también lo etiqueta).
      try {
        Sentry.captureException(err, {
          level: 'warning',
          tags: {
            quick_fail: 'db_timeout',
            component: 'db_timeout',
          },
          extra: { timeoutMs },
        })
      } catch {
        // Sentry init issues / no DSN en dev — nunca romper el flow del timeout
      }
      reject(err)
    }, timeoutMs)
  })

  try {
    return await Promise.race([fn(), timeoutPromise])
  } finally {
    // Cleanup garantizado: si fn resolvió/rechazó antes del timeout,
    // limpiamos el timer para no dejar el proceso vivo esperándolo.
    // (clearTimeout cancela el callback antes de que ejecute → no hay
    // capture a Sentry en este caso.)
    if (timer !== undefined) {
      clearTimeout(timer)
    }
  }
}
