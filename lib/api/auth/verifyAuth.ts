// lib/api/auth/verifyAuth.ts
// Wrapper de verificación de auth para endpoints API. Soporta 3 modos via env:
//
//   JWT_LOCAL_VERIFY_MODE=off     → Solo getUser() remoto (comportamiento actual)
//   JWT_LOCAL_VERIFY_MODE=shadow  → Ambos en paralelo, log diff, sirve remoto
//   JWT_LOCAL_VERIFY_MODE=on      → Solo verifyJwtLocal (ahorra round-trip)
//
// PROPÓSITO: red de seguridad para migrar de auth.getUser() (250-1000ms HTTP
// round-trip) a verificación local <5ms sin riesgo de bypass.
//
// FLUJO RECOMENDADO:
//   1. Deploy con MODE=off — comportamiento idéntico al actual
//   2. Set MODE=shadow en producción durante 24-48h. Observar logs.
//      Si hay 0 divergencias → confianza alta.
//   3. Set MODE=on. Latencia baja de 1.5s p50 → 0.5s p50.
//   4. Tras 1 semana sin issues, opcionalmente eliminar el round-trip residual.
//
// ROLLBACK: env var → off + redeploy. <2 min.
//
// LOGS DE DIVERGENCIA: si shadow detecta que getUser y verifyJwtLocal devuelven
// resultados distintos, se loguea WARNING a Sentry y a validation_error_logs
// para investigar antes de hacer flip a 'on'.

import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import {
  adminQueSuplanta,
  impersonacionCaducada,
  permitidoDuranteImpersonacion,
} from '@/lib/admin/impersonacion'
import { emitFireAndForget } from '@/lib/observability/emit'
import { decodeProtectedHeader } from 'jose'
import { verifyJwtLocal, extractBearerToken, type JwtVerifyResult } from './verifyJwtLocal'
import { verifyJwtRs256 } from './verifyJwtRs256'
import { logValidationError } from '@/lib/api/validation-error-log'

/**
 * Verificación local enrutada por el `alg` del header (doble-aceptación de Fase B):
 *   - RS256 → verificador asimétrico JWKS (tokens nuevos de Auth.js)
 *   - HS256 → verificador simétrico Supabase (tokens legacy, intacto)
 *   - cualquier otro / 'none' → rechazado sin intentar (anti algorithm confusion)
 *
 * Mientras no se emitan RS256 (flip de Fase B no hecho), la rama RS256 nunca se
 * ejerce en prod → el path HS256 vivo queda byte-idéntico.
 */
async function verifyLocalToken(token: string): Promise<JwtVerifyResult> {
  let alg: string | undefined
  try {
    alg = decodeProtectedHeader(token).alg
  } catch {
    return { success: false, error: 'malformed' }
  }
  if (alg === 'RS256') return verifyJwtRs256(token)
  if (alg === 'HS256') return verifyJwtLocal(token)
  return { success: false, error: 'unsupported_alg' }
}

/**
 * Lee los claims de suplantación (`imp` = quién mira, `impExp` = cuándo caduca) SIN verificar
 * la firma.
 *
 * Parece peligroso y no lo es, porque solo se usa para **denegar**: un token inválido ya se
 * rechaza por su camino normal, y aquí lo único que puede pasar es que alguien se invente un
 * `imp` para que le bloqueemos MÁS. Hace falta en los modos que verifican contra el
 * proveedor remoto, que devuelve identidad pero no el payload completo.
 *
 * Devuelve la forma que esperan `adminQueSuplanta` e `impersonacionCaducada`, para que las
 * tres ramas del verificador decidan con el MISMO núcleo puro y no con lecturas a mano.
 */
