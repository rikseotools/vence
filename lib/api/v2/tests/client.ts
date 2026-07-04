// lib/api/v2/tests/client.ts
// Cliente: crea la sesión de test en el servidor (RDS/Drizzle, agnóstico).
// Sustituye a supabase.from('tests').insert(...) — cero SDK de Supabase.
import { auth } from '@/lib/auth'
import { createTestResponseSchema, type CreateTestRequest, type CreateTestResponse } from './schemas'

async function getToken(): Promise<string | undefined> {
  try {
    const refreshed = await auth.refreshSession()
    if (refreshed?.accessToken) return refreshed.accessToken
  } catch {
    /* fallback */
  }
  const session = await auth.getSession()
  return session?.accessToken
}

/**
 * Crea (o reutiliza) la sesión de test en el servidor. Devuelve la respuesta
 * validada; el id resultante es el que usa `enqueueAnswer` como `sessionId`.
 * No lanza: ante fallo devuelve `{ success:false, error }` para que el caller
 * degrade con gracia (igual que hacía el path Supabase al devolver null).
 */
export async function createTestSessionOnServer(
  params: CreateTestRequest,
): Promise<CreateTestResponse> {
  const accessToken = await getToken()
  if (!accessToken) return { success: false, error: 'SESSION_EXPIRED' }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch('/api/v2/tests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (res.status === 401) return { success: false, error: 'SESSION_EXPIRED' }
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` }
    const data = await res.json()
    const parsed = createTestResponseSchema.safeParse(data)
    return parsed.success ? parsed.data : { success: false, error: 'bad_response' }
  } catch (e) {
    clearTimeout(timeoutId)
    return { success: false, error: (e as Error).name === 'AbortError' ? 'timeout' : 'network' }
  }
}
