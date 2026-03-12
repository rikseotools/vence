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
  constructor(url: string, status: number) {
    super(`HTTP ${status} from ${url}`)
    this.status = status
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
  retries?: number           // default: 2 (total attempts)
  retryDelayMs?: number      // default: 1000
  responseSchema?: ZodLikeSchema<T>  // validación Zod opcional (v3 o v4)
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
  body: unknown,
  options?: ApiFetchOptions<T>
): Promise<T> {
  const {
    timeoutMs = 10000,
    retries = 2,
    retryDelayMs = 1000,
    responseSchema
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // HTTP errors
      if (!response.ok) {
        const httpError = new ApiHttpError(url, response.status)
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
