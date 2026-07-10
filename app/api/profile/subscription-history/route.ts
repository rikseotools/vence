// app/api/profile/subscription-history/route.ts
// Historial (hitos) de la suscripción del usuario para /perfil. SOLO LECTURA.
//
// SEGURIDAD: la identidad se deriva SIEMPRE del token (getAuthenticatedUser), NUNCA de un
// `?userId=` del cliente → sin IDOR (a diferencia del viejo /api/stripe/subscription?userId=).
// Cada usuario solo puede ver SU propio historial.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getSubscriptionHistory } from '@/lib/api/subscription/history'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function _GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response
  const history = await getSubscriptionHistory(auth.user.id)
  return NextResponse.json(history)
}

export const GET = withErrorLogging('/api/profile/subscription-history', _GET)
export { _GET }
