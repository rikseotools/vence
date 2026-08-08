// lib/auth/backoffAcunado.ts
//
// ¿Se puede volver a pedir un token, o toca callar? Núcleo puro, sin red ni estado global.
//
// ## El problema que resuelve ([T-671], 07/08/2026)
//
// El adapter aplica un backoff tras un 401 de `/api/auth/token` para que los clientes ANÓNIMOS
// no martilleen el endpoint. Correcto — pero el silencio se aplicaba **a todo el mundo por
// igual y durante 60 segundos**, y durante ese minuto `getAccessToken()` devuelve `undefined`
// **sin llegar a intentarlo**. En un cliente con la sesión abierta eso significa que TODA
// petición sale sin `Authorization` y vuelve con 401: las estadísticas a 0, los exámenes
// pendientes desaparecidos y la corrección del examen rechazada.
//
// Medido en el incidente: sobre el bundle que YA llevaba el arreglo de los llamantes
// (`a99c08fc`), seguía fallando el **48 %** de las lecturas en **28 usuarios**, y **18 de esos
// 28 no acuñaron un solo token** en toda la ventana — o sea, ni lo intentaron. Un minuto es
// eterno cuando la persona está corrigiendo un examen: pincha, no pasa nada, vuelve a pinchar.
// `rbsc87` pulsó «Corregir Examen» **ocho veces seguidas** antes de cerrar sesión.
//
// ## La regla
//
// El backoff largo existe por los anónimos, así que solo se les aplica a ellos:
//
//   · **sin sesión conocida** → 60 s. Es el caso para el que se puso y no se toca: un cliente
//     anónimo que reintenta cada segundo es exactamente lo que había que cortar.
//   · **con sesión conocida** → 2 s. Sigue habiendo suelo (un fallo del endpoint no puede
//     convertirse en un bucle cerrado), pero se recupera dentro de la misma interacción en vez
//     de a la siguiente carga de página.
//
// No es «quitar el freno»: es no frenar a quien no lo provocó. Y el suelo de 2 s se mantiene a
// propósito aunque haya sesión — sin él, un `/api/auth/token` caído convertiría cada render en
// una petición, que es el flood que este mecanismo evita.

/** Silencio para clientes sin sesión conocida. Es el valor histórico y no cambia. */
export const BACKOFF_ANONIMO_MS = 60_000
/**
 * Silencio para clientes CON sesión. Corto a propósito: tiene que caber dentro del tiempo que
 * una persona tarda en volver a pulsar el botón, o el freno vuelve a ser el fallo.
 */
export const BACKOFF_CON_SESION_MS = 2_000

/** Cuánto callar tras un 401 del endpoint de acuñado. */
export function backoffTrasUnauth(haySesionConocida: boolean): number {
  return haySesionConocida ? BACKOFF_CON_SESION_MS : BACKOFF_ANONIMO_MS
}

/**
 * ¿Toca intentar acuñar, o estamos dentro del silencio?
 *
 * @param hayCache        ¿Queda un token cacheado? (si lo hay, el silencio no aplica)
 * @param ahora           Reloj en ms.
 * @param silencioHasta   Epoch ms hasta el que se acordó callar (0 = no hay silencio).
 * @param haySesionConocida ¿La app cree que hay alguien dentro?
 */
export function puedeIntentarAcunar(args: {
  hayCache: boolean
  ahora: number
  silencioHasta: number
  haySesionConocida: boolean
}): boolean {
  const { hayCache, ahora, silencioHasta, haySesionConocida } = args
  // Con token en caché nunca se llega aquí por este camino, pero se deja explícito: el
  // silencio es sobre PEDIR uno nuevo, no sobre usar el que ya se tiene.
  if (hayCache) return true
  if (ahora >= silencioHasta) return true
  // Dentro del silencio: solo se respeta entero si el cliente es anónimo. Con sesión, el
  // silencio efectivo ya se acortó al fijarlo (`backoffTrasUnauth`), así que llegar aquí
  // con sesión y dentro de ventana significa que de verdad han pasado menos de 2 s.
  return false
}
