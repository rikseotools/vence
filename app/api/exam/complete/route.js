// app/api/exam/complete/route.js - API para completar/finalizar examen
import { NextResponse } from 'next/server'
import {
  validateCompleteExamRequest,
  completeExam,
  verifyTestOwnership
} from '@/lib/api/exam'

export async function POST(request) {
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

    // Si se proporciona userId, verificar propiedad del test
    if (body.userId) {
      const isOwner = await verifyTestOwnership(data.testId, body.userId)
      if (!isOwner) {
        return NextResponse.json(
          { success: false, error: 'No tienes acceso a este test' },
          { status: 403 }
        )
      }
    }

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
