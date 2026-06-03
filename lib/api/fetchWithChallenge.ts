// lib/api/fetchWithChallenge.ts
//
// Wrapper de fetch que maneja el protocolo "challenge required" de forma
// transparente. Si el servidor responde 403 { challengeRequired:true }, muestra
// el widget (vía el ChallengeProvider montado), obtiene el token y REINTENTA la
// petición original con la cabecera `x-captcha-token`.
//
// Proteger un endpoint nuevo en cliente = cambiar `fetch(...)` por
// `fetchWithChallenge(...)`. Nada más.

import {
  CAPTCHA_TOKEN_HEADER,
  isChallengeRequiredResponse,
} from '@/lib/security/captcha/protocol'
import { solveChallenge } from './challengeBridge'

/**
 * Igual que `fetch`, pero resuelve automáticamente un reto humano si el
 * servidor lo pide. Reintenta UNA vez con el token. Si el segundo intento
 * vuelve a pedir reto, devuelve esa respuesta tal cual (el caller decide).
 */
export async function fetchWithChallenge(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const first = await fetch(input, init)

  // Solo nos interesa el 403 con el marcador. Cualquier otra cosa pasa intacta.
  if (first.status !== 403 || first.headers.get('x-challenge-required') !== '1') {
    return first
  }

  // Clonar para poder leer el body sin consumir la respuesta que devolveríamos
  // si algo falla.
  let action: string | undefined
  try {
    const data = await first.clone().json()
    if (!isChallengeRequiredResponse(data)) return first
    action = data.action
  } catch {
    return first
  }

  // Pedir token al usuario (modal del ChallengeProvider).
  let token: string
  try {
    token = await solveChallenge(action)
  } catch {
    // No hay provider o el usuario canceló → devolver el 403 original.
    return first
  }

  // Reintentar con el token en la cabecera.
  const headers = new Headers(init?.headers)
  headers.set(CAPTCHA_TOKEN_HEADER, token)
  return fetch(input, { ...init, headers })
}
