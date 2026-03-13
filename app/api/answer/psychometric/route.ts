// app/api/answer/psychometric/route.ts
// API unificada: validar respuesta + guardar + actualizar sesión
// Todo en una sola llamada para máxima fiabilidad en conexiones inestables (4G)

import { NextRequest, NextResponse } from 'next/server'

// Dar margen al cold start de Vercel + conexión a Supabase
export const maxDuration = 30

import {
  psychometricAnswerRequestSchema,
  validateAndSavePsychometricAnswer,
} from '@/lib/api/psychometric-answer'
import { logValidationError, classifyError } from '@/lib/api/validation-error-log'

// ============================================
// ENDPOINT POST
// ============================================

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let body: Record<string, unknown> | undefined

  try {
    body = await request.json()

    // Validar request con Zod
    const validation = psychometricAnswerRequestSchema.safeParse(body)

    if (!validation.success) {
      console.error('❌ [API/psychometric-answer] Validación fallida:', validation.error.flatten())
      logValidationError({
        endpoint: '/api/answer/psychometric',
        errorType: 'validation',
        errorMessage: JSON.stringify(validation.error.flatten()),
        questionId: (body as any)?.questionId,
        requestBody: body,
        httpStatus: 400,
        durationMs: Date.now() - startTime,
        userAgent: request.headers.get('user-agent'),
      })
      return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          details: validation.error.flatten(),
        },
        { status: 400 }
      )
    }

    // Validar + guardar (todo en una operación)
    const result = await validateAndSavePsychometricAnswer(validation.data)

    if (!result.success) {
      logValidationError({
        endpoint: '/api/answer/psychometric',
        errorType: 'not_found',
        errorMessage: `Pregunta psicotécnica no encontrada: ${validation.data.questionId}`,
        questionId: validation.data.questionId,
        requestBody: body,
        httpStatus: 404,
        durationMs: Date.now() - startTime,
        userAgent: request.headers.get('user-agent'),
      })
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          isCorrect: false,
          correctAnswer: 0,
        },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/psychometric-answer] Error:', error)
    logValidationError({
      endpoint: '/api/answer/psychometric',
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
        error: 'Error interno del servidor',
        isCorrect: false,
        correctAnswer: 0,
      },
      { status: 500 }
    )
  }
}

// Bloquear GET para evitar exposición accidental
export async function GET() {
  return NextResponse.json(
    { error: 'Método no permitido. Usa POST.' },
    { status: 405 }
  )
}