function impSinVerificar(token: string): { imp: string | null; impExp: number | null } {
  const vacio = { imp: null, impExp: null }
  try {
    const [, cuerpo] = token.split('.')
    if (!cuerpo) return vacio
    const json = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'))
    return {
      imp: typeof json?.imp === 'string' && json.imp ? json.imp : null,
      impExp: typeof json?.impExp === 'number' ? json.impExp : null,
    }
  } catch {
    return vacio
  }
}

/**
 * Si el token es una suplantación YA CADUCADA, se corta aquí con 401 (la sesión no debería
 * existir) y se deja señal. Devuelve `null` cuando no hay nada que cortar.
 *
 * ## Por qué existe si el corte «de verdad» está en la rotación de Auth.js
 *
 * Porque son caminos distintos y solo uno pasa por Auth.js. La rotación mata la COOKIE; este
 * verificador ve el ACCESS TOKEN, que ya está firmado y en manos del cliente. Un Bearer vivo
 * con la suplantación terminada es exactamente el hueco que este corte cierra.
 *
 * Y por eso la señal va como `warn`: en régimen normal no debería dispararse casi nunca —el
 * token se acuña ya capado a la vida de la suplantación—, así que verla subir significa que
 * alguna de las capas de arriba dejó de funcionar. Es un detector de regresión, no ruido.
 */
function rechazarSiImpersonacionCaducada(
  payload: unknown,
  endpoint: string,
): AuthVerifyResult | null {
  if (!impersonacionCaducada(payload, Math.floor(Date.now() / 1000))) return null
  const admin = adminQueSuplanta(payload)
  console.warn(`🔒 [impersonacion] sesión suplantada CADUCADA rechazada en ${endpoint} (admin=${admin})`)
  emitFireAndForget({
    source: 'vercel',
    severity: 'warn',
    eventType: 'impersonacion_caducada_rechazada',
    endpoint,
    metadata: { admin },
  })
  // 401 y no 403: aquí la sesión ya no vale para NADA, ni siquiera para leer. El 403 de al
  // lado dice «válida, pero no escribes»; decir eso de una sesión muerta despistaría al
  // diagnosticar y dejaría al cliente reintentando en vez de re-autenticar.
  return { success: false, status: 401, reason: 'impersonacion_caducada' }
}

/**
 * Si el token es de suplantación y la petición escribe, se corta aquí con 403 y se deja
 * señal. Devuelve `null` cuando no hay nada que bloquear.
 */
function bloquearSiEscribeSuplantando(
  payload: unknown,
  metodo: string,
  endpoint: string,
): AuthVerifyResult | null {
  const admin = adminQueSuplanta(payload)
  if (!admin) return null
  if (permitidoDuranteImpersonacion(metodo)) return null
  console.warn(`🔒 [impersonacion] ${admin} intentó ${metodo} ${endpoint} — bloqueado (solo lectura)`)
  emitFireAndForget({
    source: 'vercel',
    severity: 'warn',
    eventType: 'impersonacion_escritura_bloqueada',
    endpoint,
    metadata: { admin, metodo },
  })
  return {
    success: false,
    status: 403,
    reason: 'impersonacion_solo_lectura',
    impersonadoPor: admin,
  }
}

export type AuthVerifyResult =
  | {
      success: true
      userId: string
      email: string | null
      /** Cómo se verificó: importante para diagnóstico de divergencias. */
      verifiedBy: 'remote' | 'local' | 'shadow_remote'
      /** Email del admin que está viendo esta cuenta (T-289). null = sesión normal. */
      impersonadoPor?: string | null
    }
  | {
      success: false
      /** 403, no 401: la sesión es válida — lo que no se permite es ESCRIBIR con ella. */
      status: 403
      reason: 'impersonacion_solo_lectura'
      impersonadoPor: string
    }
  | {
      success: false
      status: 401
      reason: string
    }

type Mode = 'off' | 'shadow' | 'on'

