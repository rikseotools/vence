// app/api/answer/spelling/route.ts
// API para validar respuestas de ortografía/gramática (multi-respuesta)
// La respuesta correcta SOLO se revela después de recibir la respuesta del usuario
import { NextRequest, NextResponse } from 'next/server'
import { safeParseSpellingAnswerRequest, validateSpellingAnswer, saveSpellingAnswer } from '@/lib/api/spelling-answer'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { checkRateLimit, getClientIp, RATE_LIMIT_ANSWER, RATE_LIMIT_ANON_ANSWER } from '@/lib/api/rateLimit'
import { logValidationError } from '@/lib/api/validation-error-log'
import { getDailyLimitStatus, checkDeviceDailyUsage, getUserIdFromToken } from '@/lib/api/dailyLimit'
import { registerAndCheckDevice, getDeviceIdFromRequest } from '@/lib/api/deviceLimit'

export const maxDuration = 30

async function _POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rateCheck = checkRateLimit(ip, RATE_LIMIT_ANSWER)
  if (!rateCheck.allowed) {
    logValidationError({
      endpoint: '/api/answer/spelling',
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

  try {
    const body = await request.json()
    const validation = safeParseSpellingAnswerRequest(body)

    if (!validation.success) {
      console.error('❌ [API/spelling] Validación fallida:', validation.error.flatten())
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Auth & limits (same as /api/answer)
    const tokenUserId = await getUserIdFromToken(request)

    if (!tokenUserId) {
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
          error: `Ya tienes ${deviceCheck.deviceCount} dispositivos conectados (${deviceCheck.existingDevices || 'desconocidos'}). Para usar este, desconecta uno desde tu perfil.`,
          deviceLimitReached: true,
        },
        { status: 403 }
      )
    }

    const dailyLimit = await getDailyLimitStatus(tokenUserId)

    if (!dailyLimit.isPremium) {
      const deviceUsage = await checkDeviceDailyUsage(deviceId)
      if (deviceUsage && !deviceUsage.allowed) {
        return NextResponse.json(
          { success: false, error: 'Este dispositivo ha alcanzado el límite diario. Vuelve mañana o hazte premium.', limitReached: true },
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
        },
        { status: 403 }
      )
    }

    const result = await validateSpellingAnswer(validation.data)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Pregunta no encontrada', score: 0, isFullyCorrect: false, incorrectIndices: [] },
        { status: 404 }
      )
    }

    // Guardar respuesta en background si hay sesión y usuario
    const sessionId = (body as Record<string, unknown>).sessionId as string | undefined
    const questionOrder = (body as Record<string, unknown>).questionOrder as number | undefined
    const timeSpentSeconds = (body as Record<string, unknown>).timeSpentSeconds as number | undefined

    if (sessionId && tokenUserId && questionOrder) {
      saveSpellingAnswer({
        sessionId,
        userId: tokenUserId,
        questionId: validation.data.questionId,
        questionOrder,
        selectedIndices: validation.data.selectedIndices,
        incorrectIndices: result.incorrectIndices,
        isCorrect: result.isFullyCorrect,
        timeSpentSeconds: timeSpentSeconds || null,
      }).catch(err => console.error('❌ [API/spelling] Error guardando respuesta:', err))
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/spelling] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor', score: 0, isFullyCorrect: false, incorrectIndices: [] },
      { status: 500 }
    )
  }
}

async function _GET() {
  return NextResponse.json({ error: 'Método no permitido. Usa POST.' }, { status: 405 })
}

export const POST = withErrorLogging('/api/answer/spelling', _POST)
export const GET = withErrorLogging('/api/answer/spelling', _GET)
