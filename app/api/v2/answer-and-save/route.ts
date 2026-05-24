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
import { getDailyLimitStatus, incrementDailyCount, checkDeviceDailyUsage } from '@/lib/api/dailyLimit'
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
const ANTIFRAUD_TIMEOUT_MS = 10000
const VALIDATE_AND_SAVE_TIMEOUT_MS = 15000

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
        checkDeviceDailyUsage(deviceId),
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

    // Shared device daily limit (solo para free users)
    if (!dailyLimit.isPremium && deviceUsage && !deviceUsage.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Este dispositivo ha alcanzado el límite diario de preguntas. Vuelve mañana o hazte premium.',
          limitReached: true,
          questionsToday: deviceUsage.deviceTotal,
        } as const,
        { status: 403 },
      )
    }

    // Per-user daily limit enforcement (free users only)
    if (!dailyLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: dailyLimit.isGraduated
            ? 'Vence tiene mucha demanda actualmente. Actualiza a Premium para acceso prioritario.'
            : 'Has alcanzado el límite diario de preguntas. Vuelve mañana o hazte premium.',
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

    // Daily count se incrementa en el frontend (useDailyQuestionLimit.recordAnswer)
    // No incrementar aquí para evitar doble conteo

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
