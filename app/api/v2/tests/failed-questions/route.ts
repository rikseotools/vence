// app/api/v2/tests/failed-questions/route.ts
// API v2 para test de repaso de fallos - Usa Drizzle + Zod
import { NextRequest, NextResponse } from 'next/server'
import {
  getFailedQuestionsForUser,
  safeParseCreateFailedQuestionsTest,
  type CreateFailedQuestionsTestRequest,
} from '@/lib/api/tests'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

async function _POST(request: NextRequest) {
  console.log('🎯 [API/v2/failed-questions] Request received')

  try {
    // Auth (wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuth(request, '/api/v2/tests/failed-questions')
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: auth.reason === 'no_bearer_token' ? 'No autorizado' : 'Token inválido' },
        { status: 401 }
      )
    }
    const user = { id: auth.userId, email: auth.email }

    console.log('🎯 [API/v2/failed-questions] User authenticated:', user.id)

    // Parsear y validar body con Zod
    const body = await request.json()
    const parseResult = safeParseCreateFailedQuestionsTest({
      ...body,
      userId: user.id,
    })

    if (!parseResult.success) {
      console.log('🎯 [API/v2/failed-questions] Validation error:', parseResult.error.errors)
      return NextResponse.json({
        success: false,
        error: 'Datos inválidos',
        details: parseResult.error.errors,
      }, { status: 400 })
    }

    const params: CreateFailedQuestionsTestRequest = parseResult.data
    console.log('🎯 [API/v2/failed-questions] Validated params:', {
      numQuestions: params.numQuestions,
      orderBy: params.orderBy,
      fromDate: params.fromDate,
      days: params.days,
    })

    // Ejecutar query con Drizzle
    const result = await getFailedQuestionsForUser(params)

    if (!result.success) {
      return NextResponse.json(result, { status: result.error ? 500 : 200 })
    }

    console.log('🎯 [API/v2/failed-questions] Returning', result.questionCount, 'questions')

    return NextResponse.json({
      success: true,
      questions: result.questions,
      questionCount: result.questionCount,
      message: result.message,
      testType: 'failed_questions',
    })

  } catch (error) {
    console.error('❌ [API/v2/failed-questions] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/v2/tests/failed-questions', _POST)
