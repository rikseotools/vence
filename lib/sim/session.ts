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
  opts: { nowSec: number; ttlSec?: number; host?: string } ,
): Promise<string> {
  if (!secret) throw new Error('[sim] mintOwnAuthCookie: falta AUTH_SECRET')
  const ttl = opts.ttlSec ?? 1800
  const token = sessionTokenPayload(sub, opts.nowSec, ttl)
  // El salt DEBE ser el nombre real de la cookie en ese host (difiere en local).
  const salt = sessionCookieNameFor(opts.host ?? 'www.vence.es')
  return encode({ token, secret, salt, maxAge: ttl })
}

/** Round-trip para tests/diagnóstico: descifra y devuelve el appUserId/email. */
export async function readOwnAuthCookie(value: string, secret: string) {
  return decode({ token: value, secret, salt: AUTHJS_SESSION_COOKIE })
}

/** Nombre de cookie de sesión según el host: en local (http) Auth.js NO usa el prefijo
 * `__Secure-` (que el navegador solo acepta por https). El nombre es además el SALT del
 * cifrado, así que emisor y app tienen que coincidir o la sesión no se descifra. */
export function sessionCookieNameFor(host: string): string {
  const esLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(host)
  return esLocal ? 'authjs.session-token' : AUTHJS_SESSION_COOKIE
}

/** Descriptor de cookie listo para Playwright `context.addCookies`. */
export function cookieForPlaywright(value: string, host = 'www.vence.es') {
  const name = sessionCookieNameFor(host)
  const esLocal = name !== AUTHJS_SESSION_COOKIE
  return { name, value, domain: host, path: '/', httpOnly: true, secure: !esLocal, sameSite: 'Lax' as const }
}
