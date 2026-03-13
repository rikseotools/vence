// app/api/exam/answer/route.ts - API para guardar respuestas individuales de examen
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseSaveAnswerRequest,
  saveAnswer,
  verifyTestOwnership
} from '@/lib/api/exam'
import { logValidationError, classifyError } from '@/lib/api/validation-error-log'

// Evitar 504 de Vercel (default 300s): fail fast
export const maxDuration = 30

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let body: Record<string, unknown> | undefined

  try {
    body = await request.json()

    // Validar request con Zod
    const parseResult = safeParseSaveAnswerRequest(body)

    if (!parseResult.success) {
      console.error('❌ [API/exam/answer] Validation error:', parseResult.error.issues)
      logValidationError({
        endpoint: '/api/exam/answer',
        errorType: 'validation',
        errorMessage: JSON.stringify(parseResult.error.issues),
        requestBody: body,
        httpStatus: 400,
        durationMs: Date.now() - startTime,
        userAgent: request.headers.get('user-agent'),
      })
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

    // Si se proporciona userId, verificar propiedad del test
    if (body?.userId) {
      const isOwner = await verifyTestOwnership(data.testId, body.userId as string)
      if (!isOwner) {
        return NextResponse.json(
          { success: false, error: 'No tienes acceso a este test' },
          { status: 403 }
        )
      }
    }

    // Guardar la respuesta (usa UPSERT internamente)
    const result = await saveAnswer(data)

    if (!result.success) {
      console.error('❌ [API/exam/answer] Save failed:', result.error)
      logValidationError({
        endpoint: '/api/exam/answer',
        errorType: 'unknown',
        errorMessage: `Save failed: ${result.error}`,
        questionId: (body as any)?.questionId,
        requestBody: body,
        httpStatus: 500,
        durationMs: Date.now() - startTime,
        userAgent: request.headers.get('user-agent'),
      })
      return NextResponse.json(
        { success: false, error: result.error || 'Error guardando respuesta' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      answerId: result.answerId,
      isCorrect: result.isCorrect,
    })
  } catch (error) {
    console.error('❌ [API/exam/answer] Error:', error)
    logValidationError({
      endpoint: '/api/exam/answer',
      errorType: classifyError(error),
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      questionId: (body as any)?.questionId,
      requestBody: body,
      httpStatus: 500,
      durationMs: Date.now() - startTime,
      userAgent: request.headers.get('user-agent'),
    })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}
