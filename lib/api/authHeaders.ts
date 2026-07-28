// lib/api/authHeaders.ts — Cabeceras (Bearer + device) para las llamadas fetch del CLIENTE.
//
// Este módulo ENSAMBLA cabeceras. No decide cuándo hay que renovar un token: eso lo hace
// `auth.getAccessToken()` (puerto `lib/auth`), cuyo contrato es exactamente "token válido
// para Authorization: Bearer, con singleflight+cooldown" y cuya mecánica vive en el adapter
// de cada proveedor.
//
// ⚠️ Aquí VIVÍA una segunda implementación de esa decisión (singleflight + cooldown de 30 s
// sobre `refreshSession()`), y fue la causa de T-210 (28/07/2026):
//   · dentro de la ventana de 30 s devolvía la sesión cacheada SIN comprobar la expiración
//     → 401 silenciosos en notificaciones, medallas y guardado de respuestas;
//   · fuera de ella forzaba un `refreshSession()` cada 30 s aunque al token le quedaran
//     55 min → bajo Auth.js eso es re-acuñar el RS256: ~58.400 acuñaciones/día medidas
//     (`auth_token_minted`, muestreo 10%; p50 ≈ 60/usuario/día, máx ≈ 2.960), anulando la
//     caché de token que se montó el 15/07 para cortar ese mismo flood.
// El cooldown anti-429 no desapareció: se movió al `supabaseAdapter`, que es de quien era
// la mecánica. Guardarraíl: `__tests__/guardrails/bearerTokenSinglePath.test.ts`.
import { auth } from '@/lib/auth'

const DEVICE_ID_KEY = 'vence_device_id'

/**
 * Obtiene headers de autenticación para llamadas fetch a API routes.
 * El token lo sirve el puerto (cacheado y compartido); aquí solo se envuelve en
 * `Authorization` y se añaden las cabeceras de dispositivo (anti-fraude).
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}

  try {
    const accessToken = await auth.getAccessToken()
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
