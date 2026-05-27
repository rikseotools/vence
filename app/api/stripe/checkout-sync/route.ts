// app/api/stripe/checkout-sync/route.ts
//
// Endpoint POST que sincroniza el estado premium del user inmediatamente
// tras Stripe Checkout. Llamado por /premium/success en success_url, ANTES
// de mostrar UI premium al usuario, para que NO dependa del webhook para
// la activación inicial.
//
// Patrón: defense in depth con el webhook (que sigue activo, idempotente
// via onConflict='user_id' en user_subscriptions).
//
// Documentado en docs/roadmap/agnosticismo-supabase.md y manual original
// en docs/runbooks/observability.md.

import { NextResponse, type NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import {
  safeParseSyncCheckoutRequest,
  syncCheckoutSession,
} from '@/lib/api/checkout-sync'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
export const maxDuration = 15 // hay 1 retrieve a Stripe + 2 ops BD

async function _POST(request: NextRequest) {
  // ─── Auth ─── El user debe estar logueado para poder activar su propia
  // suscripción. Sin esto, cualquiera podría llamar al endpoint con un
  // session_id válido y... bueno, ya validamos customer_id match dentro.
  // Pero requireAuth añade defensa en profundidad y limita el blast radius.
  const auth = await verifyAuth(request, '/api/stripe/checkout-sync')
  if (!auth.success) {
    return NextResponse.json(
      { success: false, error: auth.reason ?? 'unauthorized' },
      { status: auth.status ?? 401 },
    )
  }

  // ─── Validar body ───
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Body JSON inválido' },
      { status: 400 },
    )
  }

  const parsed = safeParseSyncCheckoutRequest(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Datos de entrada inválidos',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    )
  }

  // ─── Ejecutar sync ───
  const result = await syncCheckoutSession(auth.userId, parsed.data)

  // Si es error de negocio (tipado), mapear código HTTP apropiado.
  if (!result.success && 'code' in result) {
    const statusByCode: Record<string, number> = {
      session_not_found: 404,
      session_expired: 410,
      unauthorized: 403,
      no_subscription: 400,
      stripe_error: 502,
      db_error: 500,
    }
    return NextResponse.json(result, { status: statusByCode[result.code] ?? 500 })
  }

  return NextResponse.json(result)
}

export const POST = withErrorLogging('/api/stripe/checkout-sync', _POST)
