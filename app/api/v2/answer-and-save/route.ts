// app/api/v2/answer-and-save/route.ts
// Endpoint unificado: validar respuesta + guardar en test_questions + actualizar score
// Reemplaza el flujo fragmentado de TestLayout (validate → save → updateScore → ...)
import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import {
  safeParseAnswerAndSaveRequest,
  validateAndSaveAnswer,
  markActiveStudentIfFirst,
  type AnswerAndSaveResponse,
} from '@/lib/api/v2/answer-and-save'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'
import { getDailyLimitStatus, incrementDailyCount, checkDeviceDailyUsage, debeConsumirCupo } from '@/lib/api/dailyLimit'
import { emit } from '@/lib/observability/emit'
import { marcarFarmeoFireAndForget } from '@/lib/api/fraud/watchList'
import { marcarPersistente } from '@/lib/api/fraud/marcaPersistente'
import { currentDeviceLimitMode, shouldBlock } from '@/lib/security/deviceLimitMode'
import { esFraudeConfirmado } from '@/lib/api/fraud/esConfirmado'
import { registerAndCheckDevice, getDeviceIdFromRequest, getHwFingerprintFromRequest } from '@/lib/api/deviceLimit'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { shouldRouteToBackend, backendUrlFor } from '@/lib/api/backend-router'

// Margen para cold start + conexión BD
export const maxDuration = 30

// Quick-fail timeouts (Phase 3). El path tiene 2 fases lentas posibles:
//   - Anti-fraud Promise.all: 3 RPCs en paralelo, normalmente <500ms
//   - validateAndSaveAnswer: insert + 8 triggers, normalmente <500ms
// Cuando el pooler parpadea, ambas pueden colgar 30s al statement_timeout.
// Cortamos antes para liberar la lambda y devolver 503 retryable.
//
// AUTH: usa wrapper verifyAuth con shadow mode (Phase 0.7 piloto).
// Modo controlado por env JWT_LOCAL_VERIFY_MODE:
//   off    → Solo getUser() remoto (default, comportamiento actual 250-1000ms)
//   shadow → Ambos en paralelo, log diff, sirve remoto (validación pre-flip)
//   on     → Solo verifyJwtLocal (latencia <5ms, ahorra round-trip)
// Plan: deploy con default off → activar shadow 24-48h → si 0 diff → flip a on.
// 28/05/2026: subido de 10000 → 25000. El cap de 10s mataba ~49k req/día
// (98.2% de los 503 de answer-and-save tenían duration_ms exactamente 10-11s).
// Las 3 RPCs antifraude paralelas pueden tardar 10-20s bajo carga BD.
// statement_timeout Postgres (30s) sigue siendo backstop final.
// Ver docs/roadmap/incidente-answer-save-503-28-05.md
const ANTIFRAUD_TIMEOUT_MS = 25000
// 29/05/2026 05:01 UTC: subido de 15000 → 25000. Bajo carga real, el INSERT
// a test_questions + 27 triggers en cascada tarda >15s ocasionalmente,
// disparando withDbTimeout(15s) → 503. Alineado con ANTIFRAUD_TIMEOUT_MS y
// cliente timeoutMs (ambos 25s) + statement_timeout PG (30s) como backstop.
// Parche acotado: la solución estructural es cutover Sprint 1 outbox (DROP
// TRIGGER × 20 → INSERT pasa a <100ms). Ver docs/runbooks/outbox-cutover.md
const VALIDATE_AND_SAVE_TIMEOUT_MS = 25000

