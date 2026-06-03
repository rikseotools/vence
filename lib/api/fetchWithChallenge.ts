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
 * Adjunta la huella de dispositivo (X-Device-Id / X-Hw-Fingerprint) desde
 * localStorage, si existe. Permite anclar el gate anti-scraping al DISPOSITIVO
 * (Capa A) además de IP/usuario — caza al que rota IP o cuentas en la misma
 * máquina. Funciona también anónimo (el deviceId vive en localStorage sin login).
 * No pisa headers ya puestos por el caller.
 */
function withDeviceHeaders(init?: RequestInit): RequestInit {
  if (typeof window === 'undefined') return init ?? {}
  const headers = new Headers(init?.headers)
  try {
    const deviceId = window.localStorage.getItem('vence_device_id')
    if (deviceId && !headers.has('X-Device-Id')) headers.set('X-Device-Id', deviceId)
    const hwFp = window.localStorage.getItem('vence_hw_fingerprint')
    if (hwFp && !headers.has('X-Hw-Fingerprint')) headers.set('X-Hw-Fingerprint', hwFp)
  } catch {
    /* localStorage no disponible (modo privado, etc.) → seguir sin la huella */
  }
  return { ...init, headers }
}

/**
 * Igual que `fetch`, pero (1) adjunta la huella de dispositivo y (2) resuelve
 * automáticamente un reto humano si el servidor lo pide. Reintenta UNA vez con
 * el token. Si el segundo intento vuelve a pedir reto, devuelve esa respuesta
 * tal cual (el caller decide).
 */
export async function fetchWithChallenge(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  init = withDeviceHeaders(init)
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
