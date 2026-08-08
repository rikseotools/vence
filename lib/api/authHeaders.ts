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
import { obtenerBearerConReintento } from '@/lib/api/bearerConReintento'
import { emitClientEvent, hayUsuarioConocido } from '@/lib/observability/client'

const DEVICE_ID_KEY = 'vence_device_id'

/** Opciones de `getAuthHeaders`. Ver `exigeSesion`. */
export interface OpcionesCabeceras {
  /**
   * El llamante va a una ruta que EXIGE identidad (guarda de propiedad, [T-565]). Si aun así
   * no hay token, salir sin cabecera es un 401 garantizado y una pantalla en blanco: se emite
   * `auth_header_sin_token` para que quede visible.
   *
   * No se activa por defecto a propósito: `getAuthHeaders()` lo usan también rutas públicas,
   * donde no tener token es lo NORMAL y emitir ahí ahogaría la señal (misma lección que
   * `senal_error_sin_vigilancia`: un evento que grita en falso se acaba silenciando entero).
   */
  exigeSesion?: boolean
  /** Ruta destino, solo para poder agrupar la señal por endpoint. */
  endpoint?: string
}

/**
 * Obtiene headers de autenticación para llamadas fetch a API routes.
 * El token lo sirve el puerto (cacheado y compartido); aquí solo se envuelve en
 * `Authorization` y se añaden las cabeceras de dispositivo (anti-fraude).
 *
 * [T-692] Si el token no está a la primera se pide UNA vez más (`bearerConReintento`), porque
 * la alternativa medida era emitir una petición condenada al 401 y dejar la pantalla vacía sin
 * que nadie reintentara (0 de 29 recuperaciones en `user-stats`).
 */
export async function getAuthHeaders(
  opciones: OpcionesCabeceras = {},
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}

  let motivoSinToken: 'sin_token' | 'excepcion' | null = null
  try {
    // [T-692] Donde el token es OBLIGATORIO (ruta con guarda de propiedad) se pide una segunda
    // vez antes de rendirse: salir sin cabecera ahí es un 401 garantizado y una pantalla vacía
    // que nadie reintenta (medido: 0 de 29 recuperaciones en `/api/v2/user-stats`).
    //
    // En el resto se conserva EXACTAMENTE el camino de antes —un intento— porque en una página
    // pública no tener token es lo normal: reintentar ahí metería 200 ms a cada llamada anónima
    // sin arreglar nada, y ese efecto lateral haría inatribuible la mejora que se va a medir.
    const accessToken = opciones.exigeSesion
      ? (await obtenerBearerConReintento({ pedirToken: () => auth.getAccessToken() })).token
      : await auth.getAccessToken()
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
  //
  // [T-692] Aquí NO se añadió un segundo evento propio: `auth_header_sin_token` ya dice este
  // hecho y su filtro (`hayUsuarioConocido`) es más ancho que cualquier declaración por
  // call-site, porque cubre también a los que no declaran nada. Dos emisores de lo mismo no
  // miden el doble: divergen. Lo único que se le suma es el `endpoint`, para poder agrupar.
  if (motivoSinToken && typeof window !== 'undefined' && hayUsuarioConocido()) {
    emitClientEvent({
      severity: 'error',
      eventType: 'auth_header_sin_token',
      endpoint: opciones.endpoint,
      metadata: { motivo: motivoSinToken, exigeSesion: Boolean(opciones.exigeSesion) },
    })
  }

  if (typeof window !== 'undefined') {
    const deviceId = localStorage.getItem(DEVICE_ID_KEY)
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
