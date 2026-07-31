// app/api/stripe/subscription/route.ts - Obtener datos de suscripción del usuario
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseGetSubscriptionRequest,
  safeParseCreatePortalSessionRequest,
  getSubscription,
  createPortalSession
} from '@/lib/api/subscription'

import { requireUsuarioPropio } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================
// GET: Obtener datos de suscripción
// ============================================

async function _GET(request: NextRequest) {
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

    // T-340 — con el `userId` en la query y sin token, esto devolvía los datos de
    // FACTURACIÓN de cualquiera (importe, plan, fechas, estado) a quien tuviera su UUID.
    // Es una lectura, así que la suplantación sí puede hacerla: es su razón de ser.
    const identidad = await requireUsuarioPropio(request, '/api/stripe/subscription', parseResult.data.userId, {
      // Lectura de lo suyo: seguir con el token no enseña nada ajeno.
      alDiscrepar: 'seguir-con-el-token',
    })
    if (!identidad.ok) return identidad.response

    // Obtener datos de suscripción — del usuario autenticado.
    const result = await getSubscription({ ...parseResult.data, userId: identidad.userId })

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

async function _POST(request: NextRequest) {
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

    // T-340 — el peor de los cuatro: esto devuelve un enlace al PORTAL de facturación de
    // Stripe (facturas, tarjeta, cancelar). Con el `userId` en el cuerpo y sin token, se
    // obtenía el portal de otra persona. La identidad sale del token y nada más.
    const identidad = await requireUsuarioPropio(request, '/api/stripe/subscription#portal', parseResult.data.userId, {
      // Abre SU portal de facturación (el del token). No cobra ni cambia estado.
      alDiscrepar: 'seguir-con-el-token',
    })
    if (!identidad.ok) return identidad.response

    // Crear sesión del portal — del usuario autenticado.
    const result = await createPortalSession({ ...parseResult.data, userId: identidad.userId })

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

export const GET = withErrorLogging('/api/stripe/subscription', _GET)
export const POST = withErrorLogging('/api/stripe/subscription', _POST)
