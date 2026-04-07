// app/api/stripe/reactivate/route.ts - Reactivar suscripción cancelada
import { NextRequest, NextResponse } from 'next/server'
import { safeParseReactivateSubscriptionRequest, reactivateSubscription } from '@/lib/api/subscription'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'

async function _POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parseResult = safeParseReactivateSubscriptionRequest(body)
    if (!parseResult.success) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const result = await reactivateSubscription(parseResult.data)

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
