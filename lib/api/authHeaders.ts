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
import { getFingerprintHeader } from '@/lib/security/fingerprint'
import { emitClientEvent, hayUsuarioConocido } from '@/lib/observability/client'
import { safeGet } from '@/lib/storage/safeLocalStorage'

const DEVICE_ID_KEY = 'vence_device_id'

/**
 * Obtiene headers de autenticación para llamadas fetch a API routes.
 * El token lo sirve el puerto (cacheado y compartido); aquí solo se envuelve en
 * `Authorization` y se añaden las cabeceras de dispositivo (anti-fraude).
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}

  let motivoSinToken: 'sin_token' | 'excepcion' | null = null
  try {
    const accessToken = await auth.getAccessToken()
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    } else {
      motivoSinToken = 'sin_token'
    }
  } catch {
    motivoSinToken = 'excepcion'
  }

  // [T-671] EL SILENCIO ERA EL BUG. Estas dos ramas se tragaban el fallo y devolvían las
  // cabeceras SIN Bearer; el servidor contestaba 401 y en el cliente no quedaba ni una línea
  // que dijera por qué. El 07/08/2026 eso dejó a 248 usuarios con las estadísticas a 0 y sin
  // poder corregir sus exámenes, y reconstruir la causa costó dos sesiones cruzando el
  // `deploy_version` de los 401 con el commit que los arreglaba a medias.
  //
  // Sigue devolviendo cabeceras sin Bearer a propósito: hay llamadas legítimas de usuario
  // anónimo, y romper aquí les rompería a ellos. Lo que cambia es que ahora se VE. Se filtra
  // por `estaAutenticado()` para no medir a los anónimos, que son el caso normal y ahogarían
  // la señal.
  if (motivoSinToken && typeof window !== 'undefined' && hayUsuarioConocido()) {
    emitClientEvent({
      severity: 'error',
      eventType: 'auth_header_sin_token',
      metadata: { motivo: motivoSinToken },
    })
  }

  if (typeof window !== 'undefined') {
    const deviceId = safeGet(DEVICE_ID_KEY)
    if (deviceId) headers['X-Device-Id'] = deviceId
    // Huella de hardware: v2 en cuanto esté calculada, v1 mientras tanto (una sola función
    // decide, ver `lib/security/fingerprint`). El `device_id` de arriba NO sirve como ancla de
    // cupo — se borra en dos clics y por eso el límite por dispositivo llevaba desde abril sin
    // cortar una sola vez.
    const hwFp = getFingerprintHeader()
    if (hwFp) headers['X-Hw-Fingerprint'] = hwFp
  }

  return headers
}
