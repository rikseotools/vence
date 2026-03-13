// app/api/answer/route.ts
// API para validar respuestas de forma segura
// La respuesta correcta SOLO se revela después de recibir la respuesta del usuario
import { NextRequest, NextResponse } from 'next/server'
import { safeParseAnswerRequest, validateAnswer } from '../../../lib/api/answers'
import { logValidationError, classifyError } from '@/lib/api/validation-error-log'

// Dar margen al cold start de Vercel + conexión a Supabase
export const maxDuration = 30

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let body: Record<string, unknown> | undefined

  try {
    body = await request.json()

    // Validar request con Zod
    const validation = safeParseAnswerRequest(body)

    if (!validation.success) {
      console.error('❌ [API/answer] Validación fallida:', validation.error.flatten())
      logValidationError({
        endpoint: '/api/answer',
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
          details: validation.error.flatten()
        },
        { status: 400 }
      )
    }

    // Validar respuesta con Drizzle
    const result = await validateAnswer(validation.data)

    if (!result.success) {
      logValidationError({
        endpoint: '/api/answer',
        errorType: 'not_found',
        errorMessage: `Pregunta no encontrada: ${validation.data.questionId}`,
        questionId: validation.data.questionId,
        requestBody: body,
        httpStatus: 404,
        durationMs: Date.now() - startTime,
        userAgent: request.headers.get('user-agent'),
      })
      return NextResponse.json(
        {
          success: false,
          error: 'Pregunta no encontrada',
          isCorrect: false,
          correctAnswer: 0
        },
        { status: 404 }
      )
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/answer] Error:', error)
    logValidationError({
      endpoint: '/api/answer',
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
        correctAnswer: 0
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
