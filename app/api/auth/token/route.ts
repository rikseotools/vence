// app/api/auth/token/route.ts — Entrega el access token RS256 al browser (Fase B).
//
// Dos fuentes de identidad, en orden:
//   1. Sesión Auth.js (cookie, verificada server-side) — vía normal post-cutover.
//   2. BRIDGE del cutover: si aún NO hay sesión Auth.js pero el cliente manda un
//      Bearer Supabase HS256 válido, acuñamos el RS256 a partir de él. Así los
//      usuarios EXISTENTES no pierden el acceso al flipear (sin flood, sin re-login);
//      su sesión Auth.js se crea de forma natural al re-loguear. Resuelve el
//      session-gap SIN pelear con el localStorage del AuthProvider (server-side).
//
// SEGURIDAD: el `sub` sale SIEMPRE de una sesión/token verificado (nunca del input
// crudo). Sin identidad → 401. Emisor sin configurar → 503.
// Transitorio: la rama bridge es removible cuando ya no queden sesiones Supabase
// vivas (o al retirar la doble-aceptación HS256).

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/authjs'
import { mintAccessToken } from '@/lib/auth/mintAccessToken'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function _GET(request: NextRequest): Promise<NextResponse> {
  // 1. Sesión Auth.js.
  const session = await auth()
  let userId = (session?.user as { id?: string } | undefined)?.id
  let email = session?.user?.email ?? null

  // 2. Bridge del cutover: sin sesión Auth.js → aceptar Bearer Supabase HS256 válido.
  //    verifyAuth (mode=on) lo valida por la rama HS256 de la doble-aceptación.
  if (!userId) {
    const bridged = await verifyAuth(request, '/api/auth/token#bridge')
    if (bridged.success) {
      userId = bridged.userId
      email = bridged.email
    }
  }

  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const minted = await mintAccessToken({ sub: userId, email })
  if (!minted) {
    // Emisor dormido (claves no configuradas) → no romper, señalar indisponible.
    return NextResponse.json({ error: 'issuer_not_configured' }, { status: 503 })
  }

  return NextResponse.json(
    {
      accessToken: minted.token,
      expiresAt: minted.expiresAt,
      // Identidad, para que el cliente construya la sesión sin depender de la cookie
      // Auth.js (necesario en el bridge, donde aún no hay sesión Auth.js).
      user: { id: userId, email },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export const GET = withErrorLogging('/api/auth/token', _GET)
