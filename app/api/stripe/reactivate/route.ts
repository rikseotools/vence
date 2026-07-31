// app/api/stripe/reactivate/route.ts - Reactivar suscripción cancelada
//
// T-340: la identidad sale del TOKEN, nunca del cuerpo. Hasta el 30/07/2026 este endpoint
// reactivaba la suscripción de quienquiera que fuese el `userId` del body, sin comprobar
// nada — o sea, se le podía volver a activar el cobro a otra persona con solo su UUID.
import { NextRequest, NextResponse } from 'next/server'
import { reactivateSubscription } from '@/lib/api/subscription'
import { requireUsuarioPropio } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'

async function _POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))

    const identidad = await requireUsuarioPropio(request, '/api/stripe/reactivate', body?.userId, {
      // Vuelve a poner un COBRO. Equivocarse de cuenta aquí es cobrarle a quien no tocaba.
      alDiscrepar: 'cortar',
    })
    if (!identidad.ok) return identidad.response

    const result = await reactivateSubscription({ userId: identidad.userId })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/reactivate] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/stripe/reactivate', _POST)
