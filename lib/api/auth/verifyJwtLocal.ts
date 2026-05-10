// lib/api/auth/verifyJwtLocal.ts
// Verificación LOCAL de JWT de Supabase Auth (sin round-trip a auth.getUser).
//
// Reemplaza el cuello de 250-1000ms en endpoints autenticados con verificación
// criptográfica local <5ms. Hard Gap #1 del roadmap a 10k DAU.
//
// **NUNCA** invocar este helper directamente desde un endpoint sin pasar por
// el wrapper `verifyAuth()` que tiene shadow mode. El helper en sí NO valida
// usuarios baneados, NO consulta BD — eso es responsabilidad del wrapper.
//
// SEGURIDAD CRÍTICA:
// 1. Whitelist explícita de algoritmos: solo HS256 (Supabase usa esto).
//    Esto previene "algorithm confusion attack" (jwt aceptaría tokens
//    firmados con `alg: none` o cambio de RS256→HS256).
// 2. Validación estricta de audience.
// 3. exp + iat verificados por jsonwebtoken automáticamente con clockTolerance.
// 4. Errores tipados — el caller decide cómo responder (401 con mensaje
//    genérico, log detallado para diagnóstico).
//
// REQUISITO RUNTIME:
//   process.env.SUPABASE_JWT_SECRET — secret HS256 de Supabase project.
//   Se obtiene en Dashboard → Settings → API → JWT Settings → JWT Secret.
//   Sin esta env var, el helper devuelve `error: 'no_secret_configured'`.
//
// Ejemplo de payload Supabase (HS256):
//   {
//     "iss": "https://<ref>.supabase.co/auth/v1",
//     "sub": "uuid-del-user",
//     "aud": "authenticated",
//     "email": "user@example.com",
//     "role": "authenticated",
//     "exp": 1234567890,
//     "iat": 1234567890,
//     "session_id": "...",
//     "app_metadata": {...},
//     "user_metadata": {...}
//   }

import jwt, { type JwtPayload, type Algorithm } from 'jsonwebtoken'

/** Algoritmos permitidos. NUNCA añadir 'none' aquí. */
const ALLOWED_ALGORITHMS: Algorithm[] = ['HS256']

/** Audience esperado en tokens de usuario autenticado de Supabase. */
const EXPECTED_AUDIENCE = 'authenticated'

/** Resultado tipado: éxito o error categórico. */
export type JwtVerifyResult =
  | {
      success: true
      userId: string
      email: string | null
      role: string
      // Claims raw del JWT por si el caller necesita app_metadata/user_metadata.
      payload: Readonly<JwtPayload>
    }
  | {
      success: false
      error:
        | 'no_token'             // Bearer header ausente o malformado
        | 'no_secret_configured' // SUPABASE_JWT_SECRET no en env
        | 'invalid_signature'    // firma no verifica (token forjado o secret distinto)
        | 'expired'              // exp en el pasado (con tolerancia de skew)
        | 'malformed'            // JWT no parseable, claims faltantes
        | 'unsupported_alg'      // header.alg no en whitelist (algorithm confusion attempt)
        | 'wrong_audience'       // aud distinto de 'authenticated'
        | 'wrong_issuer'         // iss no de Supabase
    }

/** Para tests: limpiar cache (no aplica en jsonwebtoken pero mantiene API). */
export function _clearSecretCache(): void {
  // Sin cache que limpiar — jsonwebtoken lee el secret en cada llamada.
}

function getJwtSecret(): string | null {
  return process.env.SUPABASE_JWT_SECRET || null
}

/**
 * Verifica un access token JWT de Supabase localmente.
 *
 * Mismo modelo de seguridad que `supabase.auth.getUser()`:
 * - Token con firma válida + no expirado → user válido
 * - Token con firma rota / expirado / malformado → rechazado
 *
 * Diferencias respecto a `getUser()`:
 * - NO consulta BD → no detecta usuarios baneados ni borrados (mitigar a nivel
 *   wrapper o post-verify check de `auth.users.banned_until`).
 * - NO refresca app_metadata si cambió post-issue (los claims son los del token).
 *
 * @param token Bearer token sin el prefijo "Bearer ".
 * @returns Resultado tipado con userId/email/role o error categórico.
 */
export function verifyJwtLocal(token: string | null | undefined): JwtVerifyResult {
  if (!token || typeof token !== 'string' || token.length === 0) {
    return { success: false, error: 'no_token' }
  }

  const secret = getJwtSecret()
  if (!secret) {
    return { success: false, error: 'no_secret_configured' }
  }

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ALLOWED_ALGORITHMS, // whitelist explícita — anti algorithm confusion
      audience: EXPECTED_AUDIENCE,
      clockTolerance: 5, // 5s tolerancia de reloj entre Vercel y Supabase
    }) as JwtPayload

    // Defense-in-depth: aunque jsonwebtoken filtra por algorithms, validamos sub explícito
    const userId = typeof payload.sub === 'string' ? payload.sub : null
    if (!userId) {
      return { success: false, error: 'malformed' }
    }

    const email = typeof payload.email === 'string' ? payload.email : null
    const role = typeof payload.role === 'string' ? payload.role : 'authenticated'

    return {
      success: true,
      userId,
      email,
      role,
      payload: payload as Readonly<JwtPayload>,
    }
  } catch (err) {
    if (!(err instanceof Error)) {
      return { success: false, error: 'malformed' }
    }
    // jsonwebtoken tira errores con `name` específico — mapeamos a nuestra taxonomía
    if (err.name === 'TokenExpiredError') {
      return { success: false, error: 'expired' }
    }
    if (err.name === 'JsonWebTokenError') {
      // Subclases:
      //  - "invalid signature"
      //  - "jwt malformed"
      //  - "invalid algorithm" / "invalid token" (alg fuera de whitelist)
      //  - "jwt audience invalid"
      //  - "jwt issuer invalid"
      const msg = err.message.toLowerCase()
      if (msg.includes('signature')) return { success: false, error: 'invalid_signature' }
      if (msg.includes('audience')) return { success: false, error: 'wrong_audience' }
      if (msg.includes('issuer')) return { success: false, error: 'wrong_issuer' }
      if (msg.includes('algorithm')) return { success: false, error: 'unsupported_alg' }
      if (msg.includes('malformed') || msg.includes('jwt must')) return { success: false, error: 'malformed' }
      // Fallback: tratamos como malformed (no como invalid_signature por safety).
      return { success: false, error: 'malformed' }
    }
    if (err.name === 'NotBeforeError') {
      return { success: false, error: 'expired' } // mismo bucket UX
    }
    return { success: false, error: 'malformed' }
  }
}

/**
 * Helper: extrae el token Bearer del header Authorization.
 * Devuelve null si el header está ausente o no tiene prefijo "Bearer ".
 */
export function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader || typeof authHeader !== 'string') return null
  if (!authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length).trim()
  return token.length > 0 ? token : null
}
