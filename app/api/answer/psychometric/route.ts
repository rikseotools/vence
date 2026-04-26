// app/api/answer/psychometric/route.ts
// API unificada: validar respuesta + guardar + actualizar sesión
// Todo en una sola llamada para máxima fiabilidad en conexiones inestables (4G)

import { NextRequest, NextResponse } from 'next/server'

// Dar margen al cold start de Vercel + conexión a Supabase
export const maxDuration = 30

import {
  psychometricAnswerRequestSchema,
  validateAndSavePsychometricAnswer,
} from '@/lib/api/psychometric-answer'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { checkRateLimit, getClientIp, RATE_LIMIT_ANON_ANSWER } from '@/lib/api/rateLimit'
import { getDailyLimitStatus, incrementDailyCount, checkDeviceDailyUsage, getUserIdFromToken } from '@/lib/api/dailyLimit'
import { registerAndCheckDevice, getDeviceIdFromRequest } from '@/lib/api/deviceLimit'
// ============================================
// ENDPOINT POST
// ============================================

async function _POST(request: NextRequest) {
  const startTime = Date.now()
  let body: Record<string, unknown> | undefined

  try {
    body = await request.json()

    // Validar request con Zod
    const validation = psychometricAnswerRequestSchema.safeParse(body)

    if (!validation.success) {
      console.error('❌ [API/psychometric-answer] Validación fallida:', validation.error.flatten())
return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          details: validation.error.flatten(),
        },
        { status: 400 }
      )
    }

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
          error: `Ya tienes ${deviceCheck.deviceCount} dispositivos conectados (${deviceCheck.existingDevices || 'desconocidos'}). Para usar este, desconecta uno de ellos.`,
          deviceLimitReached: true,
          deviceCount: deviceCheck.deviceCount,
          maxDevices: deviceCheck.maxDevices,
          existingDevices: deviceCheck.existingDevices,
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

    // Validar + guardar (todo en una operación)
    const result = await validateAndSavePsychometricAnswer(validation.data)

    if (!result.success) {
return NextResponse.json(
        {
          success: false,
          error: result.error,
          isCorrect: false,
          correctAnswer: 0,
        },
        { status: 404 }
      )
    }

    // Daily count se incrementa en el frontend (useDailyQuestionLimit.recordAnswer)
    // No incrementar aquí para evitar doble conteo

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/psychometric-answer] Error:', error)
return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        isCorrect: false,
        correctAnswer: 0,
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

export const POST = withErrorLogging('/api/answer/psychometric', _POST)
export const GET = withErrorLogging('/api/answer/psychometric', _GET)
