// lib/auth/verifyGoogleIdToken.ts — Verificación server-side del id_token de Google
// (Google One Tap / FedCM). Usado por el provider Credentials `google-one-tap` de
// Auth.js (lib/auth/authjs.ts) para portar One Tap al flip RS256 sin depender de
// Supabase `signInWithIdToken` (que quedó deshabilitado).
//
// SOLO SERVIDOR (usa node:crypto + JWKS remoto). No importar desde código cliente.
//
// Seguridad: se verifica la FIRMA (JWKS oficial de Google) + `aud` (nuestro client
// id) + `iss` + `exp` (vía jose), y además el `nonce` (anti-replay de One Tap) y
// `email_verified`. La lógica pura (hash de nonce + validación del payload) se
// aísla para poder testearla sin red.

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { createHash } from 'node:crypto'

// JWKS oficial de Google (jose lo cachea y refresca solo).
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

export interface VerifiedGoogleUser {
  email: string
  name: string | null
  sub: string
}

/**
 * Hash que Google pone en el claim `nonce` del id_token: base64url(SHA-256(nonceRaw)).
 * El cliente (GoogleOneTap) genera el nonce raw y envía su hash a Google; aquí
 * recomputamos desde el raw para compararlo. Pura y testeable.
 */
export function hashNonce(rawNonce: string): string {
  return createHash('sha256').update(rawNonce).digest('base64url')
}

/**
 * Valida el payload YA verificado criptográficamente (firma/aud/iss/exp los comprueba
 * jose) y extrae el usuario. Comprueba el nonce (si el token lo trae) y que el email
 * esté verificado. Devuelve null si algo no cuadra. Pura y testeable (sin red).
 */
export function extractVerifiedGoogleUser(
  payload: JWTPayload & { email?: unknown; email_verified?: unknown; name?: unknown; nonce?: unknown },
  rawNonce: string | undefined,
): VerifiedGoogleUser | null {
  // Anti-replay: si el id_token trae nonce, DEBE coincidir con el hash del raw.
  if (typeof payload.nonce === 'string' && payload.nonce.length > 0) {
    if (!rawNonce) return null
    if (payload.nonce !== hashNonce(rawNonce)) return null
  }
  const email = typeof payload.email === 'string' ? payload.email.trim() : ''
  if (!email) return null
  // Google manda email_verified como boolean o string 'true'/'false'.
  if (payload.email_verified === false || payload.email_verified === 'false') return null
  const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : null
  const sub = typeof payload.sub === 'string' && payload.sub ? payload.sub : email
  return { email, name, sub }
}

/**
 * Verifica un id_token de Google de punta a punta y devuelve el usuario, o null si
 * es inválido (firma/aud/iss/exp/nonce/email). `audience` = nuestro Google client id.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  rawNonce: string | undefined,
  audience: string,
): Promise<VerifiedGoogleUser | null> {
  if (!idToken || !audience) return null
  let payload: JWTPayload
  try {
    ;({ payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: GOOGLE_ISSUERS,
      audience,
    }))
  } catch {
    return null // firma inválida, aud/iss/exp mal, etc.
  }
  return extractVerifiedGoogleUser(payload, rawNonce)
}
