// app/api/exam/answer/route.ts - API para guardar respuestas individuales de examen
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseSaveAnswerRequest,
  saveAnswer,
  verifyTestOwnership
} from '@/lib/api/exam'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { checkRateLimit, getClientIp, RATE_LIMIT_ANON_ANSWER } from '@/lib/api/rateLimit'
import { getDailyLimitStatus, incrementDailyCount, checkDeviceDailyUsage, getUserIdFromToken } from '@/lib/api/dailyLimit'
import { registerAndCheckDevice, getDeviceIdFromRequest } from '@/lib/api/deviceLimit'
// Evitar 504 de Vercel (default 300s): fail fast
export const maxDuration = 30

async function _POST(request: NextRequest) {
  const startTime = Date.now()
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
    const tokenUserId = await getUserIdFromToken(request)

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

    const deviceCheck = await registerAndCheckDevice(tokenUserId, deviceId, request.headers.get('user-agent'))
    if (!deviceCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: deviceCheck.isPremium
            ? 'Has alcanzado el límite de dispositivos. Usa uno de tus dispositivos registrados o contacta con soporte.'
            : 'Has alcanzado el límite de dispositivos. Usa uno de tus dispositivos registrados o hazte premium.',
          deviceLimitReached: true,
          deviceCount: deviceCheck.deviceCount,
          maxDevices: deviceCheck.maxDevices,
        },
        { status: 403 }
      )
    }

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
          error: 'Has alcanzado el límite diario de preguntas. Vuelve mañana o hazte premium.',
          limitReached: true,
          questionsToday: dailyLimit.questionsToday,
        },
        { status: 403 }
      )
    }

    // Si se proporciona userId, verificar propiedad del test
    if (body?.userId) {
      const isOwner = await verifyTestOwnership(data.testId, body.userId as string)
      if (!isOwner) {
        return NextResponse.json(
          { success: false, error: 'No tienes acceso a este test' },
          { status: 403 }
        )
      }
    }

    // Guardar la respuesta (usa UPSERT internamente)
    const result = await saveAnswer(data)

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
