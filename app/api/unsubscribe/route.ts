// app/api/unsubscribe/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { processUnsubscribeByToken } from '@/lib/emails/emailService.server'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      token,
      unsubscribeAll = false,
      specificTypes = null,
      categories = null,
      // T-369: la baja masiva solo se lleva las respuestas a lo que el usuario nos
      // escribe si lo marca. Ausente = false = NO se las lleva (el cliente viejo,
      // o cualquier caller que no lo mande, cae en el lado que no hace daño).
      includeSoporte = false,
    } = body as {
      token?: string
      unsubscribeAll?: boolean
      specificTypes?: string[] | null
      categories?: string[] | null
      includeSoporte?: boolean
    }

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Token requerido'
      }, { status: 400 })
    }

    const result = await processUnsubscribeByToken(
      token,
      specificTypes,
      unsubscribeAll,
      categories,
      includeSoporte === true
    )

    if (!result.success) {
      // db_error / internal_error → 500 para que withErrorLogging los marque como critical
      // invalid_token → 400 (error de cliente esperado)
      const status = result.errorCode === 'db_error' || result.errorCode === 'internal_error' ? 500 : 400
      return NextResponse.json(result, { status })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/unsubscribe] Unhandled exception:', error)
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      errorCode: 'internal_error',
    }, { status: 500 })
  }
}

export const POST = withErrorLogging('/api/unsubscribe', _POST)
