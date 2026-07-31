// lib/security/deviceIdentity.ts
//
// De qué ancla depende que un usuario sea VISIBLE para el antifraude. Núcleo puro: sin red,
// sin BD y sin `window`, para poder fijar la decisión en tests.
//
// ── POR QUÉ EXISTE ([T-371], 31/07/2026) ────────────────────────────────────────────────────
//
// `registerAndCheckDevice` abría con `if (!userId || !deviceId) return FAIL_OPEN`. Suena
// prudente —no bloquear a quien no se ha podido identificar— y tiene un efecto que no se ve:
// **tampoco registra**. El usuario nunca entra en `user_devices`, así que el sweep de
// multicuenta, el límite de dispositivos y la comprobación anti-autoreferido de los referidos
// no tienen NADA que mirar. Y como no hay fila, tampoco hay señal de que falte: el agujero se
// realimenta en silencio.
//
// Lo grave es la segunda consecuencia. La **huella de hardware** (`hw_fingerprint`) es la que
// sobrevive a borrar el navegador y era el arreglo previsto en [T-304] para el `device_id` de
// `localStorage`, que se rota en dos clics. Pero se pasa como argumento a esa misma función, o
// sea que **queda detrás del mismo `return`**: la protección buena estaba condicionada a que
// existiera la frágil. Medido el 31/07: 405 usuarios con actividad real y CERO huella, y el 52%
// de las cuentas free fuera, que es justo donde vive el farmeo del límite gratuito.
//
// Aquí se separan las dos preguntas, que NO son la misma:
//   · ¿con qué ancla lo registro?   → `resolverAnclaDispositivo`
//   · ¿le aplico el límite?          → eso lo decide quien llama, y con el ancla derivada NO
//                                      se aplica (ver `aplicaLimite`).
//
// Esa separación es deliberada: ganar visibilidad no puede costar bloqueos. Un ancla derivada
// de la huella agrupa cuentas que antes no se agrupaban, y ese es justo el riesgo que el modo
// `shadow` de [T-304] existe para medir antes de cortar.

/** Prefijo del ancla derivada. Reconocible a simple vista en la BD y en los paneles. */
export const PREFIJO_ANCLA_HUELLA = 'hw:'

export type OrigenAncla = 'navegador' | 'huella' | 'ninguno'

export interface AnclaDispositivo {
  /** El `device_id` con el que registrar. `null` si no hay con qué identificar. */
  deviceId: string | null
  origen: OrigenAncla
  /**
   * Si el límite de dispositivos puede aplicarse con esta ancla. Falso para la derivada: sirve
   * para VER, no para cortar.
   */
  aplicaLimite: boolean
}

const SIN_ANCLA: AnclaDispositivo = { deviceId: null, origen: 'ninguno', aplicaLimite: false }

/** Descarta vacíos y espacios. Un `''` que llega por cabecera no es un identificador. */
function limpio(v: string | null | undefined): string | null {
  const s = String(v ?? '').trim()
  return s.length > 0 ? s : null
}

/**
 * Decide con qué ancla registrar el dispositivo.
 *
 * Preferencia por el `device_id` del navegador cuando existe: es el que llevan los datos
 * históricos y con el que el límite ya está calibrado. Si no llega —el caso de [T-371]— se cae
 * a la huella de hardware, que es peor ancla para cortar pero infinitamente mejor que ninguna
 * para observar.
 */
export function resolverAnclaDispositivo(
  deviceId: string | null | undefined,
  hwFingerprint: string | null | undefined,
): AnclaDispositivo {
  const propio = limpio(deviceId)
  if (propio) return { deviceId: propio, origen: 'navegador', aplicaLimite: true }

  const huella = limpio(hwFingerprint)
  if (huella) {
    // Ya viene derivada de otra llamada: no volver a prefijar (`hw:hw:…` sería un tercer
    // dispositivo fantasma para la misma persona).
    const base = huella.startsWith(PREFIJO_ANCLA_HUELLA) ? huella.slice(PREFIJO_ANCLA_HUELLA.length) : huella
    return { deviceId: `${PREFIJO_ANCLA_HUELLA}${base}`, origen: 'huella', aplicaLimite: false }
  }

  return SIN_ANCLA
}

/** ¿Esta fila de `user_devices` se registró por huella, a falta de identificador de navegador? */
export function esAnclaDerivada(deviceId: string | null | undefined): boolean {
  return String(deviceId ?? '').startsWith(PREFIJO_ANCLA_HUELLA)
}
