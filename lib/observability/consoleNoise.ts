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

/** Ruido de terceros, en cualquier circunstancia. */
const RE_RUIDO_SIEMPRE = /\[GSI_LOGGER\]|FedCM/i

/**
 * El 401 NO es ruido incondicional: solo lo es si la sesión se está yendo o cambiando de página.
 *
 * ## Por qué se saca de `RE_RUIDO_SIEMPRE` (28/07/2026, T-210)
 *
 * Estaba junto a GSI/FedCM, así que TODO 401 quedaba archivado en `debug` pasara lo que pasara.
 * Medido ese día: **382 de 383** eventos 401 de 24 h estaban enterrados, y dentro había esto:
 *
 *   · `disputes/notifications 401` — 202 eventos, 21 usuarios
 *   · `Error cargando perfil: {"status":401}` — 65 eventos, **21 usuarios**
 *
 * Un 401 al cargar el PERFIL, con la pestaña visible y sin haber navegado, no es ruido: es un
 * usuario que ha perdido funcionalidad sin enterarse. Es el mismo síntoma de [T-245] —sesión con
 * `sub` sin perfil— donde alguien intentó pagar 24 veces y quejarse 6, y no pudo hacer ninguna de
 * las dos. Una regla que entierra eso convierte la observabilidad en decorado.
 *
 * Un 401 mientras te vas o mientras navegas SÍ es esperable (la sesión se cierra, el token se
 * renueva), así que se trata igual que un fallo de red: condicionado, no silenciado.
 */
const RE_SESION = /\b401\b|HTTP 401/i

/**
 * Mensajes de fallo de RED. Solo son ruido si la página se está yendo: si ocurren con la
 * pestaña visible, son un fallo real y deben contar como error.
 */
const RE_RED = /failed to fetch|networkerror|load failed|aborterror|operation was aborted|err_network|err_internet_disconnected/i

/**
 * Ventana tras un cambio de ruta durante la cual un fallo de red se considera ruido.
 *
 * ## Por qué hace falta además de `leaving` (28/07/2026, T-210)
 *
 * `leaving` solo se enciende con `beforeunload`/`pagehide` o con la pestaña oculta, y **ninguno
 * de los tres ocurre en una navegación de Next**: cambiar de ruta con `router.push`/`replace` no
 * descarga la página ni la esconde. Así que las peticiones de montaje que quedan en vuelo cuando
 * el usuario cambia de pantalla mueren igual, pero se registraban como error COMPLETO.
 *
 * Medido ese día sobre 24 h: la URL que encabezaba el ranking era **`/auth/callback`** (165
 * eventos, 35 usuarios), que **redirige sola en cuanto tiene sesión** — el caso puro. Y el 45% de
 * las ráfagas traía 3+ endpoints muriendo en el MISMO segundo, con pico en 6, 7 y 8: el lote
 * entero de peticiones de montaje cayendo junto, que es la firma de un cambio de pantalla y no la
 * de una red que falla.
 *
 * Dos segundos es holgado para lo que tarda un fetch en abortar y corto para no tragarse un fallo
 * real: si a los dos segundos de navegar la red sigue rota, eso SÍ es daño y debe contar.
 */
export const VENTANA_NAVEGACION_MS = 2000

/**
 * @param msg     mensaje ya serializado que iba a registrarse
 * @param opts.leaving  la página se descarga (`beforeunload`/`pagehide`) o está en background
 * @param opts.msDesdeNavegacion  milisegundos desde el último cambio de ruta (undefined = ninguno)
 */
export function esRuidoDeConsola(
  msg: string,
  opts: { leaving?: boolean; msDesdeNavegacion?: number } = {},
): boolean {
  const t = String(msg || '')
  if (RE_RUIDO_SIEMPRE.test(t)) return true
  const navegando =
    typeof opts.msDesdeNavegacion === 'number' &&
    opts.msDesdeNavegacion >= 0 &&
    opts.msDesdeNavegacion < VENTANA_NAVEGACION_MS
  if ((opts.leaving || navegando) && (RE_RED.test(t) || RE_SESION.test(t))) return true
  return false
}

export const _re = { RE_RUIDO_SIEMPRE, RE_RED, RE_SESION }
