// app/api/tests/recover/route.ts
// API para recuperar tests guardados en localStorage antes del registro
// Usa Zod para validación + Drizzle para queries
import { NextRequest, NextResponse } from 'next/server'
import { safeParseRecoverTest, recoverTest } from '../../../../lib/api/tests'
import { requireUsuarioPropio } from '@/lib/api/shared/auth'

import { withErrorLogging } from '@/lib/api/withErrorLogging'

const ENDPOINT = '/api/tests/recover'

// Hasta T-482 esta ruta ESCRIBÍA con el `userId` del CUERPO y sin token: se le podía crear a
// cualquiera un test con sus respuestas y tocarle el `user_profiles`. Contamina el historial
// y las estadísticas de un tercero, y es munición para el antifraude (aciertos que esa
// persona no hizo).
//
// Política ante discrepancia: `seguir-con-el-token`. El criterio de la casa es el DAÑO de
// equivocarse de cuenta, y aquí el peor caso es que el test recuperado aterrice en la cuenta
// de quien está autenticado — o sea, la suya. Cortar sí tendría coste: el `userId` sale del
// `AuthContext` del navegador, que es exactamente lo que se queda desincronizado en los
// usuarios de [T-434], y a esos les perderíamos el test que acaban de hacer.
async function _POST(request: NextRequest) {
  try {
    const body = await request.json()

    const identidad = await requireUsuarioPropio(request, ENDPOINT, body?.userId, {
      alDiscrepar: 'seguir-con-el-token',
    })
    if (!identidad.ok) return identidad.response

    console.log('🎯 [API] /tests/recover - Body recibido:', {
      hasUserId: !!body.userId,
      hasPendingTest: !!body.pendingTest,
      answeredCount: body.pendingTest?.answeredQuestions?.length,
    })

    // Validar con Zod. El `userId` se SUSTITUYE por el del token antes de validar, así que
    // `recoverTest` no puede recibir otro aunque alguien lo mande en el cuerpo: la identidad
    // deja de ser un dato de entrada.
    const validation = safeParseRecoverTest({ ...body, userId: identidad.userId })

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
