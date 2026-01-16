// app/api/stripe/cancel/route.ts - Cancelar suscripción y guardar feedback
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseCancelSubscriptionRequest,
  cancelSubscription
} from '@/lib/api/subscription'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================
// POST: Cancelar suscripción
// ============================================

export async function POST(request: NextRequest) {
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

    // Cancelar suscripción
    const result = await cancelSubscription(parseResult.data)

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
