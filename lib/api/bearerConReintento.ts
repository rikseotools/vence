// lib/api/bearerConReintento.ts — el núcleo PURO de «no salgas sin token si hay sesión». (T-692)
//
// ── Qué problema resuelve ───────────────────────────────────────────────────
// `getAuthHeaders()` pedía el token UNA vez y, si no lo tenía, devolvía `{}` **y la petición
// salía igual**. El navegador adjunta la cookie de sesión por su cuenta, así que desde el
// servidor eso no parece un anónimo: parece una sesión presentando credenciales malas, y se
// contabiliza como rechazo legítimo. La persona ve la pantalla vacía y nadie reintenta.
//
// Medido en producción el 08/08/2026, y por eso el arreglo va aquí y no en los componentes:
//   · `/api/exam/pending` llevaba NUEVE DÍAS a 0,0 % de 401 (≈1.100 llamadas/día) y saltó al
//     44,2 % con 18 usuarios en un día, al exigirle identidad [T-565].
//   · `/api/v2/user-stats` arrastra un 20-36 % DIARIO desde antes del incidente: el mismo
//     defecto, sin que nadie lo hubiera mirado.
//   · El 63 % de los fallos (55 de 87) cae en los 10 primeros segundos de la sesión, mediana 0 s.
//   · NO se recupera solo: 7 de 58 en `exam/pending`, **0 de 29** en `user-stats`.
// Comprobado contra producción con un Bearer válido recién acuñado: los dos endpoints
// devuelven **200 con token** y **401 `reason:"no_bearer_token"` sin él**. El servidor está
// bien; lo que falla es que la petición sale sin la cabecera.
//
// ── Por qué UN solo reintento y no un bucle ─────────────────────────────────
// [T-419] es exactamente el daño de reintentar contra un 401 sin arreglar la causa (un sondeo
// martilleando durante horas), y [T-210] es el daño de re-acuñar de más (~58.400 acuñaciones
// diarias de un token que dura 1 h). Así que: **un intento más y se rinde**. Para un anónimo
// de verdad el segundo intento no cuesta red — el adapter aplica su backoff de 60 s y contesta
// «no autenticado» sin salir a por nada.
//
// Este módulo es PURO a propósito (recibe el «pedir token» y el «esperar»): así se puede probar
// el comportamiento sin navegador, sin red y sin relojes reales.

export interface OpcionesBearer {
  /** Cómo se pide el token. En producción, `auth.getAccessToken` del puerto `lib/auth`. */
  pedirToken: () => Promise<string | undefined | null>
  /** Espera entre intentos. Inyectable para que los tests no duerman de verdad. */
  esperar?: (ms: number) => Promise<void>
  /** Milisegundos entre el primer intento y el segundo. */
  esperaMs?: number
}

export interface ResultadoBearer {
  /** El token, si se consiguió en alguno de los dos intentos. */
  token: string | null
  /** Cuántos intentos hicieron falta (0 = no se consiguió). */
  intentos: number
  /** true si el primer intento falló y el segundo lo salvó — la señal de que el reintento sirve. */
  loSalvoElReintento: boolean
}

/** 200 ms: suficiente para que cuaje una sesión que estaba a medias, y por debajo de lo que
 *  una persona percibe como espera. No se toca sin volver a medir. */
export const ESPERA_ENTRE_INTENTOS_MS = 200

const esperaPorDefecto = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Un token vacío o de solo espacios NO es un token: dejarlo pasar produce `Bearer ` a secas,
 *  que el servidor rechaza igual pero contando como credencial presentada. */
function esUtil(t: string | undefined | null): t is string {
  return typeof t === 'string' && t.trim().length > 0
}

/**
 * Pide el token y, si no lo hay, lo vuelve a pedir UNA vez tras una espera corta.
 * Nunca lanza: un fallo al pedir el token se trata como «no hay token», que es lo que el
 * llamante tiene que saber. Lo que NO hace es callárselo — ver `getAuthHeaders`.
 */
export async function obtenerBearerConReintento(
  opciones: OpcionesBearer,
): Promise<ResultadoBearer> {
  const { pedirToken, esperar = esperaPorDefecto, esperaMs = ESPERA_ENTRE_INTENTOS_MS } = opciones

  const intentar = async (): Promise<string | null> => {
    try {
      const t = await pedirToken()
      return esUtil(t) ? t : null
    } catch {
      // Un error al pedirlo (red, adapter a medias) es indistinguible de «no hay» para quien
      // llama: en los dos casos la petición saldría sin cabecera.
      return null
    }
  }

  const primero = await intentar()
  if (primero) return { token: primero, intentos: 1, loSalvoElReintento: false }

  await esperar(esperaMs)

  const segundo = await intentar()
  if (segundo) return { token: segundo, intentos: 2, loSalvoElReintento: true }

  return { token: null, intentos: 0, loSalvoElReintento: false }
}
