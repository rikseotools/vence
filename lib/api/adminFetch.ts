// lib/api/adminFetch.ts
// Wrapper de fetch para llamadas del panel admin a /api/admin/*.
// Inyecta SIEMPRE el Bearer token (getAuthHeaders) para que el middleware de
// /api/admin/* (ver middleware.ts + project-admin-endpoints-sin-auth) pueda
// autorizar. Úsalo en TODA llamada nueva del panel admin en vez de fetch crudo.
import { getAuthHeaders } from './authHeaders'

export async function adminFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const auth = await getAuthHeaders()
  return fetch(input, {
    ...init,
    // El token (auth) primero; los headers del caller (p.ej. Content-Type) después,
    // y ganan en conflicto salvo Authorization que normalmente solo aporta auth.
    headers: { ...auth, ...(init.headers as Record<string, string> | undefined) },
  })
}
