// app/api/questions/user-failed/route.ts - API para obtener preguntas falladas del usuario
// Usa Drizzle ORM + Zod para validación tipada
import { NextResponse } from 'next/server'
import {
  getUserFailedQuestions,
  safeParseGetUserFailedQuestions,
} from '@/lib/api/user-failed-questions'

// ============================================
// POST /api/questions/user-failed
// Obtener preguntas que el usuario ha fallado
// ============================================
export async function POST(request: Request) {
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

    // Obtener preguntas falladas via Drizzle
    const result = await getUserFailedQuestions(validation.data)

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
