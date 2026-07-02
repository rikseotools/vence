// lib/api/auth/verifyJwtRs256.ts
// Verificación ASÍNCRONA de JWT RS256/JWKS (Fase B — emisor Auth.js).
//
// Contraparte asimétrica de `verifyJwtLocal.ts` (HS256 síncrono). Devuelve el
// MISMO `JwtVerifyResult` → intercambiable en el router de `verifyAuth`.
//
// Resolución de clave:
//   1. clave PÚBLICA local (`AUTH_JWT_PUBLIC_KEY`) si está en env → verificación
//      sin round-trip (el frontend Fargate la tiene inyectada desde SSM).
//   2. si no → JWKS remoto cacheado (`createRemoteJWKSet`) — para servicios sin
//      la clave local (backend, terceros).
//
// SEGURIDAD:
//   - whitelist estricta `['RS256']` (jose rechaza HS/none con material RSA →
//     anti algorithm-confusion; nunca se verifica un HS256 con esta clave).
//   - audience + issuer validados por jose.
//   - exp/iat con clockTolerance 5s.

import {
  jwtVerify,
  createRemoteJWKSet,
  errors as joseErrors,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose'
import {
  AUTH_JWT_ALG,
  AUTH_JWT_AUDIENCE,
  getIssuer,
  getJwksUrl,
  getLocalPublicKey,
} from './rs256'
import type { JwtVerifyResult } from './verifyJwtLocal'

// JWKS remoto cacheado por URL (createRemoteJWKSet ya cachea las claves + TTL).
let remoteJwks: JWTVerifyGetKey | null = null
let remoteJwksUrl: string | null = null

function getRemoteJwks(): JWTVerifyGetKey {
  const url = getJwksUrl()
  if (!remoteJwks || remoteJwksUrl !== url) {
    remoteJwks = createRemoteJWKSet(new URL(url))
    remoteJwksUrl = url
  }
  return remoteJwks
}

/** Solo para tests: resetea el cache del JWKS remoto. */
export function _clearRemoteJwksCache(): void {
  remoteJwks = null
  remoteJwksUrl = null
}

export async function verifyJwtRs256(
  token: string | null | undefined,
): Promise<JwtVerifyResult> {
  if (!token || typeof token !== 'string' || token.length === 0) {
    return { success: false, error: 'no_token' }
  }

  const localKey = await getLocalPublicKey()
  const key = localKey ?? getRemoteJwks()

  try {
    const { payload } = await jwtVerify(token, key as Parameters<typeof jwtVerify>[1], {
      algorithms: [AUTH_JWT_ALG], // whitelist explícita — anti algorithm confusion
      audience: AUTH_JWT_AUDIENCE,
      issuer: getIssuer(),
      clockTolerance: 5,
    })

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
      payload: payload as Readonly<JWTPayload>,
    }
  } catch (err) {
    return { success: false, error: mapJoseError(err) }
  }
}

/** Mapea los errores tipados de jose a la taxonomía de JwtVerifyResult. */
function mapJoseError(err: unknown): Exclude<
  Extract<JwtVerifyResult, { success: false }>['error'],
  'no_token' | 'no_secret_configured'
> {
  if (err instanceof joseErrors.JWTExpired) return 'expired'
  if (err instanceof joseErrors.JWSSignatureVerificationFailed) return 'invalid_signature'
  if (err instanceof joseErrors.JWKSNoMatchingKey) return 'invalid_signature'
  if (err instanceof joseErrors.JOSEAlgNotAllowed) return 'unsupported_alg'
  if (err instanceof joseErrors.JWTClaimValidationFailed) {
    const claim = (err as joseErrors.JWTClaimValidationFailed).claim
    if (claim === 'aud') return 'wrong_audience'
    if (claim === 'iss') return 'wrong_issuer'
    if (claim === 'exp' || claim === 'nbf') return 'expired'
    return 'malformed'
  }
  // ERR_JWS_INVALID / ERR_JWT_INVALID / parse errors → malformed
  return 'malformed'
}
