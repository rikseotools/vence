// lib/api/v2/dispute/idempotency.ts
// Clave de idempotencia del email de respuesta a una impugnación.
// Módulo PURO (sin BD, sin red) para poder testearlo aislado.

import { createHash } from 'crypto'

/**
 * Clave de idempotencia para el email `impugnacion_respuesta`.
 *
 * Resend deduplica peticiones con la misma `Idempotency-Key` durante ~24h. La
 * clave tiene que cumplir DOS cosas a la vez:
 *
 *  1. **Reintentar el MISMO envío no duplica.** Si el envío se corta por un
 *     timeout y lo reintenta el reconciliador, la clave debe salir idéntica →
 *     Resend responde con el email original y el usuario recibe UNO solo.
 *  2. **Una respuesta DISTINTA sí se manda.** Si el cuerpo cambia (se corrige
 *     una respuesta equivocada, o se contesta a una alegación `appealed` de la
 *     misma impugnación), la clave debe cambiar → email nuevo.
 *
 * Con la clave vieja (`dispute-resolve-${disputeId}`, fija por impugnación)
 * solo se cumplía (1): Resend RECHAZABA el cuerpo corregido con *"idempotency
 * key has been used… but the request body was modified"* y devolvía
 * `emailSent:false`. La campana y el `admin_response` in-app sí se
 * actualizaban, así que el fallo era silencioso: el usuario se quedaba con el
 * email ERRÓNEO que ya había salido. Visto el 25/07/2026 (impugnación Sara
 * `6da2513e`).
 *
 * Por eso la clave lleva un sufijo derivado del contenido del email: la parte
 * que cambia entre revisiones es el veredicto (`status`) y el texto de la
 * respuesta. El resto (nombre, enunciado, URL) es estable por impugnación.
 *
 * Se hashea en vez de concatenar el texto porque `idempotencyKey` está
 * limitada a 256 caracteres y una respuesta de admin puede ser larga.
 *
 * @param disputeId  UUID de la impugnación (legislativa o psicotécnica)
 * @param status     Veredicto que se comunica (`resolved` | `rejected` | …)
 * @param adminResponse  Texto EXACTO que va en el email (ya normalizado/trim
 *                       por el caller, para que la clave siga al cuerpo real)
 */
export function buildDisputeEmailIdempotencyKey(
  disputeId: string,
  status: string,
  adminResponse: string,
): string {
  // Separador NUL: no puede aparecer en el texto, así que (status='a',
  // resp='bc') y (status='ab', resp='c') no colisionan.
  const revision = createHash('sha1')
    .update(`${status}\u0000${adminResponse}`)
    .digest('hex')
    .slice(0, 12)

  return `dispute-resolve-${disputeId}-${revision}`
}
