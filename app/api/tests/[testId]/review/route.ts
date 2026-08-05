// app/api/tests/[testId]/review/route.ts
// API para obtener datos de un test completado para revisión

import { NextRequest, NextResponse } from 'next/server'
import { getTestReview } from '@/lib/api/test-review/queries'
import { safeParseTestReviewRequest } from '@/lib/api/test-review/schemas'
import { requireUsuarioPropio } from '@/lib/api/shared/auth'

import { withErrorLogging } from '@/lib/api/withErrorLogging'

const ENDPOINT = '/api/tests/[testId]/review'

// El repaso es de quien hizo el test. Hasta T-482 esta ruta no autenticaba: con el UUID
// —que va en la URL del navegador (`/revisar/<testId>`), o sea en historiales, capturas y
// enlaces compartidos— se leían los enunciados, LAS RESPUESTAS de esa persona, sus aciertos
// y sus tiempos. No es «compartir el resultado»: eso sería un token de compartición
// explícito, no la ausencia de guarda.
async function _GET(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const { testId } = await params

    const identidad = await requireUsuarioPropio(request, ENDPOINT)
    if (!identidad.ok) return identidad.response

    // Validar con Zod
    const validation = safeParseTestReviewRequest({ testId, requesterId: identidad.userId })
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'testId inválido', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Obtener datos con Drizzle
    const result = await getTestReview(validation.data)

    if (!result.success) {
      const status =
        result.errorCode === 'not_found' ? 404
        : result.errorCode === 'not_owner' ? 403
        : result.errorCode === 'internal' ? 500
        : 400
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

export const GET = withErrorLogging('/api/tests/[testId]/review', _GET)
