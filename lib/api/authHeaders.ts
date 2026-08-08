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
import { emitClientEvent } from '@/lib/observability/client'

const DEVICE_ID_KEY = 'vence_device_id'

/** Opciones de `getAuthHeaders`. Ver `exigeSesion`. */
export interface OpcionesCabeceras {
  /**
   * El llamante va a una ruta que EXIGE identidad (guarda de propiedad, [T-565]). Si aun así
   * no hay token, salir sin cabecera es un 401 garantizado y una pantalla en blanco: se emite
   * `bearer_ausente` para que quede visible.
   *
   * No se activa por defecto a propósito: `getAuthHeaders()` lo usan también rutas públicas,
   * donde no tener token es lo NORMAL y emitir ahí ahogaría la señal (misma lección que
   * `senal_error_sin_vigilancia`: un evento que grita en falso se acaba silenciando entero).
   */
  exigeSesion?: boolean
  /** Ruta destino, solo para poder agrupar la señal por endpoint. */
  endpoint?: string
}

/** El camino de siempre: un intento y lo que salga. Se conserva tal cual para las rutas que no
 *  exigen sesión — cambiarles el comportamiento sería un efecto lateral sin medición detrás. */
async function unSoloIntento(): Promise<string | null> {
  try {
    const t = await auth.getAccessToken()
    return typeof t === 'string' && t.trim() ? t : null
  } catch {
    return null
  }
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

  // El reintento se aplica SOLO donde el token es obligatorio. En una página pública no tenerlo
  // es lo normal, y reintentar ahí añadiría 200 ms a cada llamada anónima para no arreglar nada:
  // el comportamiento del resto de la app queda EXACTAMENTE como estaba, que es lo que permite
  // atribuir cualquier cambio en la medición a este arreglo y no a un efecto lateral.
  const r = opciones.exigeSesion
    ? await obtenerBearerConReintento({ pedirToken: () => auth.getAccessToken() })
    : { token: await unSoloIntento(), intentos: 1, loSalvoElReintento: false }
  if (r.token) {
    headers['Authorization'] = `Bearer ${r.token}`
  }

  // Se emite SOLO cuando el destino exige sesión: es ahí donde «sin token» significa que la
  // persona se queda sin ver sus datos. Fire-and-forget y nunca puede tumbar la petición.
  if (!r.token && opciones.exigeSesion && typeof window !== 'undefined') {
    try {
      emitClientEvent({
        severity: 'warn',
        eventType: 'bearer_ausente',
        endpoint: opciones.endpoint,
        errorMessage: 'petición a ruta con dueño sin Authorization tras dos intentos',
        metadata: { reintentado: true },
      })
    } catch {}
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
