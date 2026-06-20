// lib/api/adminFetch.ts
// Wrapper de fetch para llamadas del panel admin a /api/admin/*.
// Inyecta SIEMPRE el Bearer token (getAuthHeaders) para que el guard de
// /api/admin/* (guardAdminApi en proxy.ts — Next 16 usa proxy, NO middleware;
// ver project-admin-endpoints-sin-auth) pueda autorizar. El guard solo acepta
// Bearer admin o x-cron-secret: un fetch crudo a /api/admin/* devuelve 401.
// Úsalo en TODA llamada del panel admin en vez de fetch crudo.
import { getAuthHeaders } from './authHeaders'
import { emitClientEvent } from '@/lib/observability/client'

function endpointOf(input: RequestInfo | URL): string {
  try {
    if (typeof input === 'string') return input
    if (input instanceof URL) return input.pathname + input.search
    return String((input as Request).url || input)
  } catch { return 'unknown' }
}

export async function adminFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const auth = await getAuthHeaders()
  const res = await fetch(input, {
    ...init,
    // El token (auth) primero; los headers del caller (p.ej. Content-Type) después,
    // y ganan en conflicto salvo Authorization que normalmente solo aporta auth.
    headers: { ...auth, ...(init.headers as Record<string, string> | undefined) },
  })

  // OBSERVABILIDAD (cierra el punto ciego del incidente 20/06): un 401/403 admin
  // era SILENCIOSO (el caller lo tragaba, badge a 0). Emitimos un evento para que
  // quede en observable_events. `hadAuthHeader` distingue la causa raíz: sin token
  // (getAuthHeaders no entregó) vs token rechazado (no-admin/expirado).
  if (res.status === 401 || res.status === 403) {
    try {
      emitClientEvent({
        severity: 'warn',
        eventType: 'custom',
        endpoint: endpointOf(input),
        errorMessage: `admin_api_unauthorized: HTTP ${res.status}`,
        metadata: { kind: 'admin_api_unauthorized', status: res.status, hadAuthHeader: !!auth['Authorization'] },
      })
    } catch { /* nunca romper la llamada por la telemetría */ }
  }
  return res
}
