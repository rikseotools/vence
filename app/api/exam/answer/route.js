// app/api/exam/answer/route.js - API para guardar respuestas individuales de examen
import { NextResponse } from 'next/server'
import {
  safeParseSaveAnswerRequest,
  saveAnswer,
  verifyTestOwnership
} from '@/lib/api/exam'

export async function POST(request) {
  try {
    const body = await request.json()

    // Validar request con Zod
    const parseResult = safeParseSaveAnswerRequest(body)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos de respuesta inválidos',
          details: parseResult.error.issues
        },
        { status: 400 }
      )
    }

    const data = parseResult.data

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

    // Guardar la respuesta
    const result = await saveAnswer(data)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Error guardando respuesta' },
        { status: 500 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en API /exam/answer:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
