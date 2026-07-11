// lib/api/withErrorLogging.ts
// Wrapper para route handlers que logea automáticamente errores a validation_error_logs.
// Fire-and-forget: nunca bloquea, nunca modifica la respuesta del handler.
// Para respuestas 5xx: genera un errorRef (UUID) que queda loggeado en BD y se inyecta
// en el body de la respuesta para que el usuario lo pueda citar al soporte.

import { NextResponse, after, type NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { logValidationError, logValidationErrorAwait, classifyError } from '@/lib/api/validation-error-log'
import { emit } from '@/lib/observability/emit'
import { extractUserIdFromRequest } from '@/lib/api/extractUserId'
import { verifyAuthOptional } from '@/lib/api/auth/verifyAuth'
import { isSyntheticRequest } from '@/lib/api/syntheticRequest'

/**
 * Sampling rate para eventos `request_completed` 2xx/3xx (Bloque 5
 * Fase E.4.5.b). 100% en 4xx/5xx (todos), pero en éxito muestreamos
 * 10% para mantener volumen razonable mientras conservamos precisión
 * estadística de los percentiles (con ~5000 samples/24h tienes p99
 * confidence interval estrecho).
 */
const SUCCESS_TIMING_SAMPLE_RATE = 0.1

const DEPLOY_VERSION =
  process.env.GIT_COMMIT_SHA?.slice(0, 8)
  || (process.env.NODE_ENV === 'production' ? 'unknown' : 'local')

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
 * Extrae identificadores de traza del body parseado para enriquecer
 * `request_completed`. Whitelist estricta de claves conocidas (UUID/number),
 * nunca PII ni texto libre. Defensivo: el body puede ser undefined o cualquier
 * forma (no asumimos schema). Devuelve solo lo que existe y tiene el tipo
 * esperado para no ensuciar la columna user_id ni la metadata.
 */
/**
 * ¿La request presentó credenciales de sesión (aunque sean inválidas)?
 *
 * Sirve para distinguir dos 401 muy distintos:
 *   - SIN credenciales → visitante anónimo / bot / sesión ya expirada y borrada.
 *     El 401 es el CONTRATO del endpoint, no un fallo. No se registra en VLE
 *     (era el 96% del flood de `/api/auth/token` tras el cutover a RDS del 04/07).
 *   - CON credenciales pero rechazadas → token roto, clave rotada, bridge Fase B
 *     caído. Eso SÍ es señal de regresión de auth real → se sigue registrando
 *     (warn + VLE) para poder diagnosticar bugs/revisiones.
 *
 * Detecta: header `Authorization` (Bearer RS256/HS256) o cookie de sesión Auth.js
 * (`authjs.session-token` / `__Secure-authjs.session-token`) o token legacy
 * Supabase (`sb-<ref>-auth-token`). Pura y defensiva (nunca rompe el logger).
 */
export function requestHadCredentials(request: Request): boolean {
  try {
    if (request?.headers?.get?.('authorization')) return true
    const cookie = request?.headers?.get?.('cookie') ?? ''
    return /authjs\.session-token|-auth-token/.test(cookie)
  } catch {
    return false
  }
}

export function extractTraceIds(body: Record<string, unknown> | undefined): {
  userId?: string | null
  testId?: string
  questionId?: string
  questionOrder?: number
} {
  if (!body || typeof body !== 'object') return {}
  const out: { userId?: string | null; testId?: string; questionId?: string; questionOrder?: number } = {}
  if (typeof body.userId === 'string') out.userId = body.userId
  if (typeof body.testId === 'string') out.testId = body.testId
  if (typeof body.questionId === 'string') out.questionId = body.questionId
  if (typeof body.questionOrder === 'number') out.questionOrder = body.questionOrder
  return out
}

/**
 * Identidad para atribuir un log/evento de observabilidad.
 *
 * PROBLEMA que resuelve (incidente 07/07/2026): la columna `user_id` de
 * observable_events/VLE se rellenaba con `body.userId` — lo que el CLIENTE dice
 * ser, sin verificar. Cuando la cola offline `answerSaveQueue` reintenta
 * respuestas viejas con un token caducado/de otra sesión, el body sigue llevando
 * el id premium del dueño de la cola pero el servidor autentica otra identidad
 * (free/anónima). Resultado: 403 de límite diario atribuidos a cuentas premium
 * que en realidad NUNCA se bloquearon → falsa alarma imposible de alertar.
 *
 * Regla:
 *   - `userId` autoritativo = identidad VERIFICADA del token (la misma que usó
 *     el handler para decidir). Si no hay token válido, cae al `claimed` para no
 *     perder la traza de GETs con `?userId=` (incidente 31/05: user_id=NULL
 *     ocultó 478 users reales), pero marcado `userIdVerified=false`.
 *   - `identityMismatch=true` cuando hay token verificado Y difiere del `claimed`
 *     → señal de cola-replay / multi-cuenta / token robado, alertar sobre esto.
 *
 * Pura → unit-testeable sin request real.
 */
export interface LogIdentity {
  userId: string | undefined
  userIdVerified: boolean
  claimedUserId: string | undefined
  identityMismatch: boolean
}

export function buildLogIdentity(
  verifiedUserId: string | null | undefined,
  claimedUserId: string | null | undefined,
): LogIdentity {
  const verified = typeof verifiedUserId === 'string' && verifiedUserId.length > 0 ? verifiedUserId : undefined
  const claimed = typeof claimedUserId === 'string' && claimedUserId.length > 0 ? claimedUserId : undefined
  return {
    userId: verified ?? claimed,
    userIdVerified: verified != null,
    claimedUserId: claimed,
    identityMismatch: verified != null && claimed != null && verified !== claimed,
  }
}

/**
 * Construye la metadata de identidad que se añade a los eventos, evitando
 * ensuciar la columna JSON cuando no hay nada que reportar (caso común:
 * identidad verificada == claimed, o request anónima legítima).
 */
function identityMetadata(id: LogIdentity): Record<string, unknown> {
  const meta: Record<string, unknown> = { userIdVerified: id.userIdVerified }
  if (id.identityMismatch) {
    meta.identityMismatch = true
    if (id.claimedUserId) meta.claimedUserId = id.claimedUserId
  }
  return meta
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
export function withErrorLogging(
  endpoint: string,
  handler: RouteHandler,
  opts?: {
    skipBodyParse?: boolean
    /**
     * Statuses que son comportamiento ESPERADO por contrato para este
     * endpoint y por tanto NO deben loguearse como error crítico en
     * validation_error_logs ni capturarse en Sentry.
     *
     * Caso de uso: el readiness probe `/api/health/db-ready` devuelve 503
     * a propósito durante el warmup del pool de un container Fargate frío
     * — es una SEÑAL al ALB para que no le mande tráfico todavía, no un
     * fallo. Sin esto, cada deploy/reinicio de container inflaba el
     * indicador "Errores 5xx" del panel de salud con ~30-50 falsos
     * positivos (incidente diagnóstico 2026-06-01).
     *
     * Estos statuses SIGUEN emitiendo `request_completed` a
     * observable_events (con severity degradada a 'info') para conservar
     * el histograma de timing/volumen, pero no ensucian VLE ni Sentry y
     * no se les inyecta errorRef en el body (preserva el contrato JSON
     * del probe).
     */
    expectedStatuses?: number[]
  },
): RouteHandler {
  const isExpectedStatus = (status: number): boolean =>
    opts?.expectedStatuses?.includes(status) ?? false

  return async (...args: unknown[]) => {
    const request = args[0] as Request
    const startTime = Date.now()
    let body: Record<string, unknown> | undefined

    const userAgent = request?.headers?.get?.('user-agent') ?? null

    // ¿Trae credenciales de sesión? Distingue el 401 anónimo (benigno, contrato)
    // del 401 con credenciales rechazadas (señal de regresión de auth). Se usa en
    // la severidad del timing y en el corte de VLE, más abajo.
    const credentialed = requestHadCredentials(request)

    // Tráfico sintético de canaries (header canónico `x-vence-canary`). Sus
    // errores NO se escriben en validation_error_logs — tienen su propio canal
    // de alerta (`canary_*_failed`) y contaminarían el veredicto de salud
    // user-facing (incidente 08/07/2026). Sí seguimos emitiendo
    // request_completed (marcado `synthetic`, severity 'info') para conservar
    // timing/volumen y poder auditar el comportamiento del canary.
    const synthetic = isSyntheticRequest(request as NextRequest)

    // Identidad VERIFICADA del token, resuelta perezosamente y memoizada por
    // request. En prod (JWT_LOCAL_VERIFY_MODE=on) verifyAuthOptional verifica el
    // JWT localmente (<5ms, sin BD, sin round-trip) → mismo id que usó el handler
    // para decidir el límite. Sin token válido → null (actor anónimo, verdad).
    // Defensivo: el logger es fire-and-forget, nunca debe romper por auth.
    let _authResolved = false
    let _authUserId: string | null = null
    const resolveVerifiedUserId = async (): Promise<string | null> => {
      if (_authResolved) return _authUserId
      _authResolved = true
      try {
        const r = await verifyAuthOptional(request as NextRequest, endpoint)
        _authUserId = r?.userId ?? null
      } catch {
        _authUserId = null
      }
      return _authUserId
    }

    // Parsear body para POST/PUT/PATCH (contexto para logs)
    //
    // skipBodyParse: para endpoints que consumen RAW body (webhooks Stripe,
    // Resend, log drains Vercel). En Next.js 15 + Turbopack el `clone().json()`
    // consume el stream subyacente → el handler hace `request.text()` y
    // obtiene `""` → la firma del webhook falla → 400. Incidente 2026-05-26:
    // Andrea pagó 20€ y no se activó premium porque los webhooks de Stripe
    // llevaban horas respondiendo 400 a TODOS los eventos.
    if (!opts?.skipBodyParse && request?.method && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      try {
        body = await request.clone().json()
      } catch {
        // Body no es JSON o está vacío — no pasa nada
      }
    }

    try {
      const response = await handler(...args)

      // Parsear errorMessage + body antes del emit para enriquecer
      // request_completed con info de error (2026-05-27 cabo gaps observ):
      // antes el emit era ciego al error específico — para diagnosticar
      // un 5xx había que ir a CloudWatch logs. Ahora obs_events tiene
      // errorMessage + errorRef → diagnóstico desde un solo SQL.
      let errorMessage = ''
      let responseBody: Record<string, unknown> | null = null
      if (response.status >= 400) {
        try {
          responseBody = await response.clone().json() as Record<string, unknown>
          errorMessage = (responseBody?.error as string) || (responseBody?.message as string) || `HTTP ${response.status}`
        } catch {
          errorMessage = `HTTP ${response.status}`
        }
      }
      // errorRef se genera ANTES del emit para incluirlo en obs_events.
      // Solo para 5xx (VLE-equivalente). Permite cruzar obs_events ↔ VLE
      // por mismo ID. Excluye statuses esperados por contrato (ej. el 503
      // de warmup del readiness probe) — no son errores, no necesitan ref.
      const errorRef = (response.status >= 500 && !isExpectedStatus(response.status))
        ? randomUUID()
        : undefined

      // ============================================================
      // Bloque 5 Fase E.4.5.b — emitir timing a observable_events.
      // Permite calcular p50/p95/p99 latencia por host (preview-aws vs
      // www) en el dashboard /admin/slos.
      //
      // 2xx/3xx: sampling 10% (alto volumen → mantenemos ~5k samples/24h
      //   suficiente para p99 sólido sin inflar la tabla).
      // 4xx/5xx: 100% (todos los errores, independiente del path VLE de
      //   abajo). Garantiza visibilidad en observable_events aunque
      //   _insertLog falle silenciosamente (incidente 2026-05-26: webhook
      //   Stripe respondía 400 y NADA aparecía en VLE ni obs_events,
      //   nos enteramos solo porque una usuaria pagó y se quejó).
      //
      // metadata.host distingue preview-aws.vence.es de www.vence.es,
      // crítico para comparativa apples-to-apples del cutover.
      // ============================================================
      const isError = response.status >= 400
      // Los statuses ESPERADOS por contrato (401 del token, 503 del readiness probe)
      // NO son errores → se muestrean como los 2xx (10%) en vez de emitir el 100%.
      // Sin esto, el 401 de /api/auth/token (polling constante del cliente) metía
      // ~525k request_completed/día en observable_events (el firehose). El resto de
      // 4xx/5xx (errores reales) sigue al 100%.
      const forceEmit = isError && !isExpectedStatus(response.status)
      const shouldEmitTiming = forceEmit || Math.random() < SUCCESS_TIMING_SAMPLE_RATE
      if (shouldEmitTiming) {
        const durationMs = Date.now() - startTime
        const host = request?.headers?.get?.('host') ?? null
        const timingSeverity: 'critical' | 'error' | 'warn' | 'info' =
          synthetic ? 'info' :
          isExpectedStatus(response.status) ? 'info' :
          response.status >= 500 ? 'error' :
          // 401 anónimo (sin credenciales) = reto de autenticación, contrato del
          // endpoint, no un fallo → 'info' (conserva timing/volumen sin contar como
          // warn). 401 con credenciales rechazadas se queda en 'warn' (señal de
          // regresión de auth). Ver el corte de VLE más abajo.
          (response.status === 401 && !credentialed) ? 'info' :
          response.status >= 400 ? 'warn' :
          'info'
        // CRÍTICO: usar `after()` de Next.js, NO `emitFireAndForget` directo.
        //
        // Sin `after()`, la promise `void emit()` queda HUÉRFANA cuando la
        // Vercel function termina. El INSERT PG arranca pero el cliente
        // muere antes de cerrar la conexión → conexión queda en
        // `wait_event=ClientRead` durante minutos/horas hasta TCP timeout.
        // Pool leak, cada slot perdido reduce capacidad, spiral.
        //
        // Incidente 2026-05-26: ~85 errores 5xx en /api/exam/pending por
        // pool agotado tras desplegar E.4.5.b (introdujo este emit en cada
        // 2xx). Detectado por audit `pg_stat_activity` + diagnóstico
        // documentado en `lib/observability/emit.ts:48-51`.
        //
        // `after()` registra la callback para ejecutarse DESPUÉS de enviar
        // la response pero ANTES de suspender la lambda — Vercel mantiene
        // el runtime vivo hasta que termine. Esto cierra correctamente la
        // conexión PG.
        // Identificadores de traza extraídos del body (solo claves conocidas,
        // todas UUID/number → sin PII). Permiten reconstruir el journey de un
        // usuario/examen concreto desde un solo SQL cuando reporta un bug
        // (antes: imposible trazar las ~50 llamadas de un examen entre cientos
        // de POST anónimos — caso Rosa 07/06). userId va a la columna top-level
        // user_id; testId/questionId a metadata (forense de incidentes).
        const traceIds = extractTraceIds(body)
        after(async () => {
          // Identidad autoritativa = token verificado; `body.userId` es solo lo
          // que el cliente CLAIMED (ver buildLogIdentity). La resolución de auth
          // corre aquí, post-response, para no añadir latencia al happy-path.
          const verifiedUserId = await resolveVerifiedUserId()
          const identity = buildLogIdentity(verifiedUserId, extractUserIdFromRequest(request, body, responseBody))
          await emit({
            source: 'vercel',
            severity: timingSeverity,
            eventType: 'request_completed',
            endpoint,
            userId: identity.userId,
            httpStatus: response.status,
            durationMs,
            deployVersion: DEPLOY_VERSION,
            errorMessage: errorMessage || null,
            metadata: {
              host,
              method: request?.method ?? 'GET',
              sampled: isError ? 'false' : 'true',
              errorRef: errorRef || null,
              ...(synthetic ? { synthetic: true } : {}),
              ...identityMetadata(identity),
              ...(traceIds.testId ? { testId: traceIds.testId } : {}),
              ...(traceIds.questionId ? { questionId: traceIds.questionId } : {}),
              ...(traceIds.questionOrder != null ? { questionOrder: traceIds.questionOrder } : {}),
            },
          })
        })
      }

      // Logar respuestas 4xx y 5xx
      if (response.status >= 400) {
        // errorMessage y responseBody ya parseados arriba — no repetir el clone().json()

        // No logear statuses ESPERADOS por contrato (ej. 503 de warmup del
        // readiness probe). El timing ya se emitió arriba como 'info'; aquí
        // solo evitamos ensuciar validation_error_logs y Sentry con lo que
        // no es un fallo. Ver opts.expectedStatuses.
        if (isExpectedStatus(response.status)) {
          return response
        }

        // Tráfico sintético de canaries: no ensuciar validation_error_logs. El
        // request_completed ya se emitió arriba marcado `synthetic`. Los fallos
        // reales de un canary los cubre su propio evento `canary_*_failed`.
        if (synthetic) {
          return response
        }

        // 401 anónimo (sin credenciales presentadas): reto de autenticación, no un
        // fallo. Todo endpoint con sesión responde 401 a visitantes anónimos/bots/
        // sesión ya expirada — es contrato. El request_completed ya se emitió arriba
        // ('info'), conservando timing/volumen consultables en observable_events;
        // aquí NO se escribe en validation_error_logs (era el 96% del flood de
        // `/api/auth/token`: ~340k/día tras el cutover a RDS del 04/07, que tumbó el
        // panel admin y ahogó las alertas reales). El 401 CON credenciales rechazadas
        // (token roto, bridge Fase B caído) SÍ se registra: es señal de bug de auth.
        if (response.status === 401 && !credentialed) {
          return response
        }

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

        // errorRef ya generado arriba (movido para incluirlo en el emit de
        // request_completed → cross-referenciable con VLE).
        const sanitizedBody = body ? sanitizeRequestBody(body) : undefined

        // userId: identidad VERIFICADA del token primero (la que el handler usó
        // para decidir), con fallback a la cascada claimed body → responseBody →
        // query param (ver extractUserId.ts). El fallback query param es crítico
        // para GETs como /api/profile — sin él el log queda con user_id=NULL y los
        // incidentes se diagnostican a ciegas (incidente 31/05/2026: 477 errores
        // aparentemente "anónimos" eran 478 users reales). El flag identityMismatch
        // en metadata distingue actor real de identidad reclamada por el cliente
        // (incidente 07/07: 403 de límite atribuidos a premium que nunca se bloqueó).
        const claimedUserId = extractUserIdFromRequest(request, body, responseBody)
        const identity = buildLogIdentity(await resolveVerifiedUserId(), claimedUserId)

        const logInput = {
          id: errorRef,
          endpoint,
          errorType: response.status >= 500 ? 'unknown' : classifyHttpStatus(response.status),
          errorMessage,
          questionId: (body?.questionId as string) || undefined,
          userId: identity.userId,
          requestBody: identity.identityMismatch
            ? { ...(sanitizedBody ?? {}), _claimedUserId: identity.claimedUserId, _userIdVerified: identity.userIdVerified }
            : sanitizedBody,
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
      const throwIdentity = buildLogIdentity(await resolveVerifiedUserId(), extractUserIdFromRequest(request, body, null))
      const throwErrorMessage = error instanceof Error ? error.message : String(error)
      const throwErrorStack = error instanceof Error ? error.stack : undefined
      const durationMs = Date.now() - startTime

      // 5xx por throw: awaitar (ver justificación arriba en bloque 4xx/5xx).
      // Tráfico sintético (canary): saltamos VLE — no debe contar como error
      // user-facing; el emit request_completed de abajo (marcado synthetic)
      // conserva la traza.
      if (!synthetic) {
        await logValidationErrorAwait({
          id: errorRef,
          endpoint,
          errorType: classifyError(error),
          errorMessage: throwErrorMessage,
          errorStack: throwErrorStack,
          questionId: (body?.questionId as string) || undefined,
          userId: throwIdentity.userId,
          requestBody: throwIdentity.identityMismatch
            ? { ...(body ? sanitizeRequestBody(body) : {}), _claimedUserId: throwIdentity.claimedUserId, _userIdVerified: throwIdentity.userIdVerified }
            : (body ? sanitizeRequestBody(body) : undefined),
          severity: 'critical',
          httpStatus: 500,
          durationMs,
          userAgent,
        })
      }

      // Emit request_completed también en el catch (antes solo se emitía
      // en el path try → 5xx por throw nunca llegaban a obs_events,
      // dejando hueco de observabilidad). Incluye stack truncado a 2KB
      // (suficiente para diagnóstico, no satura tabla).
      after(async () => {
        await emit({
          source: 'vercel',
          severity: synthetic ? 'info' : 'error',
          eventType: 'request_completed',
          endpoint,
          userId: throwIdentity.userId,
          httpStatus: 500,
          durationMs,
          deployVersion: DEPLOY_VERSION,
          errorMessage: throwErrorMessage.slice(0, 2000),
          metadata: {
            host: request?.headers?.get?.('host') ?? null,
            method: request?.method ?? 'GET',
            sampled: 'false',
            errorRef,
            errorStack: throwErrorStack?.slice(0, 2000) || null,
            capturedFromThrow: true,
            ...(synthetic ? { synthetic: true } : {}),
            ...identityMetadata(throwIdentity),
          },
        })
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
