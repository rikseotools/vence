/**
 * ¿Se puede volver a escribir a alguien cuya impugnación YA está cerrada? [T-394]
 *
 * ## El problema que resuelve
 *
 * `resolveDispute` tiene una guarda de idempotencia que impide re-resolver: existe para no cerrar
 * dos veces por error, no duplicar el email y **no pagar dos veces el euro**. Todo eso es correcto
 * y no cambia.
 *
 * Pero doce líneas más abajo, la clave de idempotencia del email está construida **a propósito**
 * para permitir corregirse — su propio comentario dice que si la respuesta CAMBIA («corrección de
 * una respuesta errónea, o contestación a una alegación `appealed`») la clave cambia y el email
 * nuevo SÍ sale. Es decir: **el sistema declaraba saber corregirse y no dejaba hacerlo**, y en la
 * práctica ganaba el único camino que existía: no hacer nada.
 *
 * ## El caso que lo obliga
 *
 * `6c8a13af` (María José, premium, 31/07/2026). Impugnó que en Windows el atajo de «seleccionar
 * todo» es `Ctrl+E` y no `Ctrl+A`. Se cerró como `rejected` explicándole que en el Explorador es
 * `Ctrl+A`: **correcto para Windows 11 e incompleto**, porque el atajo cambió de versión y en
 * Windows 10 es `Ctrl+E`, que es lo que ella decía. La explicación de la pregunta se corrigió ese
 * mismo día; lo único que no se pudo hacer fue **decírselo**. Volvió a escribir al día siguiente
 * porque nadie pudo contarle lo que ya sabíamos.
 *
 * ## La forma de la puerta
 *
 * Estrecha y explícita, no un `force`: hay que declarar QUÉ se corrige. Y corregir **no es volver a
 * decidir**, así que el camino de corrección no toca el estado, no evalúa recompensa y no pasa por
 * la puerta de barajado (que vigila cierres, y aquí no se cierra nada). Solo reenvía y deja traza.
 */

export type EstadoImpugnacion = 'pending' | 'appealed' | 'resolved' | 'rejected' | null

export type VeredictoReResolucion =
  | { permitir: true; esCorreccion: false }
  | { permitir: true; esCorreccion: true; motivo: string }
  | { permitir: false; error: string }

/**
 * @param currentStatus estado actual en BD
 * @param correccion    motivo declarado (`correccionDeRespuesta`), ya recortado; `null` si no viene
 */
export function decidirReResolucion(
  currentStatus: EstadoImpugnacion,
  correccion: string | null,
): VeredictoReResolucion {
  const cerrada = currentStatus === 'resolved' || currentStatus === 'rejected'

  if (!cerrada) {
    // Camino normal. Una corrección sobre algo aún abierto no tiene sentido: si sigue abierta, se
    // responde y se cierra por la vía de siempre. Se ignora en vez de fallar, para no convertir un
    // parámetro de más en un error que bloquee una resolución legítima.
    return { permitir: true, esCorreccion: false }
  }

  if (!correccion) {
    return {
      permitir: false,
      error:
        `La impugnacion ya estaba ${currentStatus} y no se puede re-resolver` +
        ' (si vienes a CORREGIR una respuesta equivocada, usa `correccionDeRespuesta`)',
    }
  }

  return { permitir: true, esCorreccion: true, motivo: correccion }
}
