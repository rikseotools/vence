// lib/api/v2/complete-test/client.ts
// Client-side: llamada para completar test en servidor
import { getSupabaseClient } from '@/lib/supabase'
import { completeTestResponseSchema, type CompleteTestRequest, type CompleteTestResponse } from './schemas'

/**
 * Completa un test en servidor: analytics + update BD + user_progress.
 *
 * Timeout: 15s (el servidor puede tardar en calcular analytics + múltiples updates).
 * Sin retry: completar test es idempotente, si falla el usuario ve el resultado igualmente.
 *
 * @throws Error si la API falla
 */
export async function completeTestOnServer(
  params: CompleteTestRequest
): Promise<CompleteTestResponse> {
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

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch('/api/v2/complete-test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.status === 401) {
      throw new Error('SESSION_EXPIRED')
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    const parsed = completeTestResponseSchema.safeParse(data)
    if (!parsed.success) {
      console.warn('⚠️ [complete-test client] Respuesta inesperada, usando fallback:', data)
      return { success: !!data?.success, status: data?.status || 'error' }
    }

    return parsed.data
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Timeout after 15000ms')
    }

    throw error
  }
}
