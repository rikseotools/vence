// app/api/exam/progress/route.js - API para obtener progreso/reanudar examen
import { NextResponse } from 'next/server'
import {
  safeParseGetExamProgressRequest,
  getExamProgress,
  verifyTestOwnership
} from '@/lib/api/exam'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const testId = searchParams.get('testId')
    const userId = searchParams.get('userId')

    if (!testId) {
      return NextResponse.json(
        { success: false, error: 'testId es requerido' },
        { status: 400 }
      )
    }

    // Validar formato del testId
    const parseResult = safeParseGetExamProgressRequest({ testId })

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID de test inválido',
          details: parseResult.error.issues
        },
        { status: 400 }
      )
    }

    // Si se proporciona userId, verificar propiedad del test
    if (userId) {
      const isOwner = await verifyTestOwnership(testId, userId)
      if (!isOwner) {
        return NextResponse.json(
          { success: false, error: 'No tienes acceso a este test' },
          { status: 403 }
        )
      }
    }

    // Obtener progreso del examen
    const result = await getExamProgress(testId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Error obteniendo progreso' },
        { status: result.error === 'Test no encontrado' ? 404 : 500 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en API /exam/progress:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
