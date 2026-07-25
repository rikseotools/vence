// lib/sim/session.ts
//
// Vence Sim — IDENTIDAD. Acuña la cookie de sesión de la auth PROPIA (Auth.js RS256 sobre
// AWS) para simular COMO cualquier usuario real. NO usa Supabase (prohibido; el bridge
// Supabase está desconectado). El secreto AUTH_SECRET lo aporta el runner (de SSM); aquí
// solo la construcción del token, para poder testear el round-trip encode/decode sin red.
//
// Cookie: `__Secure-authjs.session-token` (AUTH_URL es https → prefijo __Secure-). El
// payload replica lo que produce el callback jwt de lib/auth/authjs.ts: `appUserId` +
// `email` (el callback session mapea appUserId → session.user.id).

import { encode, decode } from 'next-auth/jwt'

export const AUTHJS_SESSION_COOKIE = '__Secure-authjs.session-token'

export interface OwnAuthSubject {
  userId: string
  email: string
}

/** Payload de sesión mínimo que el server acepta (appUserId → user.id). */
export function sessionTokenPayload(sub: OwnAuthSubject, nowSec: number, ttlSec: number) {
  return {
    appUserId: sub.userId,
    email: sub.email,
    sub: sub.userId,
    iat: nowSec,
    exp: nowSec + ttlSec,
    jti: `vence-sim-${sub.userId}`,
  }
}

/**
 * Cifra el JWE de sesión Auth.js con AUTH_SECRET (mismo `encode` que usa el server →
 * `decode` server-side lo acepta). Devuelve el valor de la cookie.
 */
export async function mintOwnAuthCookie(
  sub: OwnAuthSubject,
  secret: string,
  opts: { nowSec: number; ttlSec?: number } ,
): Promise<string> {
  if (!secret) throw new Error('[sim] mintOwnAuthCookie: falta AUTH_SECRET')
  const ttl = opts.ttlSec ?? 1800
  const token = sessionTokenPayload(sub, opts.nowSec, ttl)
  return encode({ token, secret, salt: AUTHJS_SESSION_COOKIE, maxAge: ttl })
}

/** Round-trip para tests/diagnóstico: descifra y devuelve el appUserId/email. */
export async function readOwnAuthCookie(value: string, secret: string) {
  return decode({ token: value, secret, salt: AUTHJS_SESSION_COOKIE })
}

/** Descriptor de cookie listo para Playwright `context.addCookies`. */
export function cookieForPlaywright(value: string, host = 'www.vence.es') {
  return { name: AUTHJS_SESSION_COOKIE, value, domain: host, path: '/', httpOnly: true, secure: true, sameSite: 'Lax' as const }
}
