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
import { checkAndIncrementDailyLimit, checkDeviceDailyUsage, getUserIdFromToken } from '@/lib/api/dailyLimit'
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
    const deviceId = getDeviceIdFromRequest(request)

    const deviceCheck = await registerAndCheckDevice(tokenUserId, deviceId, request.headers.get('user-agent'))
    if (!deviceCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Has alcanzado el límite de dispositivos. Usa uno de tus dispositivos registrados o hazte premium.',
          deviceLimitReached: true,
          deviceCount: deviceCheck.deviceCount,
          maxDevices: deviceCheck.maxDevices,
        },
        { status: 403 }
      )
    }

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

    const dailyLimit = await checkAndIncrementDailyLimit(tokenUserId)
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
