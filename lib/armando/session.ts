// lib/armando/session.ts
// Cookie httpOnly firmada con HMAC para auth del panel /armando.
// Sustituye a sessionStorage + passwords-en-bundle por validación server-side.
//
// Nota: Manuel ya no usa /armando — accede vía /admin/cobros con su user
// admin de Supabase. Por eso solo existe el rol 'armando'.

import crypto from 'crypto'
import type { NextRequest } from 'next/server'
import type { ResponseCookies } from 'next/dist/compiled/@edge-runtime/cookies'

export type ArmandoRole = 'armando'

const COOKIE_NAME = 'armando_session'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12 // 12h

interface SessionPayload {
  role: ArmandoRole
  exp: number
}

function getSecret(): string {
  const s = process.env.ARMANDO_SESSION_SECRET
  if (!s || s.length < 32) {
    throw new Error('ARMANDO_SESSION_SECRET no configurado o demasiado corto (>=32 chars)')
  }
  return s
}

function sign(value: string): string {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('base64url')
}

function encode(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = sign(body)
  return `${body}.${sig}`
}

function decode(token: string): SessionPayload | null {
  const dot = token.indexOf('.')
  if (dot < 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(body)
  if (sig.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null
    if (parsed.role !== 'armando') return null
    return parsed
  } catch {
    return null
  }
}

export function readSession(req: NextRequest): SessionPayload | null {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return decode(token)
}

export function setSessionCookie(cookies: ResponseCookies, role: ArmandoRole): void {
  const exp = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SECONDS
  const token = encode({ role, exp })
  cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })
}

export function clearSessionCookie(cookies: ResponseCookies): void {
  cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}

/**
 * Verifica el password contra el SHA-256 almacenado en env.
 * Almacenamos el hash (no el plaintext) por dos razones:
 *   1. Defensa en profundidad si .env.local se filtra.
 *   2. Evita problemas de parsing de chars especiales ($, #, etc.) en
 *      env vars, que dotenv-expand de Next.js interpreta de forma sutil.
 * Comparación en tiempo constante.
 */
export function verifyPassword(password: string): ArmandoRole | null {
  const expectedHashHex = process.env.ARMANDO_PASSWORD_SHA256
  if (!expectedHashHex || expectedHashHex.length !== 64) {
    throw new Error('ARMANDO_PASSWORD_SHA256 no configurado o inválido (esperado: 64 hex chars)')
  }
  const candidateHash = crypto.createHash('sha256').update(password).digest()
  const expectedHash = Buffer.from(expectedHashHex, 'hex')
  if (candidateHash.length !== expectedHash.length) return null
  const ok = crypto.timingSafeEqual(candidateHash, expectedHash)
  return ok ? 'armando' : null
}
