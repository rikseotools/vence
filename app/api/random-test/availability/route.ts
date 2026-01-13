// app/api/random-test/availability/route.ts - API para verificar disponibilidad de preguntas
import { NextRequest, NextResponse } from 'next/server'
import { checkQuestionAvailability } from '@/lib/api/random-test/queries'
import {
  safeParseCheckAvailability,
  type AvailabilityResponse,
} from '@/lib/api/random-test/schemas'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<NextResponse<AvailabilityResponse>> {
  try {
    const body = await request.json()

    // Validar request con Zod
    const parseResult = safeParseCheckAvailability(body)
    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        availableQuestions: 0,
        error: parseResult.error.issues.map(e => e.message).join(', '),
      }, { status: 400 })
    }

    // Obtener disponibilidad
    const availability = await checkQuestionAvailability(parseResult.data)

    return NextResponse.json({
      success: true,
      availableQuestions: availability.total,
      byTheme: availability.byTheme,
    })
  } catch (error) {
    console.error('❌ [API/random-test/availability] Error:', error)
    return NextResponse.json({
      success: false,
      availableQuestions: 0,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    }, { status: 500 })
  }
}
