// app/api/answer/route.ts
// API para validar respuestas de forma segura
// La respuesta correcta SOLO se revela después de recibir la respuesta del usuario
import { NextRequest, NextResponse } from 'next/server'
import { safeParseAnswerRequest, validateAnswer } from '../../../lib/api/answers'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
// Dar margen al cold start de Vercel + conexión a Supabase
export const maxDuration = 30

async function _POST(request: NextRequest) {
  const startTime = Date.now()
  let body: Record<string, unknown> | undefined

  try {
    body = await request.json()

    // Validar request con Zod
    const validation = safeParseAnswerRequest(body)

    if (!validation.success) {
      console.error('❌ [API/answer] Validación fallida:', validation.error.flatten())
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
    const queryStart = Date.now()
    const result = await validateAnswer(validation.data)
    const queryMs = Date.now() - queryStart
    const totalMs = Date.now() - startTime

    // Logear si la query tarda más de 2s (para diagnóstico de timeouts)
    if (queryMs > 2000) {
      console.warn(`⚠️ [API/answer] Query lenta: ${queryMs}ms (total: ${totalMs}ms) questionId=${validation.data.questionId}`)
    }

    if (!result.success) {
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
    const totalMs = Date.now() - startTime
    console.error(`❌ [API/answer] Error tras ${totalMs}ms:`, error)
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
async function _GET() {
  return NextResponse.json(
    { error: 'Método no permitido. Usa POST.' },
    { status: 405 }
  )
}

export const POST = withErrorLogging('/api/answer', _POST)
export const GET = withErrorLogging('/api/answer', _GET)
