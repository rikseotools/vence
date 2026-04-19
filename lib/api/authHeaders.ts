// lib/api/authHeaders.ts — Get Bearer token + device ID headers for client-side API calls
import { getSupabaseClient } from '@/lib/supabase'

const DEVICE_ID_KEY = 'vence_device_id'

/**
 * Obtiene headers de autenticación para llamadas fetch a API routes.
 * Intenta refreshSession() primero para garantizar token válido,
 * con fallback a getSession() (cache) si el refresh falla.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}

  try {
    const supabase = getSupabaseClient()

    // 1. Intentar refresh para obtener token fresco
    let accessToken: string | undefined
    try {
      const { data: refreshData } = await supabase.auth.refreshSession()
      accessToken = refreshData?.session?.access_token
    } catch {}

    // 2. Fallback a sesión cacheada
    if (!accessToken) {
      const { data: { session } } = await supabase.auth.getSession()
      accessToken = session?.access_token
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }
  } catch {}

  if (typeof window !== 'undefined') {
    const deviceId = localStorage.getItem(DEVICE_ID_KEY)
    if (deviceId) headers['X-Device-Id'] = deviceId
    const hwFp = localStorage.getItem('vence_hw_fingerprint')
    if (hwFp) headers['X-Hw-Fingerprint'] = hwFp
  }

  return headers
}
