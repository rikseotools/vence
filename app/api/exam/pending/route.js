// app/api/exam/pending/route.js - API para obtener exámenes pendientes
import { NextResponse } from 'next/server'
import { getPendingExams } from '@/lib/api/exam'
import { logValidationError, classifyError } from '@/lib/api/validation-error-log'

export const maxDuration = 30

export async function GET(request) {
  const startTime = Date.now()
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const testType = searchParams.get('testType')
    const limitParam = searchParams.get('limit')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId es requerido' },
        { status: 400 }
      )
    }

    // Validar UUID básico
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      return NextResponse.json(
        { success: false, error: 'userId inválido' },
        { status: 400 }
      )
    }

    // Validar testType si se proporciona
    if (testType && testType !== 'exam' && testType !== 'practice') {
      return NextResponse.json(
        { success: false, error: 'testType debe ser "exam" o "practice"' },
        { status: 400 }
      )
    }

    // Parsear limit
    const limit = limitParam ? parseInt(limitParam, 10) : 10
    if (isNaN(limit) || limit < 1 || limit > 50) {
      return NextResponse.json(
        { success: false, error: 'limit debe ser un número entre 1 y 50' },
        { status: 400 }
      )
    }

    // Obtener exámenes pendientes
    const result = await getPendingExams(userId, testType, limit)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Error obteniendo exámenes pendientes' },
        { status: 500 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error obteniendo exámenes pendientes:', error)
    logValidationError({
      endpoint: '/api/exam/pending',
      errorType: classifyError(error),
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      httpStatus: 500,
      durationMs: Date.now() - startTime,
      userAgent: request.headers.get('user-agent'),
    })
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
