// app/api/answer/route.ts
// API para validar respuestas de forma segura
// La respuesta correcta SOLO se revela después de recibir la respuesta del usuario
import { NextRequest, NextResponse } from 'next/server'
import { safeParseAnswerRequest, validateAnswer } from '../../../lib/api/answers'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { checkRateLimit, getClientIp, RATE_LIMIT_ANSWER, RATE_LIMIT_ANON_ANSWER } from '@/lib/api/rateLimit'
import { logValidationError } from '@/lib/api/validation-error-log'
import { getDailyLimitStatus, incrementDailyCount, checkDeviceDailyUsage, getUserIdFromToken } from '@/lib/api/dailyLimit'
import { registerAndCheckDevice, getDeviceIdFromRequest, getHwFingerprintFromRequest } from '@/lib/api/deviceLimit'
// Dar margen al cold start de Vercel + conexión a Supabase
export const maxDuration = 30

async function _POST(request: NextRequest) {
  // Rate limiting anti-scraping
  const ip = getClientIp(request)
  const rateCheck = checkRateLimit(ip, RATE_LIMIT_ANSWER)
  if (!rateCheck.allowed) {
    logValidationError({
      endpoint: '/api/answer',
      errorType: 'rate_limit',
      errorMessage: `Rate limit exceeded: ${ip}`,
      severity: 'warning',
      httpStatus: 429,
      userAgent: request.headers.get('user-agent'),
    })
    return NextResponse.json(
      { success: false, error: 'Demasiadas solicitudes. Espera un momento.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rateCheck.resetMs / 1000)) } }
    )
  }

  const startTime = Date.now()
  let body: Record<string, unknown> | undefined

  try {
    body = await request.json()

    // Validar request con Zod
    const validation = safeParseAnswerRequest(body)

    if (!validation.success) {
      console.error('❌ [API/answer] Validación fallida:', validation.error.flatten())
      return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          details: validation.error.flatten()
        },
        { status: 400 }
      )
    }

    // Extract userId from Bearer token (trusted) instead of body (untrusted)
    const tokenUserId = await getUserIdFromToken(request)

    // Anonymous users: max 5 answer validations per IP per day
    if (!tokenUserId) {
      const anonCheck = checkRateLimit(ip, RATE_LIMIT_ANON_ANSWER)
      if (!anonCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: 'Inicia sesión para seguir respondiendo preguntas.',
            authRequired: true,
          },
          { status: 401 }
        )
      }
    }

    const deviceId = getDeviceIdFromRequest(request)

    // Device limit check (free: 2, premium: 3)
    const hwFingerprint = getHwFingerprintFromRequest(request)
    const deviceCheck = await registerAndCheckDevice(tokenUserId, deviceId, request.headers.get('user-agent'), hwFingerprint)
    if (!deviceCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Ya tienes ${deviceCheck.deviceCount} dispositivos conectados (${deviceCheck.existingDevices || 'desconocidos'}). Para usar este, desconecta uno de ellos.`,
          deviceLimitReached: true,
          deviceCount: deviceCheck.deviceCount,
          maxDevices: deviceCheck.maxDevices,
          existingDevices: deviceCheck.existingDevices,
        },
        { status: 403 }
      )
    }

    // Per-user daily limit CHECK (read-only, increment after save)
    const dailyLimit = await getDailyLimitStatus(tokenUserId)

    // Shared device daily limit (solo free users — premium bypass)
    if (!dailyLimit.isPremium) {
      const deviceUsage = await checkDeviceDailyUsage(deviceId)
      if (deviceUsage && !deviceUsage.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: 'Este dispositivo ha alcanzado el límite diario de preguntas. Vuelve mañana o hazte premium.',
            limitReached: true,
            questionsToday: deviceUsage.deviceTotal,
          },
          { status: 403 }
        )
      }
    }

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
        },
        { status: 403 }
      )
    }

    // Validar respuesta con Drizzle
    const queryStart = Date.now()
    const result = await validateAnswer(validation.data)
    const queryMs = Date.now() - queryStart
    const totalMs = Date.now() - startTime

    // Logear si la query tarda más de 2s (para diagnóstico de timeouts)
    if (queryMs > 2000) {
      console.warn(`⚠️ [API/answer] Query lenta: ${queryMs}ms (total: ${totalMs}ms) questionId=${validation.data.questionId}`)
    }

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pregunta no encontrada',
          isCorrect: false,
          correctAnswer: 0
        },
        { status: 404 }
      )
    }

    // Daily count se incrementa en el frontend (useDailyQuestionLimit.recordAnswer)
    // No incrementar aquí para evitar doble conteo

    return NextResponse.json(result)

  } catch (error) {
    const totalMs = Date.now() - startTime
    console.error(`❌ [API/answer] Error tras ${totalMs}ms:`, error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        isCorrect: false,
        correctAnswer: 0
      },
      { status: 500 }
    )
  }
}

// Bloquear GET para evitar exposición accidental
async function _GET() {
  return NextResponse.json(
    { error: 'Método no permitido. Usa POST.' },
    { status: 405 }
  )
}

export const POST = withErrorLogging('/api/answer', _POST)
export const GET = withErrorLogging('/api/answer', _GET)
