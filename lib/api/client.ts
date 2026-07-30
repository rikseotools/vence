// lib/api/client.ts — Fetch wrapper centralizado con timeout, retry y Zod

// Interfaz structural que acepta tanto Zod v3 como v4 schemas
interface ZodLikeSchema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: { message: string } }
}

// ============================================
// ERRORES TIPADOS
// ============================================

export class ApiTimeoutError extends Error {
  name = 'ApiTimeoutError' as const
  constructor(url: string, timeoutMs: number) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`)
  }
}

export class ApiHttpError extends Error {
  name = 'ApiHttpError' as const
  status: number
  /**
   * Cuerpo de la respuesta de error, si venía en JSON. Sin esto, el caller pierde el
   * mensaje que el servidor quería dar al usuario (p.ej. un 400 de validación con
   * `{ error: 'La descripción es muy corta' }`) y solo puede enseñar un texto genérico.
   * Añadido 29/07/2026 al cablear `apiFetch` en el envío de impugnaciones.
   */
  body?: unknown
  constructor(url: string, status: number, body?: unknown) {
    super(`HTTP ${status} from ${url}`)
    this.status = status
    this.body = body
  }
}

export class ApiNetworkError extends Error {
  name = 'ApiNetworkError' as const
  constructor(url: string, cause?: unknown) {
    super(`Network error fetching ${url}: ${cause instanceof Error ? cause.message : String(cause)}`)
  }
}

export class ApiValidationError extends Error {
  name = 'ApiValidationError' as const
  constructor(url: string, zodError: string) {
    super(`Invalid response from ${url}: ${zodError}`)
  }
}

// ============================================
// OPCIONES
// ============================================

export interface ApiFetchOptions<T> {
  timeoutMs?: number         // default: 10000
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  retries?: number           // default: 2 (total attempts)
  retryDelayMs?: number      // default: 1000
  responseSchema?: ZodLikeSchema<T>  // validación Zod opcional (v3 o v4)
  headers?: Record<string, string>   // headers adicionales (e.g. Authorization)
}

// ============================================
// EL ERROR QUE ESTE TIPO IMPIDE (30/07/2026)
// ============================================
//
// La firma es `apiFetch(url, body, options)`. La página de precio de fidelidad llamaba así:
//
//     apiFetch('/api/v2/premium/mi-oferta', { method: 'GET', retries: 2, headers })
//
// Las opciones iban de CUERPO. `options` quedaba `undefined`, se aplicaban los valores por
// defecto… y el método por defecto es POST. Resultado: un endpoint GET recibiendo POST,
// 405, y la página diciendo «no tienes precio activo» a una usuaria que sí lo tenía. Tres
// días, cuatro intentos de pago abandonados y dos arreglos anteriores que no eran el fallo.
//
// Nada lo cazó: `body` era `unknown`, así que TypeScript lo aceptaba encantado; el
// guardarraíl buscaba el texto `method: 'GET'` en el fichero y ahí estaba, solo que en el
// argumento equivocado. Un test de TEXTO no distingue el sitio donde se escribe algo.
//
// Ahora un objeto formado SOLO por claves de opciones no es un cuerpo válido: la llamada
// mala deja de compilar. Es la única capa que actúa antes de desplegar.
// Se tipa SIN genérico a propósito. El primer intento fue `apiFetch<T, B>(url, body: B &
// CuerpoValido<B>, …)`, y no servía: en cuanto alguien escribe `apiFetch<Respuesta>(…)`
// —que es como se llama en todo el repo— TypeScript deja de inferir `B` y usa su valor por
// defecto, con lo que la comprobación se evaporaba justo en las llamadas reales.
//
// Con propiedades opcionales de tipo `never`, la prohibición no depende de la inferencia:
// un objeto que traiga `method` o `retries` no es asignable, se escriban o no los
// parámetros de tipo. La firma de índice es necesaria para que un cuerpo normal
// (`{ questionId: 'q1' }`) no choque contra la comprobación de propiedades sobrantes.
export type CuerpoValido =
  | ({ [clave: string]: unknown } & {
      method?: never
      retries?: never
      retryDelayMs?: never
      timeoutMs?: never
      responseSchema?: never
    })
  | unknown[]
  | string
  | number
  | boolean
  | null
  | undefined

/**
 * GET sin cuerpo. Existe para que la llamada más propensa al error (la que no tiene body
 * que pasar, y por eso invita a poner las opciones en su sitio) no pueda escribirse mal.
 */
export function apiGet<T>(url: string, options?: Omit<ApiFetchOptions<T>, 'method'>): Promise<T> {
  return apiFetch<T>(url, null, { ...options, method: 'GET' })
}

// ============================================
// IMPLEMENTACIÓN
// ============================================

function isRetryable(error: unknown): boolean {
  if (error instanceof ApiTimeoutError) return true
  if (error instanceof ApiNetworkError) return true
  if (error instanceof ApiHttpError) return error.status >= 500
  return false
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fetch wrapper centralizado para llamadas a APIs internas.
 *
 * - AbortController con timeout configurable (default 10s)
 * - Retry configurable (default 2 intentos, 1s delay)
 * - Parsing Zod opcional de la respuesta
 * - Errores tipados: ApiTimeoutError, ApiHttpError, ApiNetworkError
 *
 * NO reintenta en: HTTP 4xx, respuesta con `success: false`
 */
export async function apiFetch<T>(
  url: string,
  body: CuerpoValido,
  options?: ApiFetchOptions<T>
): Promise<T> {
  const {
    timeoutMs = 10000,
    retries = 2,
    method = 'POST',
    retryDelayMs = 1000,
    responseSchema,
    headers: extraHeaders,
  } = options ?? {}

  let lastError: unknown

  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      console.log(`🔄 [apiFetch] Retry ${attempt + 1}/${retries} for ${url}...`)
      await delay(retryDelayMs)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        // POST por defecto (el 90 % de la API v2), pero configurable: sin esto, un
        // endpoint GET recibía POST y devolvía 405 sin que el cliente lo notara. Le pasó a
        // una usuaria el 29/07: su página de precio se quedó vacía y acabó pagando la
        // tarifa pública, tres veces, porque el 405 no se veía por ningún lado.
        method,
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        // GET y HEAD no admiten cuerpo: `fetch` lanza TypeError si se le pone, y ese error
        // se vería como «error de red» (reintentado dos veces) en vez de como lo que es.
        ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // HTTP errors
      if (!response.ok) {
        // Se intenta leer el cuerpo para conservar el mensaje del servidor; si no es
        // JSON (HTML de un proxy, cuerpo vacío) se sigue sin él, nunca se rompe aquí.
        const errBody = await response.json().catch(() => undefined)
        const httpError = new ApiHttpError(url, response.status, errBody)
        // 4xx → don't retry, throw immediately
        if (response.status < 500) throw httpError
        // 5xx → retryable
        lastError = httpError
        continue
      }

      // Parse JSON
      const data = await response.json()

      // Validate with Zod if schema provided
      if (responseSchema) {
        const parsed = responseSchema.safeParse(data)
        if (!parsed.success) {
          throw new ApiValidationError(url, parsed.error.message)
        }
        return parsed.data
      }

      return data as T

    } catch (error) {
      clearTimeout(timeoutId)

      // Convert AbortError to ApiTimeoutError
      if (error instanceof DOMException && error.name === 'AbortError') {
        lastError = new ApiTimeoutError(url, timeoutMs)
        continue // retryable
      }

      // Already our typed errors
      if (error instanceof ApiHttpError || error instanceof ApiTimeoutError) {
        lastError = error
        if (isRetryable(error)) continue
        throw error
      }

      // Zod validation errors → don't retry
      if (error instanceof ApiValidationError) {
        throw error
      }

      // Network errors (TypeError: Failed to fetch, etc.)
      lastError = new ApiNetworkError(url, error)
      continue // retryable
    }
  }

  // All retries exhausted
  throw lastError
}
