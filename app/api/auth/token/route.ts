// app/api/auth/token/route.ts — Entrega el access token RS256 al browser (Fase B).
//
// Lee la sesión Auth.js (cookie, verificada server-side) y ACUÑA un JWT RS256
// corto (~1h) con `sub = user_profiles.id`. El adapter cliente (authjsAdapter,
// Fase B2) lo pide y lo pone como `Authorization: Bearer` para /api/v2/* y
// api.vence.es. DORMIDO: nadie lo llama hasta el flip.
//
// SEGURIDAD: el `sub` sale de la SESIÓN (fijado en el callback jwt por lookup de
// email), NUNCA del input del cliente. Sin sesión → 401. Emisor sin configurar
// (claves ausentes) → 503 (no revienta).

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/authjs'
import { mintAccessToken } from '@/lib/auth/mintAccessToken'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function _GET(): Promise<NextResponse> {
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id
  const email = session?.user?.email ?? null

  if (!session || !userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const minted = await mintAccessToken({ sub: userId, email })
  if (!minted) {
    // Emisor dormido (claves no configuradas) → no romper, señalar indisponible.
    return NextResponse.json({ error: 'issuer_not_configured' }, { status: 503 })
  }

  return NextResponse.json(
    { accessToken: minted.token, expiresAt: minted.expiresAt },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export const GET = withErrorLogging('/api/auth/token', _GET)
