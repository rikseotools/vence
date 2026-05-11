// app/api/exam/answer/route.ts - API para guardar respuestas individuales de examen
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseSaveAnswerRequest,
  saveAnswer,
  verifyTestOwnership
} from '@/lib/api/exam'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { checkRateLimit, getClientIp, RATE_LIMIT_ANON_ANSWER } from '@/lib/api/rateLimit'
import { getDailyLimitStatus, checkDeviceDailyUsage, getUserIdFromToken } from '@/lib/api/dailyLimit'
import { registerAndCheckDevice, getDeviceIdFromRequest, getHwFingerprintFromRequest } from '@/lib/api/deviceLimit'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'
// Evitar 504 de Vercel (default 300s): fail fast
export const maxDuration = 30

async function _POST(request: NextRequest) {
  let body: Record<string, unknown> | undefined

  try {
    body = await request.json()

    // Validar request con Zod
    const parseResult = safeParseSaveAnswerRequest(body)

    if (!parseResult.success) {
      console.error('❌ [API/exam/answer] Validation error:', parseResult.error.issues)
      return NextResponse.json(
        {
          success: false,
          error: 'Datos de respuesta inválidos',
          details: parseResult.error.issues.map(i => i.message),
        },
        { status: 400 }
      )
    }

    const data = parseResult.data

    // Extract userId from Bearer token (trusted) instead of body (untrusted)
    const tokenUserId = await withDbTimeout(
      () => getUserIdFromToken(request),
      5_000
    )

    // Anonymous users: max 5 per IP per day
    if (!tokenUserId) {
      const ip = getClientIp(request)
      const anonCheck = checkRateLimit(ip, RATE_LIMIT_ANON_ANSWER)
      if (!anonCheck.allowed) {
        return NextResponse.json(
          { success: false, error: 'Inicia sesión para seguir respondiendo preguntas.', authRequired: true },
          { status: 401 }
        )
      }
    }

    const deviceId = getDeviceIdFromRequest(request)

    const hwFingerprint = getHwFingerprintFromRequest(request)
    const deviceCheck = await withDbTimeout(
      () => registerAndCheckDevice(tokenUserId, deviceId, request.headers.get('user-agent'), hwFingerprint),
      8_000
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
        },
        { status: 403 }
      )
    }

    const dailyLimit = await withDbTimeout(
      () => getDailyLimitStatus(tokenUserId),
      8_000
    )

    // Shared device daily limit (solo free users — premium bypass)
    if (!dailyLimit.isPremium) {
      const deviceUsage = await withDbTimeout(
        () => checkDeviceDailyUsage(deviceId),
        8_000
      )
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

    // Si se proporciona userId, verificar propiedad del test
    if (body?.userId) {
      const requestUserId = body.userId as string
      const isOwner = await withDbTimeout(
        () => verifyTestOwnership(data.testId, requestUserId),
        8_000
      )
      if (!isOwner) {
        return NextResponse.json(
          { success: false, error: 'No tienes acceso a este test' },
          { status: 403 }
        )
      }
    }

    // Guardar la respuesta (usa UPSERT internamente)
    const result = await withDbTimeout(
      () => saveAnswer(data),
      15_000
    )

    if (!result.success) {
      console.error('❌ [API/exam/answer] Save failed:', result.error)
      return NextResponse.json(
        { success: false, error: result.error || 'Error guardando respuesta' },
        { status: 500 }
      )
    }

    // Daily count se incrementa en el frontend (useDailyQuestionLimit.recordAnswer)
    // No incrementar aquí para evitar doble conteo

    return NextResponse.json({
      success: true,
      answerId: result.answerId,
      isCorrect: result.isCorrect,
    })
  } catch (error) {
    console.error('❌ [API/exam/answer] Error:', error)
    if (isDbTimeoutError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Base de datos temporalmente lenta. Reintenta en unos segundos.',
          retryable: true,
        },
        { status: 503, headers: { 'Retry-After': '5' } }
      )
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/exam/answer', _POST)
