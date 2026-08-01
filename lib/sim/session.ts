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

/**
 * Marca que dice «esta sesión la ha fabricado una simulación».
 *
 * ── POR QUÉ EXISTE (01/08/2026, T-434) ──────────────────────────────────────────────────────
 *
 * Una simulación con identidad recorre la aplicación DE VERDAD, así que genera los mismos
 * eventos que una persona. Y eso envenena lo que se mide con ellos: el canario de perfiles sin
 * resolver contó **2 usuarios «curados»** que eran las dos corridas de `sim-perfil-roto-se-cura`
 * —una en local y otra contra producción—, o sea que informaba de progreso donde no había
 * ninguno. Peor todavía: la regla `sesion_sin_email` dispara a la PRIMERA, así que el caso 3 de
 * esa misma simulación mandaba una alerta falsa cada vez que se corría. Una alerta que salta por
 * nuestras propias pruebas enseña a ignorarla, que es la forma más cara de perder una alerta.
 *
 * ── LO QUE ESTA MARCA NO PUEDE HACER ────────────────────────────────────────────────────────
 *
 * **Solo etiqueta telemetría. JAMÁS decide permisos ni cambia comportamiento.** Si algún día
 * concediera algo, sería una puerta trasera. Que hoy sea inofensiva se apoya en dos cosas: (a)
 * ponerla exige `AUTH_SECRET`, y quien lo tiene ya puede firmar cualquier sesión —así que no
 * añade poder—; y (b) el guardarraíl `simulacionNoDaPoder` comprueba que nadie la lee para
 * autorizar. La (b) es la que aguanta, porque la (a) deja de ser cierta el día que el secreto
 * se filtre.
 */
export const CLAIM_SIMULACION = 'venceSim'

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
    // Va aquí —en el constructor COMPARTIDO— y no en cada simulación: así toda simulación que
    // forje identidad queda marcada por defecto, incluidas las que nadie ha escrito todavía.
    // Marcar «cuando me acuerde» es exactamente cómo se cuela tráfico de prueba en las métricas.
    [CLAIM_SIMULACION]: true,
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
