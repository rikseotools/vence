// app/api/tests/[testId]/review/route.ts
// API para obtener datos de un test completado para revisión

import { NextRequest, NextResponse } from 'next/server'
import { getTestReview } from '@/lib/api/test-review/queries'
import { safeParseTestReviewRequest } from '@/lib/api/test-review/schemas'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const { testId } = await params

    // Validar con Zod
    const validation = safeParseTestReviewRequest({ testId })
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'testId inválido', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Obtener datos con Drizzle
    const result = await getTestReview(validation.data)

    if (!result.success) {
      const status = result.error === 'Test no encontrado' ? 404 : 400
      return NextResponse.json(
        { success: false, error: result.error },
        { status }
      )
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error en API review:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
