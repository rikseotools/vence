// app/api/exam/progress/route.js - API para obtener progreso/reanudar examen
import { NextResponse } from 'next/server'
import {
  safeParseGetExamProgressRequest,
  getExamProgress,
  getTestOwnerId,
} from '@/lib/api/exam'
import { requireDuenoDelRecurso } from '@/lib/api/shared/auth'

import { withErrorLogging } from '@/lib/api/withErrorLogging'

const ENDPOINT = '/api/exam/progress'

// SIN esto la guarda de abajo NO PROTEGE — mismo gotcha que en
// app/api/tests/[testId]/review/route.ts.
export const dynamic = 'force-dynamic'

// [T-565]: mismo defecto que /api/exam/resume — la comprobación era opcional y su
// único llamante real (ExamLayout) nunca manda `userId`, así que nunca corría.
async function _GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const testId = searchParams.get('testId')

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

    const testOwnerId = await getTestOwnerId(testId)
    const identidad = await requireDuenoDelRecurso(request, ENDPOINT, testOwnerId)
    if (!identidad.ok) return identidad.response

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

export const GET = withErrorLogging('/api/exam/progress', _GET)
