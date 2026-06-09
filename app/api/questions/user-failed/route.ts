// app/api/questions/user-failed/route.ts - API para obtener preguntas falladas del usuario
// Usa Drizzle ORM + Zod para validación tipada
import { NextResponse } from 'next/server'
import {
  getUserFailedQuestions,
  safeParseGetUserFailedQuestions,
} from '@/lib/api/user-failed-questions'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'
// ============================================
// POST /api/questions/user-failed
// Obtener preguntas que el usuario ha fallado
// ============================================
async function _POST(request: Request) {
  try {
    const body = await request.json()

    console.log('📥 [API/questions/user-failed] Request recibido:', {
      userId: body.userId?.substring(0, 8) + '...',
      topicNumber: body.topicNumber,
      selectedLaws: body.selectedLaws?.length || 0,
    })

    // Validar request con Zod
    const validation = safeParseGetUserFailedQuestions(body)
    if (!validation.success) {
      const issues = validation.error?.issues || []
      console.error('❌ Validación fallida:', issues)
      return NextResponse.json(
        {
          success: false,
          error: 'Parámetros inválidos',
          details: issues.map(e => ({
            path: e.path?.join('.') || '',
            message: e.message || 'Error desconocido',
          })),
        },
        { status: 400 }
      )
    }

    // Quick-fail 12s. Sin esto, la query 5-way JOIN sobre test_questions
    // para users heavy (61k+ filas) caía en statement_timeout=30s del DSN,
    // y la lambda esperaba hasta agotar maxDuration de Vercel.
    let result
    try {
      result = await withDbTimeout(
        () => getUserFailedQuestions(validation.data),
        12000,
      )
    } catch (err) {
      if (isDbTimeoutError(err)) {
        return NextResponse.json(
          { success: false, error: 'Servicio saturado momentáneamente. Reintenta en 5 minutos.', retryable: true },
          { status: 503, headers: { 'Retry-After': '60' } }
        )
      }
      throw err
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      totalQuestions: result.totalQuestions,
      totalFailures: result.totalFailures,
      totalRealFailures: result.totalRealFailures,
      totalBlankOnly: result.totalBlankOnly,
      questions: result.questions,
    })
  } catch (error) {
    console.error('❌ Error en API /questions/user-failed:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/questions/user-failed', _POST)