function getMode(): Mode {
  const v = process.env.JWT_LOCAL_VERIFY_MODE
  if (v === 'shadow') return 'shadow'
  if (v === 'off') return 'off'
  // Default = 'on' (verificación LOCAL), que es lo que corre en producción desde el flip.
  //
  // ⚠️ Era 'off' —verificar contra el proveedor REMOTO, es decir Supabase— y se llamaba a sí
  // mismo «default seguro». Dejó de serlo el día del flip: desde que los tokens son RS256 de
  // Auth.js, pedirle a Supabase que los valide devuelve 401 **en todas las peticiones**. Así
  // que cualquier entorno que no defina la variable (local, previews) tenía la sesión rota de
  // raíz: el perfil no cargaba, el avatar salía sin nombre y la racha a cero, mientras en
  // producción todo iba bien.
  //
  // Junto con el default de `NEXT_PUBLIC_AUTH_PROVIDER` (que también seguía en 'supabase'),
  // son dos valores por omisión anclados al proveedor viejo cuatro semanas después de
  // migrar. Un default no es «seguro» por ser el antiguo: es seguro si coincide con lo que
  // está VIVO. Se descubrió el 30/07 comparando el avatar de producción con el de local.
  return 'on'
}

async function verifyRemote(token: string): Promise<{ userId: string; email: string | null } | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null
    return { userId: user.id, email: user.email ?? null }
  } catch {
    return null
  }
}

/**
 * Verifica el Bearer token del request y devuelve el user autenticado.
 * Encapsula la decisión de modo (off/shadow/on) y el shadow comparison.
 *
 * @param request NextRequest con header Authorization
 * @param endpoint Identificador para logs (e.g. '/api/v2/answer-and-save')
 */
