// app/api/tests/[testId]/review/route.ts
// API para obtener datos de un test completado para revisión

import { NextRequest, NextResponse } from 'next/server'
import { getTestReview } from '@/lib/api/test-review/queries'
import { safeParseTestReviewRequest } from '@/lib/api/test-review/schemas'
import { requireUsuarioPropio } from '@/lib/api/shared/auth'

import { withErrorLogging } from '@/lib/api/withErrorLogging'

const ENDPOINT = '/api/tests/[testId]/review'

// SIN esto la guarda de abajo NO PROTEGE, y se ve en producción: medido el 05/08 con el arreglo
// ya desplegado, un GET a la URL pelada devolvía **200 con el examen entero** mientras la MISMA
// URL con un parámetro cualquiera devolvía 401. No era CloudFront (`x-cache: Miss`, contestaba el
// origen): era Next sirviendo la ruta desde su propia caché, porque un handler GET sin declarar
// nada es candidato a cachearse y entonces la petición nunca llega al código que autentica.
// Su gemelo `/api/psychometric/review` sí lo declaraba, y por eso ese SÍ dio 401 en la misma
// prueba — la diferencia entre los dos fue lo que lo delató.
// Regla general: una ruta que autentica TIENE que ser dinámica; si se puede cachear, el guard es
// decorativo. En este repo lo declaran 96 rutas.
export const dynamic = 'force-dynamic'

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
