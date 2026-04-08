// lib/api/v2/complete-onboarding/client.ts
import { getSupabaseClient } from '@/lib/supabase'
import { completeOnboardingResponseSchema, type CompleteOnboardingRequest, type CompleteOnboardingResponse } from './schemas'

/**
 * Completa el onboarding en servidor: guarda todos los campos + marca completado en una sola llamada.
 * Timeout: 10s, sin retry (idempotente).
 */
export async function completeOnboardingOnServer(
  params: CompleteOnboardingRequest
): Promise<CompleteOnboardingResponse> {
  const supabase = getSupabaseClient()

  let accessToken: string | undefined
  try {
    const { data: refreshData } = await supabase.auth.refreshSession()
    accessToken = refreshData?.session?.access_token
  } catch {
    // fallback
  }
  if (!accessToken) {
    const { data: { session } } = await supabase.auth.getSession()
    accessToken = session?.access_token
  }
  if (!accessToken) {
    return { success: false, error: 'Sesión expirada' }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch('/api/v2/complete-onboarding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return { success: false, error: data.error || `HTTP ${response.status}` }
    }

    const data = await response.json()
    const parsed = completeOnboardingResponseSchema.safeParse(data)
    return parsed.success ? parsed.data : { success: !!data?.success }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { success: false, error: 'Timeout' }
    }
    return { success: false, error: (error as Error).message }
  }
}
