// app/.well-known/jwks.json/route.ts
// JWKS público (Fase B — auth agnóstico). Sirve la(s) clave(s) PÚBLICA(s) RSA con
// su `kid` para que cualquier verificador (backend NestJS, terceros) valide los
// access tokens RS256 sin compartir secretos.
//
// DORMIDO por defecto: si `AUTH_JWT_PUBLIC_KEY`/`AUTH_JWT_KID` no están puestas,
// devuelve `{ keys: [] }` (200) → no rompe nada y no revela estado interno.
//
// La construcción del JWKS vive en `buildJwks()` (helper puro, testeado sin
// next/server); aquí solo se envuelve en la respuesta HTTP + cache.

import { NextResponse } from 'next/server'
import { buildJwks } from '@/lib/api/auth/rs256'

// Debe correr en el runtime Node (jose + material de clave), no en edge.
export const runtime = 'nodejs'
// Nunca cachear en build: depende de env de runtime.
export const dynamic = 'force-dynamic'

export async function GET() {
  const jwks = await buildJwks()

  const cacheControl =
    jwks.keys.length > 0
      ? 'public, max-age=3600, stale-while-revalidate=86400'
      : 'public, max-age=60' // dormido: no cachear largo por si se activa

  return NextResponse.json(jwks, { headers: { 'Cache-Control': cacheControl } })
}