async function _POST(request: NextRequest): Promise<NextResponse<AnswerAndSaveResponse | { success: false; error: string }>> {
  const startTime = Date.now()

  try {
    // 1. Auth via wrapper (soporta off/shadow/on via env JWT_LOCAL_VERIFY_MODE)
    const auth = await verifyAuth(request, '/api/v2/answer-and-save')
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: auth.reason === 'no_bearer_token' ? 'No autorizado' : 'Usuario no autenticado' } as const,
        { status: 401 },
      )
    }
    // Variable `user` para mantener compatibilidad con código existente.
    // Solo se usa user.id en el resto del handler.
    const user = { id: auth.userId, email: auth.email }

    // 2. Parse + validate body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'JSON inválido' } as const,
        { status: 400 },
      )
    }

    const parsed = safeParseAnswerAndSaveRequest(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: `Validación: ${firstError?.path.join('.')} - ${firstError?.message}` } as const,
        { status: 400 },
      )
    }

    // ─── Bloque 3 canary: proxy condicional al backend NestJS/Fargate ──
    // Si flag ON, reenviamos al backend (api.vence.es) que ejecuta TODO
    // (auth + Zod + antifraud + validate + save + background) en proceso
    // largo, sin pool max:1. Fallback graceful al path Vercel local si
    // falla — el frontend nunca ve 5xx por el proxy.
    if (shouldRouteToBackend('answer-and-save')) {
      try {
        const backendUrl = backendUrlFor('api/v2/answer-and-save')
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 25000) // 25s — POST puede ser lento bajo carga
        try {
          const backendRes = await fetch(backendUrl, {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              // Reenviar headers críticos del cliente al backend.
              authorization: request.headers.get('authorization') ?? '',
              'x-device-id': request.headers.get('x-device-id') ?? '',
              'x-hw-fingerprint': request.headers.get('x-hw-fingerprint') ?? '',
              'user-agent': request.headers.get('user-agent') ?? '',
              'x-forwarded-by': 'vercel-proxy',
            },
            body: JSON.stringify(parsed.data),
          })
          clearTimeout(timer)
          const respBody = await backendRes.text()
          return new NextResponse(respBody, {
            status: backendRes.status,
            headers: {
              'Content-Type': backendRes.headers.get('content-type') ?? 'application/json',
              'x-served-by': backendRes.headers.get('x-served-by') ?? 'vence-backend-proxy',
              ...(backendRes.headers.get('retry-after')
                ? { 'Retry-After': backendRes.headers.get('retry-after') ?? '' }
                : {}),
            },
          })
        } finally {
          clearTimeout(timer)
        }
      } catch (backendError) {
        console.warn(
          `⚠️ [answer-and-save proxy] backend canary falló (${(backendError as Error).message ?? 'unknown'}), fallback a Vercel local`,
        )
        // Caemos al código local de abajo (antifraud + validate + save)
      }
    }

    // 3. Anti-fraud checks in parallel (device limit + daily limits)
    // All three RPCs are independent — run them concurrently to save ~400ms
    const deviceId = getDeviceIdFromRequest(request)
    const hwFingerprint = getHwFingerprintFromRequest(request)
    const [deviceCheck, dailyLimit, deviceUsage] = await withDbTimeout(
      () => Promise.all([
        registerAndCheckDevice(user.id, deviceId, request.headers.get('user-agent'), hwFingerprint),
        getDailyLimitStatus(user.id),
        checkDeviceDailyUsage(deviceId, hwFingerprint),
      ]),
      ANTIFRAUD_TIMEOUT_MS,
    )

    if (!deviceCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Ya tienes ${deviceCheck.deviceCount} dispositivos conectados (${deviceCheck.existingDevices || 'desconocidos'}). Para usar este, desconecta uno de ellos.`,
          deviceLimitReached: true,
          deviceCount: deviceCheck.deviceCount,
          maxDevices: deviceCheck.maxDevices,
          existingDevices: deviceCheck.existingDevices,
          userId: user.id, // Para que withErrorLogging pueda logar el userId en /admin/fraudes
        } as const,
        { status: 403 },
      )
    }

    // Shared device daily limit (solo para free users).
    // `!degraded`: si el daily-limit vino de un fallback por timeout de BD,
    // fail-open — un blip no debe bloquear a un usuario (free ni premium).
    // MODO SOMBRA (T-304). El ancla nueva agrupa cuentas que antes no se agrupaban: antes de
    // cortarle el servicio a nadie se mide, sobre tráfico real, lo que HABRÍA pasado. Por defecto
    // `shadow` — un despliegue sin decidir mide, no corta.
    const deviceLimitMode = currentDeviceLimitMode()
    // CORTE DIRIGIDO a los ya confirmados (decisión de Manuel, 30/07). El modo global arranca en
    // `shadow` para no cortar a ciegas mientras se mide, pero eso sobra con 8 dispositivos
    // revisados uno a uno y con evidencia (correos que son variantes del mismo nombre, cupos
    // agotados en cadena la misma noche). A ellos se les aplica ya.
    // No es un bloqueo de cuenta: las cuentas del mismo equipo comparten los 25 del día.
    const confirmado = await esFraudeConfirmado({
      userId: user.id,
      deviceId,
      fingerprint: hwFingerprint,
    }).catch(() => false)
    if (!dailyLimit.isPremium && !dailyLimit.degraded && deviceUsage && !deviceUsage.allowed) {
      // OBSERVABLE A PROPÓSITO (T-304). Este bloqueo llevaba desde el 17/04 sin dejar rastro
      // alguno: por eso pudo estar tres meses sin cortar una sola vez —con 3-11 dispositivos al
      // día pasándose del tope— sin que nadie se enterara. Un enforcement que no se puede contar
      // no se puede vigilar, y lo que no se vigila se rompe en silencio.
      await emit({
        source: 'vercel',
        severity: 'warn',
        eventType: 'device_daily_limit_blocked',
        endpoint: '/api/v2/answer-and-save',
        userId: user.id,
        httpStatus: 403,
        errorMessage: `Dispositivo bloqueado: ${deviceUsage.deviceTotal} preguntas hoy entre sus cuentas`,
        metadata: {
          deviceTotal: deviceUsage.deviceTotal,
          // Qué ancla lo cazó: si esto es siempre `device_id`, la huella v2 no está llegando.
          anchor: hwFingerprint?.startsWith('fp2_') ? 'fingerprint_v2' : 'device_id',
          hasFingerprintV2: Boolean(hwFingerprint?.startsWith('fp2_')),
          // `shadow` = se registró pero NO se bloqueó. Es lo que se analiza antes de activar.
          mode: deviceLimitMode,
          // `dirigido` = cortado por estar CONFIRMADO, aunque el modo global sea shadow.
          dirigido: confirmado,
        },
      })
      // Y queda ANOTADO en su perfil (`fraud_watch_list`, idempotente por usuario: reincidir
      // sube la puntuación en vez de duplicar filas). Anotar es consecuencia del bloqueo, nunca
      // condición: fire-and-forget para que un fallo aquí no convierta un 403 correcto en un 500.
      // En sombra NO se marca el perfil: marcar a alguien por un bloqueo que no ha ocurrido
      // sería ensuciar su ficha con una sospecha que aún no hemos validado. Con los CONFIRMADOS
      // sí se marca aunque el modo global sea shadow: ahí la sospecha ya está validada a mano.
      if (shouldBlock(deviceLimitMode) || confirmado) {
        marcarFarmeoFireAndForget({
          userId: user.id,
          deviceTotal: deviceUsage.deviceTotal,
          anchor: hwFingerprint?.startsWith('fp2_') ? 'fingerprint_v2' : 'device_id',
          deviceRef: (hwFingerprint || deviceId || '').slice(0, 40) || null,
        })
        // Y la marca que SOBREVIVE al borrado de la cuenta: `fraud_watch_list` cuelga de
        // `user_id` con ON DELETE CASCADE, así que pedir la baja borraría el historial y
        // permitiría empezar limpio. Esta va anclada al dispositivo y guarda el hash del correo.
        void marcarPersistente({
          deviceId,
          fingerprint: hwFingerprint,
          userIds: [user.id],
          emails: [user.email].filter((e): e is string => Boolean(e)),
          motivo: `Tope de dispositivo superado: ${deviceUsage.deviceTotal} preguntas en el día entre varias cuentas`,
        }).catch(() => {})
      }
      if (shouldBlock(deviceLimitMode) || confirmado) {
        return NextResponse.json(
          {
            success: false,
            error: 'Has alcanzado el límite diario de preguntas del plan gratuito. Vuelve mañana o pásate a Premium para practicar sin límite.',
            limitReached: true,
            questionsToday: deviceUsage.deviceTotal,
          } as const,
          { status: 403 },
        )
      }
      // En `shadow` se sigue como si nada: el usuario responde con normalidad y nosotros ya
      // tenemos el dato de que habría sido bloqueado.
    }

    // Per-user daily limit enforcement (free users only)
    if (!dailyLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: dailyLimit.isGraduated
            ? 'Vence tiene mucha demanda actualmente. Actualiza a Premium para acceso prioritario.'
            : 'Has alcanzado el límite diario de preguntas del plan gratuito. Vuelve mañana o pásate a Premium para practicar sin límite.',
          limitReached: true,
          questionsToday: dailyLimit.questionsToday,
          dailyLimit: dailyLimit.dailyLimit,
          isGraduated: dailyLimit.isGraduated,
        } as const,
        { status: 403 },
      )
    }

    // 4. Ejecutar: validar + guardar + actualizar score
    const result = await withDbTimeout(
      () => validateAndSaveAnswer(parsed.data, user.id),
      VALIDATE_AND_SAVE_TIMEOUT_MS,
    )

    const totalMs = Date.now() - startTime
    if (totalMs > 2000) {
      console.warn(`⚠️ [answer-and-save] Respuesta lenta: ${totalMs}ms questionId=${parsed.data.questionId}`)
    }

    // 4. Operaciones background (no bloquean la respuesta)
    after(async () => {
      try {
        await markActiveStudentIfFirst(user.id)
      } catch (e) {
        console.warn('⚠️ [after] Error en operaciones background:', e)
      }
      // Invalidar caches del user en Redis (fire-and-forget, no bloquea respuesta).
      // Tras responder, sus stats y exam-pending pueden haber cambiado.
      try {
        const { invalidateMany } = await import('@/lib/cache/redis')
        await invalidateMany([
          `user_stats:${user.id}`,
          `exam_pending:${user.id}:all:10`,
          `exam_pending:${user.id}:exam:10`,
          `exam_pending:${user.id}:practice:10`,
          `theme_stats:${user.id}`,
        ])
      } catch {
        // Si Redis falla, el TTL eventualmente refresca el valor stale
      }
    })

    if (!result.success) {
      // save_failed: validación OK pero insert en test_questions falló
      // 404: pregunta no encontrada (correctOption === null)
      // NO incrementar daily count — la respuesta no se guardó
      const status = result.saveAction === 'save_failed' ? 500 : 404
      return NextResponse.json(result, { status })
    }

    // 5. COBRO DEL CUPO DIARIO — lo hace el SERVIDOR, y solo si la respuesta se
    // ha persistido por primera vez (`saved_new`). La idempotencia la da el
    // constraint único de `test_questions`: un reintento de la cola o un doble
    // clic devuelven `already_saved` y no vuelven a cobrar.
    //
    // Antes lo hacía SOLO el cliente (`useDailyQuestionLimit.recordAnswer`), lo que
    // desacoplaba el cobro del guardado: se consumía cupo por respuestas que nunca
    // llegaban a `test_questions` (sesión sin crear, cola caída) y por eventos
    // repetidos. Medido en 14 días: 41 usuarios free agotaron el tope de 25 con una
    // media de 13 respuestas reales (caso Sergio, 29/07/2026).
    //
    // Fail-silent dentro de incrementDailyCount: si el contador falla, el usuario
    // se lleva una pregunta gratis — nunca un bloqueo indebido.
    if (debeConsumirCupo(result.saveAction, dailyLimit.isPremium)) {
      // `.catch` explícito además del fail-silent interno: el cobro del cupo NUNCA
      // puede convertir en 5xx una respuesta que el usuario ya tiene validada y
      // guardada. Si el contador falla, se lleva una pregunta gratis.
      await incrementDailyCount(user.id).catch(() => {})
    }

    return NextResponse.json(result)
  } catch (error) {
    if (isDbTimeoutError(error)) {
      const totalMs = Date.now() - startTime
      console.warn(`⏱️ [answer-and-save] Timeout (quick-fail) tras ${totalMs}ms:`, error.timeoutMs, 'ms')
      return NextResponse.json(
        {
          success: false,
          error: 'Servicio saturado momentáneamente. Reintenta en 5 minutos.',
          retryable: true,
        } as const,
        { status: 503, headers: { 'Retry-After': '300' } },
      )
    }
    const totalMs = Date.now() - startTime
    console.error(`❌ [answer-and-save] Error tras ${totalMs}ms:`, error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' } as const,
      { status: 500 },
    )
  }
}

async function _GET() {
  return NextResponse.json(
    { success: false, error: 'Método no permitido. Usa POST.' } as const,
    { status: 405 },
  )
}

export const POST = withErrorLogging('/api/v2/answer-and-save', _POST)
export const GET = withErrorLogging('/api/v2/answer-and-save', _GET)
