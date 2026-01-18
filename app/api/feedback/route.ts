// app/api/feedback/route.ts - API tipada para feedback con Drizzle + Zod
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseCreateFeedbackRequest,
  createFeedback,
  createFeedbackConversation,
  type CreateFeedbackResponse
} from '@/lib/api/feedback'

export async function POST(request: NextRequest): Promise<NextResponse<CreateFeedbackResponse>> {
  try {
    const body = await request.json()

    // Validar request con Zod
    const validation = safeParseCreateFeedbackRequest(body)

    if (!validation.success) {
      console.error('❌ [API/Feedback] Validación fallida:', validation.error.flatten())
      return NextResponse.json(
        {
          success: false,
          error: `Datos inválidos: ${validation.error.errors.map(e => e.message).join(', ')}`
        },
        { status: 400 }
      )
    }

    const data = validation.data

    console.log('📝 [API/Feedback] Creando feedback...', {
      type: data.type,
      userId: data.userId,
      questionId: data.questionId
    })

    // Crear feedback con Drizzle
    const result = await createFeedback(data)

    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error || 'Error creando feedback' },
        { status: 500 }
      )
    }

    // Crear conversación automáticamente
    const conversationResult = await createFeedbackConversation(
      result.data.id,
      data.userId || null
    )

    if (!conversationResult.success) {
      console.error('⚠️ [API/Feedback] Error creando conversación:', conversationResult.error)
      // No fallamos el feedback por esto
    }

    console.log('✅ [API/Feedback] Feedback creado:', result.data.id)

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/Feedback] Error inesperado:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}

// Bloquear GET
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Método no permitido. Usa POST.' },
    { status: 405 }
  )
}
