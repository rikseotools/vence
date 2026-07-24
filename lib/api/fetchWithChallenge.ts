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
import { emitClientEvent } from '@/lib/observability/client'

/** Path para etiquetar el evento de observabilidad, sin query ni PII. */
function pathOfInput(input: RequestInfo | URL): string {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    return new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'http://x').pathname
  } catch {
    return 'unknown'
  }
}

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

// Reintento acotado ante fallo de RED. `fetch` lanza `TypeError` ("Failed to
// fetch") cuando la petición NO llega a completarse: wifi/datos móviles
// inestables, un blip de conexión, el navegador cancelando por cambio de red.
// Sin esto, un corte momentáneo en la ruta crítica (generar un test) se
// convierte en un dead-end ("Error al generar test") aunque el contenido esté
// perfecto — el caso que reportó un usuario con la Ley 7/1985 (24/07/2026):
// 4 `Failed to fetch` en llamadas sin relación entre sí = su red, no un bug
// nuestro, pero el usuario no lo distingue.
//
// SEGURO por reintentar: TODOS los callers de `fetchWithChallenge` son LECTURAS
// idempotentes (`/api/questions/filtered`) → no hay mutación que se pueda
// duplicar. NO reintenta `AbortError` (navegación/cancelación del usuario):
// `fetch` lo lanza como DOMException, no TypeError, así que `instanceof
// TypeError` ya lo excluye. Un blip transitorio se reintenta solo (el usuario
// ni se entera y, de paso, deja de generar ruido de `console_error`); solo si
// sigue cayendo tras los reintentos, el error propaga y el caller decide.
export const NETWORK_RETRIES = 2          // intentos extra tras el primero (3 en total)
export const NETWORK_RETRY_BASE_MS = 400  // backoff lineal: 400ms, 800ms

function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** `fetch` con reintento acotado SOLO ante error de red (ver nota arriba). */
async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= NETWORK_RETRIES; attempt++) {
    try {
      const res = await fetch(input, init)
      // Observabilidad: solo si HUBO al menos un reintento que se recuperó (blip
      // salvado). El caso feliz sin blips (attempt===0) no emite → cero ruido.
      if (attempt > 0) {
        emitClientEvent({
          severity: 'debug',
          eventType: 'network_retry',
          endpoint: pathOfInput(input),
          metadata: { outcome: 'recovered', attempts: attempt + 1 },
        })
      }
      return res
    } catch (err) {
      lastErr = err
      // No reintentar si no es error de red (p.ej. AbortError) o si ya agotamos.
      if (!isNetworkError(err) || attempt === NETWORK_RETRIES) break
      await wait(NETWORK_RETRY_BASE_MS * (attempt + 1))
    }
  }
  // Agotados los reintentos ante error de RED (offline sostenido): dejar traza
  // para medir cuánto es red del usuario irrecuperable vs blips que sí salvamos.
  if (isNetworkError(lastErr)) {
    emitClientEvent({
      severity: 'warn',
      eventType: 'network_retry',
      endpoint: pathOfInput(input),
      metadata: { outcome: 'exhausted', attempts: NETWORK_RETRIES + 1 },
    })
  }
  throw lastErr
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
  const first = await resilientFetch(input, init)

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
  return resilientFetch(input, { ...init, headers })
}
