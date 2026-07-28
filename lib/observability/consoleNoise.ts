// consoleNoise.ts — NÚCLEO PURO: ¿este mensaje de `console.error` es ruido o es daño?
//
// ## Por qué existe (T-210, 28/07/2026)
//
// El wrapper de `fetch` YA sabía que una petición que revienta mientras la página se
// descarga (`pageLeaving`) o está en background (`visibilityState === 'hidden'`) no es un
// fallo de red: es el navegador cancelando lo que había en vuelo. Por eso no emite
// `http_network_error` en ese caso (diagnóstico 08/07/2026).
//
// Pero el `catch` de la propia app escribe `console.error('Error cargando X:', err)`, y esa
// ruta pasaba por OTRO filtro que no miraba nada de eso. Resultado medido el 28/07: la misma
// petición abortada se suprimía como error de red y se registraba como `console_error` con
// severidad completa. Con 4.840 `console_error`/24 h —el 95% del ruido de error del sistema—
// y `Failed to fetch` como mensaje dominante, la señal de cliente era **inaccionable**: no se
// podía distinguir el usuario que pierde funcionalidad del que simplemente cambió de página.
//
// Aquí vive UNA sola definición de esa regla, compartida por las dos rutas de captura.
// No silencia nada: baja a `debug`, que sigue almacenado y consultable.

/** Ruido de terceros o esperado, en cualquier circunstancia. */
const RE_RUIDO_SIEMPRE = /\[GSI_LOGGER\]|FedCM|\b401\b|HTTP 401/i

/**
 * Mensajes de fallo de RED. Solo son ruido si la página se está yendo: si ocurren con la
 * pestaña visible, son un fallo real y deben contar como error.
 */
const RE_RED = /failed to fetch|networkerror|load failed|aborterror|operation was aborted|err_network|err_internet_disconnected/i

/**
 * @param msg     mensaje ya serializado que iba a registrarse
 * @param opts.leaving  la página se descarga (`beforeunload`/`pagehide`) o está en background
 */
export function esRuidoDeConsola(msg: string, opts: { leaving?: boolean } = {}): boolean {
  const t = String(msg || '')
  if (RE_RUIDO_SIEMPRE.test(t)) return true
  if (opts.leaving && RE_RED.test(t)) return true
  return false
}

export const _re = { RE_RUIDO_SIEMPRE, RE_RED }
