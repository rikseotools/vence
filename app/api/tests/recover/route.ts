// app/api/tests/recover/route.ts
// API para recuperar tests guardados en localStorage antes del registro
// Usa Zod para validación + Drizzle para queries
import { NextRequest, NextResponse } from 'next/server'
import { safeParseRecoverTest, recoverTest } from '../../../../lib/api/tests'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('🎯 [API] /tests/recover - Body recibido:', {
      hasUserId: !!body.userId,
      hasPendingTest: !!body.pendingTest,
      answeredCount: body.pendingTest?.answeredQuestions?.length,
    })

    // Validar con Zod
    const validation = safeParseRecoverTest(body)

    if (!validation.success) {
      console.error('❌ [API] Validación fallida:', validation.error.flatten())
      return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          details: validation.error.flatten(),
        },
        { status: 400 }
      )
    }

    // Ejecutar query tipada
    const result = await recoverTest(validation.data)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ Error en /api/tests/recover:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/tests/recover', _POST)
