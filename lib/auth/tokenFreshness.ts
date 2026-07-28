// lib/auth/tokenFreshness.ts — Núcleo PURO: ¿sirve todavía este access token?
//
// Por qué existe (T-210, 28/07/2026). "¿Hay que ir a la red a por un token nuevo?" se
// respondía en DOS sitios con criterios distintos: el adapter de Auth.js lo decidía por
// EXPIRACIÓN (`mintFresh()`, margen de 5 min) y `lib/api/authHeaders.ts` lo decidía por
// RELOJ DE PARED (cooldown de 30 s) **sin mirar la expiración**. Las dos respuestas
// convivían, y la segunda es la que produce el daño medido:
//   · dentro de su ventana de 30 s devolvía la sesión cacheada aunque el token ya hubiera
//     caducado → 401 en notificaciones, medallas y el guardado de respuestas;
//   · fuera de ella FORZABA un refresh cada 30 s aunque el token durase 55 min más →
//     ~58.400 acuñaciones/día de un RS256 de 1 h (medido: `auth_token_minted`, muestreo
//     10%, p50 ≈ 60/usuario/día, máx ≈ 2.960), anulando la caché que se montó el 15/07
//     justo para cortar ese flood.
//
// Aquí vive la ÚNICA definición, la usan los dos adapters, y es pura (sin `Date.now()`
// dentro: el reloj entra como parámetro) para poder testearla sin mocks de tiempo.
//
// Asimetría DELIBERADA entre las dos preguntas — no es un descuido:
//   · frescura desconocida (el proveedor no expone `expiresAt`) → NO fresco: si podemos
//     refrescar, refrescamos (conservador, es el caso que provoca el 401);
//   · caducidad desconocida → NO caducado: un token sin fecha sigue siendo el mejor
//     esfuerzo disponible cuando no se puede refrescar, y tirarlo garantiza el 401 que
//     estamos intentando evitar.

/**
 * Margen antes de la expiración real en el que ya se considera que "toca renovar".
 * Con TTL de 1 h y 5 min de margen, un usuario activo acuña ~1 token/55 min en vez de
 * uno cada 30 s. Es el valor que ya usaba el adapter de Auth.js (`TOKEN_SKEW_SEC`);
 * se centraliza aquí para que no se bifurque.
 */
export const TOKEN_SKEW_SEC = 5 * 60

/** Normaliza el `expiresAt` del puerto (epoch en SEGUNDOS) a algo utilizable, o null. */
function toEpochSec(expiresAtSec: number | null | undefined): number | null {
  if (typeof expiresAtSec !== 'number' || !Number.isFinite(expiresAtSec) || expiresAtSec <= 0) {
    return null
  }
  return expiresAtSec
}

/**
 * ¿Se puede REUSAR este token sin ir a la red?
 *
 * `true` = queda margen de sobra (más que `skewSec`) → no hay que refrescar nada.
 * `false` = caducado, a punto de caducar, o expiración desconocida → refresca si puedes.
 *
 * @param expiresAtSec epoch en SEGUNDOS (contrato de `AuthSession.expiresAt`), o null.
 * @param nowMs        reloj en MILISEGUNDOS (`Date.now()`), inyectado por el caller.
 */
export function isBearerFresh(
  expiresAtSec: number | null | undefined,
  nowMs: number,
  skewSec: number = TOKEN_SKEW_SEC,
): boolean {
  const exp = toEpochSec(expiresAtSec)
  if (exp === null) return false
  return exp * 1000 - skewSec * 1000 > nowMs
}

/**
 * ¿Está el token REALMENTE caducado (el servidor lo va a rechazar seguro)?
 *
 * Distinto de `!isBearerFresh`: un token dentro del margen de renovación NO está
 * caducado, sigue siendo válido. Esta pregunta es la que decide si merece la pena
 * mandarlo como último recurso cuando no se puede refrescar (cooldown anti-429 activo).
 */
export function isBearerExpired(
  expiresAtSec: number | null | undefined,
  nowMs: number,
): boolean {
  const exp = toEpochSec(expiresAtSec)
  if (exp === null) return false // desconocido ≠ caducado (ver asimetría arriba)
  return exp * 1000 <= nowMs
}
