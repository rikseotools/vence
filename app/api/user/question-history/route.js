// app/api/user/question-history/route.js
// API para obtener historial de preguntas del usuario (optimizado con Drizzle)
import { NextResponse } from 'next/server'
import {
  getQuestionHistory,
  getRecentQuestions,
  getUserAnalytics,
  safeParseGetQuestionHistory,
  safeParseGetRecentQuestions,
  safeParseGetUserAnalytics
} from '@/lib/api/questions'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'history'
    const userId = searchParams.get('userId')

    // Validar userId requerido
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId es requerido' },
        { status: 400 }
      )
    }

    switch (action) {
      // Obtener historial completo de preguntas respondidas
      case 'history': {
        const onlyActive = searchParams.get('onlyActive') !== 'false'

        // Validar con Zod
        const parsed = safeParseGetQuestionHistory({
          userId,
          onlyActiveQuestions: onlyActive
        })

        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: parsed.error.errors[0]?.message || 'Datos inválidos' },
            { status: 400 }
          )
        }

        const result = await getQuestionHistory(parsed.data)

        if (!result.success) {
          return NextResponse.json(result, { status: 500 })
        }

        return NextResponse.json(result)
      }

      // Obtener preguntas respondidas recientemente (para exclusión)
      case 'recent': {
        const days = parseInt(searchParams.get('days') || '7', 10)

        // Validar con Zod
        const parsed = safeParseGetRecentQuestions({ userId, days })

        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: parsed.error.errors[0]?.message || 'Datos inválidos' },
            { status: 400 }
          )
        }

        const result = await getRecentQuestions(parsed.data)

        if (!result.success) {
          return NextResponse.json(result, { status: 500 })
        }

        return NextResponse.json(result)
      }

      // Obtener respuestas para analytics (motivationalAnalyzer)
      case 'analytics': {
        const days = parseInt(searchParams.get('days') || '14', 10)

        // Validar con Zod
        const parsed = safeParseGetUserAnalytics({ userId, days })

        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: parsed.error.errors[0]?.message || 'Datos inválidos' },
            { status: 400 }
          )
        }

        const result = await getUserAnalytics(parsed.data)

        if (!result.success) {
          return NextResponse.json(result, { status: 500 })
        }

        return NextResponse.json(result)
      }

      default:
        return NextResponse.json(
          { success: false, error: `Acción desconocida: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('❌ Error en /api/user/question-history:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
