// lib/api/authHeaders.ts — Get Bearer token + device ID headers for client-side API calls
// Agnóstico de proveedor: usa el puerto `auth` (lib/auth) en vez de supabase.auth.* directo.
// El singleflight + cooldown anti-429 VIVEN aquí (no se mueven al port).
import { auth } from '@/lib/auth'

const DEVICE_ID_KEY = 'vence_device_id'

// Singleflight: una sola llamada a refreshSession() compartida por todos los callers.
// Evita que 10+ componentes llamen refreshSession() en paralelo y triggereen un 429.
let refreshPromise: Promise<string | undefined> | null = null
let lastRefreshTime = 0
const REFRESH_COOLDOWN_MS = 30_000 // No refrescar más de 1 vez cada 30s

async function getValidToken(): Promise<string | undefined> {
  const now = Date.now()

  // 1. Si hay un refresh en curso, esperar a que termine (singleflight)
  if (refreshPromise) {
    return refreshPromise
  }

  // 2. Si refrescamos hace menos de 30s, usar sesión cacheada directamente
  if (now - lastRefreshTime < REFRESH_COOLDOWN_MS) {
    const session = await auth.getSession()
    return session?.accessToken
  }

  // 3. Hacer refresh (una sola vez, compartida)
  refreshPromise = (async () => {
    try {
      const refreshed = await auth.refreshSession()
      if (refreshed?.accessToken) {
        lastRefreshTime = Date.now()
        return refreshed.accessToken
      }
    } catch {}
    // Fallback a sesión cacheada
    const session = await auth.getSession()
    return session?.accessToken
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
