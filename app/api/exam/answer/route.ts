// app/api/exam/answer/route.ts - API para guardar respuestas individuales de examen
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseSaveAnswerRequest,
  saveAnswer,
  getTestOwnerId,
} from '@/lib/api/exam'
import { requireDuenoDelRecurso } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { checkRateLimit, getClientIp, RATE_LIMIT_ANON_ANSWER } from '@/lib/api/rateLimit'
import { ipDeConfianza } from '@/lib/api/clientIp'
import { getDailyLimitStatus, checkDeviceDailyUsage, incrementDailyCount, debeConsumirCupo } from '@/lib/api/dailyLimit'
import { registerAndCheckDevice, getDeviceIdFromRequest, getHwFingerprintFromRequest } from '@/lib/api/deviceLimit'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'
// Evitar 504 de Vercel (default 300s): fail fast
export const maxDuration = 30

const ENDPOINT = '/api/exam/answer'

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

    // El examen admite tomarse sin sesión (anónimo), así que la identidad puede ser
    // `null` — pero si el test TIENE dueño, tiene que ser quien pide. [T-565]: hasta
    // hoy esto solo se comprobaba cuando el body traía `userId` (opcional, y puesto
    // por el CLIENTE) — bastaba con omitirlo para escribir la respuesta de otra
    // persona en su examen.
    const testOwnerId = await withDbTimeout(() => getTestOwnerId(data.testId), 5_000)
    const identidad = await requireDuenoDelRecurso(request, ENDPOINT, testOwnerId)
    if (!identidad.ok) return identidad.response
    const tokenUserId = identidad.callerUserId

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

    // Shared device daily limit (solo free users — premium bypass).
    // `!degraded`: si el límite vino de un fallback por timeout de BD, NO
    // aplicamos el device-limit (fail-open) — un blip no debe bloquear saves.
    if (!dailyLimit.isPremium && !dailyLimit.degraded) {
      const deviceUsage = await withDbTimeout(
        () => checkDeviceDailyUsage(deviceId, hwFingerprint, ipDeConfianza(request)),
        8_000
      )
      if (deviceUsage && !deviceUsage.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: 'Has alcanzado el límite diario de preguntas del plan gratuito. Vuelve mañana o pásate a Premium para practicar sin límite.',
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
            : 'Has alcanzado el límite diario de preguntas del plan gratuito. Vuelve mañana o pásate a Premium para practicar sin límite.',
          limitReached: true,
          questionsToday: dailyLimit.questionsToday,
          dailyLimit: dailyLimit.dailyLimit,
          isGraduated: dailyLimit.isGraduated,
        },
        { status: 403 }
      )
    }

    // Guardar la respuesta (usa UPSERT internamente). La propiedad del test se
    // comprueba DENTRO, contra `tokenUserId` (del Bearer, arriba) — nunca contra un
    // userId que mande el cliente en el body. Ver [T-565].
    const result = await withDbTimeout(
      () => saveAnswer({ ...data, callerUserId: tokenUserId }),
      15_000
    )

    if (!result.success) {
      console.error('❌ [API/exam/answer] Save failed:', result.error)
      // Fallo por input insuficiente del cliente (p.ej. pregunta nueva sin
      // questionId → no se puede derivar correctAnswer) = 422 (culpa del
      // cliente), no 500 (fallo del servidor). Evita contaminar la métrica de
      // 5xx y el veredicto de salud con requests malformadas.
      const status = result.reason === 'not_owner' ? 403 : result.reason === 'invalid_input' ? 422 : 500
      return NextResponse.json(
        { success: false, error: result.error || 'Error guardando respuesta' },
        { status }
      )
    }

    // ── CUPO DIARIO (T-450, 01/08/2026) ──────────────────────────────────────────────
    // Aquí es donde el examen persiste CADA respuesta, así que aquí es donde se cobra:
    // misma regla que `answer-and-save` (cobrar lo que se guarda por primera vez) y con
    // la MISMA política compartida, no con un criterio propio.
    //
    // Hasta hoy aquí había un comentario diciendo que el contador lo subía el cliente
    // (`useDailyQuestionLimit.recordAnswer`) y que no había que tocarlo aquí para no
    // contar dos veces. Ese reparto dejó de existir el 29/07, cuando el cobro se movió
    // del cliente al servidor, y el comentario se quedó describiendo un mundo que ya no
    // era: el examen se quedó SIN NADIE QUE COBRE. Medido: 10.181 respuestas de examen
    // en 7 días sin llegar al contador.
    //
    // Y NO basta con cobrar en `/api/exam/validate` (primer intento, desplegado a las
    // 08:47 UTC del 01/08): ese cobra solo las respuestas que ESTRENA al persistir en
    // bloque, y para cuando corre ya las ha escrito este endpoint una a una durante el
    // examen → cobraba 0. Verificado en producción con el primer examen posterior al
    // deploy: 10 respuestas persistidas entre las 09:00:42 y las 09:04:30, `validate` a
    // las 09:04:32, y ninguna fila en `daily_question_usage`.
    //
    // Los dos cobros son COMPLEMENTARIOS y no se solapan por construcción: `validate`
    // solo cobra lo que aquí no se llegó a guardar (la red del save fallido).
    //
    // Fail-silent: el cobro del cupo nunca puede tumbar el guardado de una respuesta que
    // el usuario ya ha dado. Si falla, se lleva la pregunta gratis.
    if (debeConsumirCupo(result.saveAction, dailyLimit.isPremium)) {
      await incrementDailyCount(tokenUserId).catch(() => {})
    }

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
