// lib/auth/mintAccessToken.ts
// Acuña un access token RS256 con el contrato de Vence (Fase B — emisor Auth.js).
//
// SERVER-ONLY. Lo llama `/api/auth/token` a partir de la sesión Auth.js ya
// verificada (el `sub` sale del lookup email→user_profiles.id hecho en el callback
// `jwt` de Auth.js, NUNCA del input del cliente).
//
// El token resultante lo aceptan `verifyJwtRs256` (frontend) y el `JwtVerifier`
// del backend (rama RS256/JWKS). Vida ~1h, igual que el HS256 de Supabase.

import { SignJWT } from 'jose'
import {
  AUTH_JWT_ALG,
  AUTH_JWT_AUDIENCE,
  canSign,
  getIssuer,
  getKid,
  getPrivateKey,
} from '@/lib/api/auth/rs256'

/** Vida del access token en segundos (~1h, paridad con el HS256 de Supabase). */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60

export interface MintAccessTokenArgs {
  /** `user_profiles.id` — el UUID canónico del que cuelga toda la data del usuario. */
  sub: string
  email: string | null
  /** Rol del contrato. Default 'authenticated'. */
  role?: string
}

export interface MintedAccessToken {
  token: string
  /** epoch en segundos en que expira. */
  expiresAt: number
}

/**
 * Firma un access token RS256. Devuelve `null` si el emisor no está configurado
 * (claves/kid ausentes) → el endpoint responde 503 en vez de reventar (dormido).
 */
export async function mintAccessToken(
  args: MintAccessTokenArgs,
): Promise<MintedAccessToken | null> {
  if (!canSign()) return null

  const privateKey = await getPrivateKey()
  const kid = getKid()
  if (!privateKey || !kid) return null

  if (!args.sub || typeof args.sub !== 'string') {
    throw new Error('mintAccessToken: sub requerido (user_profiles.id)')
  }

  const nowSec = Math.floor(Date.now() / 1000)
  const expiresAt = nowSec + ACCESS_TOKEN_TTL_SECONDS

  const token = await new SignJWT({
    email: args.email ?? null,
    role: args.role ?? 'authenticated',
  })
    .setProtectedHeader({ alg: AUTH_JWT_ALG, kid, typ: 'JWT' })
    .setSubject(args.sub)
    .setAudience(AUTH_JWT_AUDIENCE)
    .setIssuer(getIssuer())
    .setIssuedAt(nowSec)
    .setExpirationTime(expiresAt)
    .sign(privateKey)

  return { token, expiresAt }
}
