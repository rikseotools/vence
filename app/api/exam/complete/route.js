// app/api/exam/complete/route.js - API para completar/finalizar examen
import { NextResponse } from 'next/server'
import {
  validateCompleteExamRequest,
  completeExam,
  getTestOwnerId,
} from '@/lib/api/exam'
import { requireDuenoDelRecurso } from '@/lib/api/shared/auth'

import { withErrorLogging } from '@/lib/api/withErrorLogging'

const ENDPOINT = '/api/exam/complete'

// [T-565]: la comprobación era opcional y comparaba contra el `userId` del BODY (lo
// pone el cliente) — con solo el testId (y opcionalmente el propio id de la víctima,
// que no es secreto) cualquiera podía finalizar el examen de otra persona.
async function _POST(request) {
  try {
    const body = await request.json()

    // Validar request con Zod
    let data
    try {
      data = validateCompleteExamRequest(body)
    } catch (validationError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos de completado inválidos',
          details: validationError.issues || validationError.message
        },
        { status: 400 }
      )
    }

    const testOwnerId = await getTestOwnerId(data.testId)
    const identidad = await requireDuenoDelRecurso(request, ENDPOINT, testOwnerId)
    if (!identidad.ok) return identidad.response

    // Completar el examen
    const result = await completeExam(data.testId, data.force)

    if (!result.success) {
      // Si faltan preguntas, devolver código 400 con detalles
      if (result.unanswered && result.unanswered > 0) {
        return NextResponse.json(result, { status: 400 })
      }
      return NextResponse.json(
        { success: false, error: result.error || 'Error completando examen' },
        { status: result.error === 'Test no encontrado' ? 404 : 500 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en API /exam/complete:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/exam/complete', _POST)