export async function verifyAuth(
  request: NextRequest,
  endpoint: string,
): Promise<AuthVerifyResult> {
  const authHeader = request.headers.get('authorization')
  const token = extractBearerToken(authHeader)
  if (!token) {
    return { success: false, status: 401, reason: 'no_bearer_token' }
  }

  const mode = getMode()

  // Modo off: comportamiento legacy (solo remoto)
  if (mode === 'off') {
    const remote = await verifyRemote(token)
    if (!remote) {
      return { success: false, status: 401, reason: 'remote_verify_failed' }
    }
    // El candado de suplantación va en las TRES ramas. Ponerlo solo en la que corre hoy
    // (`on`) haría que un cambio de esta variable —una env, no un despliegue de código—
    // desactivara la protección **en silencio**, que es la peor forma de perderla.
    const claimsOff = impSinVerificar(token)
    const caducadaOff = rechazarSiImpersonacionCaducada(claimsOff, endpoint)
    if (caducadaOff) return caducadaOff
    const bloqueoOff = bloquearSiEscribeSuplantando(claimsOff, request.method, endpoint)
    if (bloqueoOff) return bloqueoOff
    return {
      success: true,
      userId: remote.userId,
      email: remote.email,
      verifiedBy: 'remote',
      impersonadoPor: claimsOff.imp,
    }
  }

  // Modo on: solo local (latencia <5ms; RS256/JWKS cachea la clave)
  if (mode === 'on') {
    const local = await verifyLocalToken(token)
    if (!local.success) {
      // Log details para diagnóstico (sin token completo por seguridad)
      console.warn(`🔒 [auth/local] ${endpoint} rejected: ${local.error}`)
      return { success: false, status: 401, reason: `local_${local.error}` }
    }
    // T-289 — CANDADO DE SOLO LECTURA de la suplantación.
    //
    // Va aquí, y no en cada endpoint, porque este es el paso por el que pasan TODAS las
    // APIs autenticadas: una guarda por endpoint sería confiar en que nadie olvide uno, y
    // el fallo clásico de esta función es justamente el admin que escribe creyendo que
    // está en su sesión. Con la marca `imp` dentro del token, escribir es imposible aunque
    // la interfaz se equivoque.
    // Antes del candado va el reloj: una suplantación caducada no puede ni leer (T-335).
    const caducada = rechazarSiImpersonacionCaducada(local.payload, endpoint)
    if (caducada) return caducada
    const bloqueo = bloquearSiEscribeSuplantando(local.payload, request.method, endpoint)
    if (bloqueo) return bloqueo
    return {
      success: true,
      userId: local.userId,
      email: local.email,
      verifiedBy: 'local',
      impersonadoPor: adminQueSuplanta(local.payload),
    }
  }

  // Modo shadow: AMBAS verificaciones en paralelo, log diff, sirve remoto
  const [localResult, remoteResult] = await Promise.all([
    verifyLocalToken(token),
    verifyRemote(token),
  ])

  // Compute divergence
  const localOk = localResult.success
  const remoteOk = remoteResult !== null
  let diverged = false
  let divergenceKind: string | null = null

  if (localOk !== remoteOk) {
    diverged = true
    divergenceKind = localOk ? 'local_ok_remote_fail' : 'remote_ok_local_fail'
  } else if (localOk && remoteOk) {
    if (localResult.userId !== remoteResult!.userId) {
      diverged = true
      divergenceKind = 'userid_mismatch'
    } else if (localResult.email !== remoteResult!.email) {
      // Email puede divergir si el user cambió email desde que se firmó el token.
      // No es bypass de seguridad pero merece nota.
      diverged = true
      divergenceKind = 'email_mismatch'
    }
  }

  if (diverged) {
    const localUserId = localOk ? localResult.userId.slice(0, 8) : null
    const remoteUserId = remoteOk ? remoteResult!.userId.slice(0, 8) : null
    console.warn(
      `🔒 [auth/shadow] DIVERGENCE in ${endpoint}: kind=${divergenceKind} ` +
      `local=${localOk ? `ok(${localUserId})` : `fail(${localResult.success ? '' : localResult.error})`} ` +
      `remote=${remoteOk ? `ok(${remoteUserId})` : 'fail'}`
    )
    // Fire-and-forget: log a BD para análisis posterior
    logValidationError({
      endpoint,
      errorType: 'shadow_auth_divergence',
      errorMessage: `divergence kind=${divergenceKind}`,
      severity: 'warning',
      httpStatus: 200, // shadow no afecta UX
      requestBody: {
        local_ok: localOk,
        remote_ok: remoteOk,
        local_error: localOk ? null : (localResult as { error: string }).error,
        kind: divergenceKind,
      },
    })
  }

  // En shadow, SIEMPRE servimos el resultado del remoto (comportamiento idéntico al actual)
  if (!remoteOk) {
    return { success: false, status: 401, reason: 'remote_verify_failed' }
  }
  const claimsShadow = impSinVerificar(token)
  const caducadaShadow = rechazarSiImpersonacionCaducada(claimsShadow, endpoint)
  if (caducadaShadow) return caducadaShadow
  const bloqueoShadow = bloquearSiEscribeSuplantando(claimsShadow, request.method, endpoint)
  if (bloqueoShadow) return bloqueoShadow
  return {
    success: true,
    userId: remoteResult!.userId,
    email: remoteResult!.email,
    verifiedBy: 'shadow_remote',
    impersonadoPor: claimsShadow.imp,
  }
}

/**
 * Variante para endpoints con auth OPCIONAL (anónimos permitidos).
 * Devuelve userId/email si el token verifica, null si no hay token o falla.
 * No devuelve error — el endpoint decide qué hacer con el null.
 *
 * Usa el mismo wrapper `verifyAuth` interno → respeta el mismo JWT_LOCAL_VERIFY_MODE
 * (off/shadow/on) que los endpoints con auth obligatoria.
 */
export async function verifyAuthOptional(
  request: NextRequest,
  endpoint: string,
): Promise<{ userId: string; email: string | null } | null> {
  const result = await verifyAuth(request, endpoint)
  if (!result.success) return null
  return { userId: result.userId, email: result.email }
}
