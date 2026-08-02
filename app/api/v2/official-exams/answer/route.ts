import { NextRequest, NextResponse } from 'next/server'
import { safeParseSaveOfficialExamAnswer, saveOfficialExamAnswer } from '@/lib/api/official-exams'
import { debeConsumirCupo, incrementDailyCount } from '@/lib/api/dailyLimit'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
/**
 * POST /api/v2/official-exams/answer
 *
 * Save individual answer during official exam (auto-save).
 * Updates test_questions where test_id and question_order match.
 *
 * Request body:
 * - testId: string (UUID)
 * - questionOrder: number (1-indexed)
 * - userAnswer: string ('a', 'b', 'c', or 'd')
 *
 * Returns:
 * - success: boolean
 * - answerId: string (if successful)
 * - error: string (if failed)
 *
 * Note: This endpoint does NOT require authentication to minimize latency.
 * Security is ensured by requiring a valid testId (UUID) that was created
 * via the authenticated /init endpoint.
 */
async function _POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const parseResult = safeParseSaveOfficialExamAnswer(body)

    if (!parseResult.success) {
      console.error('❌ [API/v2/official-exams/answer] Validation error:', parseResult.error.issues)
      return NextResponse.json(
        {
          success: false,
          error: 'Datos de entrada inválidos',
          details: parseResult.error.issues.map(i => i.message),
        },
        { status: 400 }
      )
    }

    // Save the answer
    const result = await saveOfficialExamAnswer(parseResult.data)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    // CUPO (T-450, 02/08/2026): el simulacro era el segundo camino que respondía sin
    // pasar por el contador diario. Medido antes de tocarlo: 100 usuarios free y 4.975
    // respuestas en 7 días sin cobrar. El examen normal ya cobraba aquí desde el 01/08;
    // este endpoint, no — y comparten el mismo modo de fallo (filas pre-creadas, así que
    // guardar es un UPDATE y «ya existía» se confundía con «ya había respondido»).
    //
    // Misma política que el resto (`debeConsumirCupo`), mismo incremento
    // (`incrementDailyCount`, que también corta premium en la propia función SQL) y el
    // mismo fail-silent: cobrar el cupo NUNCA puede tumbar el guardado de una respuesta
    // que el usuario ya ha dado — si el cobro falla, esa pregunta sale gratis.
    if (result.userId && debeConsumirCupo(result.saveAction, result.isPremium === true)) {
      await incrementDailyCount(result.userId).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      answerId: result.answerId,
    })
  } catch (error) {
    console.error('❌ [API/v2/official-exams/answer] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/v2/official-exams/answer', _POST)
