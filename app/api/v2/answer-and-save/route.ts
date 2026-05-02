// app/api/v2/answer-and-save/route.ts
// Endpoint unificado: validar respuesta + guardar en test_questions + actualizar score
// Reemplaza el flujo fragmentado de TestLayout (validate → save → updateScore → ...)
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import {
  safeParseAnswerAndSaveRequest,
  validateAndSaveAnswer,
  markActiveStudentIfFirst,
  type AnswerAndSaveResponse,
} from '@/lib/api/v2/answer-and-save'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getDailyLimitStatus, incrementDailyCount, checkDeviceDailyUsage } from '@/lib/api/dailyLimit'
import { registerAndCheckDevice, getDeviceIdFromRequest, getHwFingerprintFromRequest } from '@/lib/api/deviceLimit'

// Margen para cold start + conexión BD
export const maxDuration = 30

async function _POST(request: NextRequest): Promise<NextResponse<AnswerAndSaveResponse | { success: false; error: string }>> {
  const startTime = Date.now()

  try {
    // 1. Auth: verificar Bearer token
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' } as const,
        { status: 401 },
      )
    }

    const token = authHeader.split(' ')[1]
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no autenticado' } as const,
        { status: 401 },
      )
    }

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

    // 3. Anti-fraud checks in parallel (device limit + daily limits)
    // All three RPCs are independent — run them concurrently to save ~400ms
    const deviceId = getDeviceIdFromRequest(request)
    const hwFingerprint = getHwFingerprintFromRequest(request)
    const [deviceCheck, dailyLimit, deviceUsage] = await Promise.all([
      registerAndCheckDevice(user.id, deviceId, request.headers.get('user-agent'), hwFingerprint),
      getDailyLimitStatus(user.id),
      checkDeviceDailyUsage(deviceId),
    ])

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
    const result = await validateAndSaveAnswer(parsed.data, user.id)

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
