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
import { emitFireAndForget } from '@/lib/observability/emit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function _GET(request: NextRequest): Promise<NextResponse> {
  // 1. Sesión Auth.js.
  const session = await auth()
  let userId = (session?.user as { id?: string } | undefined)?.id
  let email = session?.user?.email ?? null
  // Instrumentación de DRENAJE (Fase B soak): por qué vía se acuña el token.
  // 'authjs_session' = usuario ya migrado (cookie Auth.js). 'bridge' = aún depende
  // de su sesión Supabase legacy. Cuando 'bridge' → ~0, retirar la doble-aceptación
  // HS256 + el bridge (paso 5 de B4, punto de no retorno). Ver docs §"Siguiente paso".
  let via: 'authjs_session' | 'bridge' = 'authjs_session'

  // 2. Bridge del cutover: sin sesión Auth.js → aceptar Bearer Supabase HS256 válido.
  //    verifyAuth (mode=on) lo valida por la rama HS256 de la doble-aceptación.
  //
  // KILL-SWITCH del drenaje (soak Fase B): con AUTH_BRIDGE_ENABLED='false' el bridge
  // se APAGA → los usuarios con solo sesión Supabase legacy reciben 401 → el cliente
  // los desloguea limpio → re-login nativo Auth.js (un clic Google). Fuerza el drenaje
  // en horas en vez de semanas. Reversible al instante (env de task def, sin rebuild):
  // volver a 'true' (o quitarlo) reactiva el bridge. Cuando el drenaje llegue a ~0, se
  // retira el bridge por código (paso de no retorno). Default = activado.
  const bridgeEnabled = process.env.AUTH_BRIDGE_ENABLED !== 'false'
  if (!userId && bridgeEnabled) {
    const bridged = await verifyAuth(request, '/api/auth/token#bridge')
    if (bridged.success) {
      userId = bridged.userId
      email = bridged.email
      via = 'bridge'
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

  // Métrica de drenaje — fire-and-forget (no añade latencia al hot path; pérdida
  // ocasional es aceptable, cada usuario acuña muchas veces al día). Query:
  // scripts/… (o scratchpad/fase-b-drenaje.cjs): distinct user_id por `via` y día.
  emitFireAndForget({
    source: 'vercel',
    severity: 'info',
    eventType: 'auth_token_minted',
    endpoint: '/api/auth/token',
    userId,
    metadata: { via },
  })

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

// El 401 de ESTE endpoint es contrato SIEMPRE — su trabajo es "acuñar token o 401".
// A diferencia de otros endpoints, aquí el 401 con credenciales NO es señal de bug:
// el cliente (authjsAdapter.fetchMintedToken) manda credenciales en cada tick de
// sesión (`credentials:'include'` envía la cookie de sesión authjs; más un Bearer
// puente transitorio en clientes que aún arrastran sesión antigua durante el drenaje)
// y hace polling. Un cliente sin sesión authjs válida → 401 en cada poll → ~340k/día.
// La regla central de withErrorLogging solo filtra el 401 ANÓNIMO (sin credenciales);
// estos van credencializados, así que hace falta marcar el 401 como esperado POR
// CONTRATO aquí. Un fallo de mint real aflora por caída de `auth_token_minted`, no por
// logs de 401. El 503 (issuer_not_configured) NO está en la lista → sí se registra.
export const GET = withErrorLogging('/api/auth/token', _GET, { expectedStatuses: [401] })
