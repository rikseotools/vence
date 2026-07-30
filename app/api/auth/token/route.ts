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
import { canonicalSubForToken } from '@/lib/auth/resolveAppUser'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { emitFireAndForget } from '@/lib/observability/emit'
import { MINT_REASON_HEADER, sanitizeMintReason } from '@/lib/auth/mintReason'
import { impersonacionCaducada, restanteImpersonacionSeg, MARCA_IMPERSONACION } from '@/lib/admin/impersonacion'

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

  // 3. [T-245] El `sub` DEBE tener perfil. Si no lo tiene, se reconcilia por email ANTES
  //    de acuñar: con un sub sin fila en `user_profiles`, todo lo que se indexa por id
  //    rebota —checkout («User not found in database»), suscripción, y hasta el formulario
  //    de soporte (FK)— y el usuario no puede ni avisarnos, así que el fallo se oculta solo.
  //    Curarlo AQUÍ arregla al afectado en su siguiente tick de sesión, sin re-login y sin
  //    tocar los endpoints de pago. Caso real 28/07: 24 intentos de compra rechazados a un
  //    usuario que YA tenía perfil premium con otro id.
  const decision = await canonicalSubForToken(userId, email)
  if (decision.reconciliado || decision.huerfano) {
    emitFireAndForget({
      source: 'vercel',
      severity: decision.huerfano ? 'error' : 'warn',
      eventType: 'auth_sub_reconciliado',
      endpoint: '/api/auth/token',
      userId: decision.sub,
      metadata: {
        via,
        subOriginal: userId,
        subAcunado: decision.sub,
        // huerfano = ni el sub ni el email resuelven: NO se puede arreglar aquí y el
        // usuario seguirá roto → por eso va como `error`, no como `warn`.
        resultado: decision.huerfano ? 'huerfano' : 'reconciliado',
      },
    })
  }
  userId = decision.sub

  // T-289: si la sesión es de suplantación, el access token se acuña TAMBIÉN marcado. Sin
  // esto la marca se quedaría en la cookie y las APIs verían una sesión normal — es decir,
  // el candado de solo lectura no existiría donde de verdad hace falta.
  const impersonadoPor = (session as unknown as { impersonadoPor?: string } | null)?.impersonadoPor ?? null
  const impersonadoHasta =
    (session as unknown as { impersonadoHasta?: number } | null)?.impersonadoHasta ?? null

  // T-335: una suplantación caducada no acuña nada. En la práctica no debería llegar aquí
  // —el callback `jwt` la mata al rotar, así que `auth()` ya no devolvería sesión— pero el
  // 401 explícito evita que este camino dependa de que aquello siga siendo cierto, y evita
  // el 503 «issuer_not_configured» que daría el `null` del acuñador: un error que apunta al
  // sitio equivocado cuesta más que el fallo que describe.
  if (impersonacionCaducada({ imp: impersonadoPor, impExp: impersonadoHasta }, Math.floor(Date.now() / 1000))) {
    emitFireAndForget({
      source: 'vercel',
      severity: 'warn',
      eventType: 'impersonacion_caducada_rechazada',
      endpoint: '/api/auth/token',
      metadata: { admin: impersonadoPor },
    })
    return NextResponse.json({ error: 'impersonacion_caducada' }, { status: 401 })
  }

  const minted = await mintAccessToken({
    sub: userId,
    email,
    imp: impersonadoPor,
    impExp: impersonadoHasta,
  })
  if (!minted) {
    // Emisor dormido (claves no configuradas) → no romper, señalar indisponible.
    return NextResponse.json({ error: 'issuer_not_configured' }, { status: 503 })
  }

  // Métrica de drenaje — fire-and-forget (no añade latencia al hot path).
  // MUESTREADA: cada usuario acuña en CADA tick de sesión → ~675k/día, era el mayor
  // contribuyente a observable_events (firehose). `via='bridge'` es la señal que de
  // verdad importa (cuándo llega a 0 se retira el bridge) → se emite SIEMPRE;
  // `authjs_session` es el grueso → se muestrea al 10%. El health del minteo NO
  // depende de este conteo: lo cubre la alerta `auth_mint_drop` vía request_completed
  // http_status=200 (muestreo consistente 10%, sin falso positivo de transición).
  const MINT_SAMPLE_RATE = 0.1
  if (via === 'bridge' || Math.random() < MINT_SAMPLE_RATE) {
    // POR QUÉ se acuñó (T-210). El servidor no puede deducirlo —solo ve la petición—, así que
    // lo manda el cliente en una cabecera y aquí se VALIDA contra la taxonomía cerrada antes
    // de escribirlo: nunca entra texto libre del navegador en `observable_events` (rompería
    // los GROUP BY con los que se lee esto, y es cardinalidad inyectable). Un cliente viejo
    // sin la cabecera cuenta como `desconocido`, que es la verdad, en vez de perderse.
    const reason = sanitizeMintReason(request.headers.get(MINT_REASON_HEADER))
    emitFireAndForget({
      source: 'vercel',
      severity: 'info',
      eventType: 'auth_token_minted',
      endpoint: '/api/auth/token',
      userId,
      metadata: { via, reason, sampleRate: via === 'bridge' ? 1 : MINT_SAMPLE_RATE },
    })
  }

  const respuesta = NextResponse.json(
    {
      accessToken: minted.token,
      expiresAt: minted.expiresAt,
      // Identidad, para que el cliente construya la sesión sin depender de la cookie
      // Auth.js (necesario en el bridge, donde aún no hay sesión Auth.js).
      user: { id: userId, email },
      // T-335: quién mira y hasta cuándo. Va en el cuerpo para que la franja de aviso pueda
      // saberlo por una petición que el cliente YA hace en cada tick de sesión, en vez de
      // depender de una cookie que caduca por su cuenta.
      ...(impersonadoPor ? { impersonadoPor, impersonadoHasta } : {}),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )

  // T-335 — la cookie-marca se RE-EMITE aquí, atada al reloj real de la suplantación.
  //
  // Antes tenía vida propia (30 min desde que se acuñó, sin renovarse nunca) mientras la
  // sesión sí se renovaba: pasados esos 30 minutos la franja roja desaparecía y la
  // suplantación seguía viva, es decir, quedaba **invisible**. Ahora su `maxAge` es el
  // restante de la suplantación, así que las dos mueren a la vez por construcción; y si el
  // navegador la pierde, el siguiente tick de sesión la repone.
  //
  // Sigue sin ser una credencial: solo dice «esta sesión es suplantada». Falsearla a mano
  // pinta la franja y nada más.
  if (impersonadoPor) {
    const restante = restanteImpersonacionSeg(
      { imp: impersonadoPor, impExp: impersonadoHasta },
      Math.floor(Date.now() / 1000),
    )
    if (restante && restante > 0) {
      respuesta.cookies.set(MARCA_IMPERSONACION, '1', {
        httpOnly: false,
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
        path: '/',
        maxAge: restante,
      })
    }
  }
  return respuesta
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
