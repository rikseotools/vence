// lib/api/authHeaders.ts — Get Bearer token + device ID headers for client-side API calls
import { getSupabaseClient } from '@/lib/supabase'

const DEVICE_ID_KEY = 'vence_device_id'

// Singleflight: una sola llamada a refreshSession() compartida por todos los callers.
// Evita que 10+ componentes llamen refreshSession() en paralelo y triggereen un 429.
let refreshPromise: Promise<string | undefined> | null = null
let lastRefreshTime = 0
const REFRESH_COOLDOWN_MS = 30_000 // No refrescar más de 1 vez cada 30s

async function getValidToken(): Promise<string | undefined> {
  const supabase = getSupabaseClient()
  const now = Date.now()

  // 1. Si hay un refresh en curso, esperar a que termine (singleflight)
  if (refreshPromise) {
    return refreshPromise
  }

  // 2. Si refrescamos hace menos de 30s, usar sesión cacheada directamente
  if (now - lastRefreshTime < REFRESH_COOLDOWN_MS) {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  // 3. Hacer refresh (una sola vez, compartida)
  refreshPromise = (async () => {
    try {
      const { data: refreshData } = await supabase.auth.refreshSession()
      if (refreshData?.session?.access_token) {
        lastRefreshTime = Date.now()
        return refreshData.session.access_token
      }
    } catch {}
    // Fallback a sesión cacheada
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  })()

  try {
    return await refreshPromise
  } finally {
    refreshPromise = null
  }
}

/**
 * Obtiene headers de autenticación para llamadas fetch a API routes.
 * Usa singleflight + cooldown para evitar múltiples refreshSession() simultáneos.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}

  try {
    const accessToken = await getValidToken()
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
