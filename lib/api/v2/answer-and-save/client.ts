// lib/api/v2/answer-and-save/client.ts
// Client-side: llamada unificada validar + guardar respuesta
import { getSupabaseClient } from '@/lib/supabase'
import { answerAndSaveResponseSchema, type AnswerAndSaveRequest, type AnswerAndSaveResponse } from './schemas'

/**
 * Valida una respuesta + guarda en BD + actualiza score en una sola llamada.
 *
 * Timeout: 10s, retries: 1 (total 2 intentos).
 * La respuesta se valida con Zod.
 *
 * @throws Error si la API falla después de todos los intentos
 */
export async function answerAndSave(
  params: AnswerAndSaveRequest
): Promise<AnswerAndSaveResponse> {
  const supabase = getSupabaseClient()

  // Obtener token de auth
  let accessToken: string | undefined
  try {
    const { data: refreshData } = await supabase.auth.refreshSession()
    accessToken = refreshData?.session?.access_token
  } catch {
    // fallback a getSession
  }
  if (!accessToken) {
    const { data: { session } } = await supabase.auth.getSession()
    accessToken = session?.access_token
  }
  if (!accessToken) {
    throw new Error('SESSION_EXPIRED')
  }

  // Device info
  const deviceInfo = typeof window !== 'undefined' ? {
    userAgent: navigator.userAgent || 'unknown',
    screenResolution: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    deviceType: (/Mobile|Android|iPhone/.test(navigator.userAgent) ? 'mobile' :
                /Tablet|iPad/.test(navigator.userAgent) ? 'tablet' : 'desktop') as 'mobile' | 'tablet' | 'desktop',
    browserLanguage: navigator.language || 'es',
    timezone: Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.timeZone || 'Europe/Madrid',
  } : undefined

  const body: AnswerAndSaveRequest = {
    ...params,
    deviceInfo: params.deviceInfo ?? deviceInfo,
  }

  // Fetch con timeout y retry manual (no usar apiFetch porque necesitamos Bearer header)
  const maxAttempts = 2
  const timeoutMs = 10000
  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch('/api/v2/answer-and-save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.status === 401) {
        throw new Error('SESSION_EXPIRED')
      }

      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`)
        if (response.status >= 500) continue // retry on 5xx
        throw lastError // 4xx = don't retry
      }

      const data = await response.json()
      const parsed = answerAndSaveResponseSchema.safeParse(data)
      if (!parsed.success) {
        throw new Error(`Invalid response: ${parsed.error.message}`)
      }

      return parsed.data
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof DOMException && error.name === 'AbortError') {
        lastError = new Error(`Timeout after ${timeoutMs}ms`)
        continue
      }

      if (error instanceof Error && error.message === 'SESSION_EXPIRED') {
        throw error
      }

      // Network error → retry
      if (error instanceof TypeError) {
        lastError = error
        continue
      }

      throw error
    }
  }

  throw lastError ?? new Error('All attempts failed')
}
