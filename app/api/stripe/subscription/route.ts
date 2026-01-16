// app/api/stripe/subscription/route.ts - Obtener datos de suscripción del usuario
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseGetSubscriptionRequest,
  safeParseCreatePortalSessionRequest,
  getSubscription,
  createPortalSession
} from '@/lib/api/subscription'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================
// GET: Obtener datos de suscripción
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // Validar request con Zod
    const parseResult = safeParseGetSubscriptionRequest({ userId })
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      )
    }

    // Obtener datos de suscripción
    const result = await getSubscription(parseResult.data)

    if (result.error && !result.hasSubscription) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/subscription] Error GET:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}

// ============================================
// POST: Crear portal de gestión de Stripe
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar request con Zod
    const parseResult = safeParseCreatePortalSessionRequest(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      )
    }

    // Crear sesión del portal
    const result = await createPortalSession(parseResult.data)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/subscription] Error POST:', error)
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
