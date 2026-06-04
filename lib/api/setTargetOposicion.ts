// lib/api/setTargetOposicion.ts
// Fase 8 / arreglo chapuza: ÚNICO punto cliente para cambiar la oposición
// objetivo. Sustituye los `supabase.from('user_profiles').update(...)` directos
// (que escribían target_oposicion_data con JSON.stringify → JSONB doble-codificado).
//
// Llama al endpoint server PUT /api/profile/target, que deriva el shape canónico
// y escribe vía Drizzle privilegiado. El shape ya NO depende del cliente.
//
// Helper PURO: solo realiza la ESCRITURA (la parte que tenía el bug del
// JSON.stringify). NO dispara eventos ni toca estado — cada caller conserva su
// propia lógica de eventos (`oposicionAssigned`/`profileUpdated`), estado y
// navegación EXACTAMENTE como antes, para no cambiar su comportamiento.

import { getAuthHeaders } from '@/lib/api/authHeaders'

export interface SetTargetResult {
  ok: boolean
  data?: Record<string, unknown> | null
  error?: string
}

/**
 * Fija (o limpia, con null) la oposición objetivo del usuario autenticado.
 * @param oposicionId id de config (p.ej. 'guardia_civil') o null para limpiar.
 */
export async function setTargetOposicion(
  oposicionId: string | null,
): Promise<SetTargetResult> {
  try {
    const res = await fetch('/api/profile/target', {
      method: 'PUT',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ oposicionId }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json?.success) {
      return { ok: false, error: json?.error || `HTTP ${res.status}` }
    }
    return { ok: true, data: json.data ?? null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error de red' }
  }
}
