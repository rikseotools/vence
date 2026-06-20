// lib/api/adminFetch.ts
// Wrapper de fetch para llamadas del panel admin a /api/admin/*.
// Inyecta SIEMPRE el Bearer token (getAuthHeaders) para que el guard de
// /api/admin/* (guardAdminApi en proxy.ts — Next 16 usa proxy, NO middleware;
// ver project-admin-endpoints-sin-auth) pueda autorizar. El guard solo acepta
// Bearer admin o x-cron-secret: un fetch crudo a /api/admin/* devuelve 401.
// Úsalo en TODA llamada del panel admin en vez de fetch crudo.
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
