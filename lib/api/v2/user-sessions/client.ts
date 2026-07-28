// lib/api/v2/user-sessions/client.ts
// Cliente: crea la fila user_sessions en el servidor (RDS/Drizzle). Cero SDK Supabase.
import { auth } from '@/lib/auth'
import { createUserSessionResponseSchema, type CreateUserSessionRequest, type CreateUserSessionResponse } from './schemas'

export async function createUserSessionOnServer(
  params: CreateUserSessionRequest,
): Promise<CreateUserSessionResponse> {
  // Token por el verbo del puerto (cacheado y compartido; ver T-210).
  const accessToken = await auth.getAccessToken()
  if (!accessToken) return { success: false, error: 'SESSION_EXPIRED' }
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch('/api/v2/user-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(params),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` }
    const data = await res.json()
    const parsed = createUserSessionResponseSchema.safeParse(data)
    return parsed.success ? parsed.data : { success: false, error: 'bad_response' }
  } catch (e) {
    clearTimeout(timeoutId)
    return { success: false, error: (e as Error).name === 'AbortError' ? 'timeout' : 'network' }
  }
}
