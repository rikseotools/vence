// lib/security/captcha/challenge.ts
//
// Parte SERVIDOR del protocolo "challenge required": construye la respuesta 403
// estándar y extrae el token del request. Importa `next/server`, así que NO debe
// llegar al bundle de cliente — la parte client-safe está en `protocol.ts`.

import { NextResponse } from 'next/server'
import { getPublicSiteKey, getCaptchaConfig } from './config'
import { CAPTCHA_TOKEN_HEADER, type ChallengeRequiredBody } from './protocol'

// Re-export de la parte client-safe para que los imports existentes sigan
// funcionando desde aquí (los callers de cliente deben importar de protocol.ts).
export {
  CAPTCHA_TOKEN_HEADER,
  isChallengeRequiredResponse,
} from './protocol'
export type { ChallengeRequiredBody } from './protocol'

/**
 * Construye la respuesta 403 estándar pidiendo al cliente que resuelva el reto.
 * Status 403 (no 429) para distinguir "demuéstrame que eres humano" de un
 * rate-limit puro. El marcador `x-challenge-required:1` permite al wrapper de
 * cliente reconocerla sin parsear el body.
 */
export function challengeRequiredResponse(action?: string): NextResponse {
  const cfg = getCaptchaConfig()
  const body: ChallengeRequiredBody = {
    challengeRequired: true,
    provider: cfg.provider,
    siteKey: getPublicSiteKey(),
    action,
  }
  return NextResponse.json(body, {
    status: 403,
    headers: { 'x-challenge-required': '1' },
  })
}

/**
 * Extrae el token del request (cabecera `x-captcha-token`). Devuelve null si no
 * hay. Acepta `Request` (App Router) o cualquier objeto con `.headers.get`.
 */
export function extractCaptchaToken(req: {
  headers: { get(name: string): string | null }
}): string | null {
  return req.headers.get(CAPTCHA_TOKEN_HEADER) || null
}
