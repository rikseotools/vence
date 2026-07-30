// app/api/stripe/cancel/route.ts - Cancelar suscripción y guardar feedback
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseCancelSubscriptionRequest,
  cancelSubscription
} from '@/lib/api/subscription'

import { requireUsuarioPropio } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================
// POST: Cancelar suscripción
// ============================================

async function _POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar request con Zod
    const parseResult = safeParseCancelSubscriptionRequest(body)
    if (!parseResult.success) {
      console.warn('⚠️ [API/cancel] Validación fallida:', parseResult.error.issues)

      // Mensajes de error más específicos
      const errors = parseResult.error.issues
      if (errors.some(e => e.path.includes('userId'))) {
        return NextResponse.json({ error: 'User ID required' }, { status: 400 })
      }
      if (errors.some(e => e.path.includes('reason'))) {
        return NextResponse.json({ error: 'Cancellation reason required' }, { status: 400 })
      }

      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }

    // T-340 — la identidad sale del TOKEN, nunca del cuerpo. Antes bastaba con mandar el
    // UUID de otra persona para cancelarle la suscripción; y, al no pasar por `verifyAuth`,
    // el candado de solo lectura de la suplantación tampoco cubría este camino.
    const identidad = await requireUsuarioPropio(request, '/api/stripe/cancel', parseResult.data.userId)
    if (!identidad.ok) return identidad.response

    // Cancelar suscripción — con el userId autenticado, no con el que llegó en el cuerpo.
    const result = await cancelSubscription({ ...parseResult.data, userId: identidad.userId })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/cancel] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}

// ============================================
// OPTIONS: CORS preflight
// ============================================

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}

export const POST = withErrorLogging('/api/stripe/cancel', _POST)
