// lib/stripe/cancelCheckoutAbierto.ts
//
// ¿Por qué Stripe se niega a cancelar una suscripción, y podemos desatascarlo solos?
//
// Caso que lo motiva (T-601, 05/08/2026). `cnicolau2024@gmail.com` lleva desde el 18 de julio
// intentando comprar: **6 suscripciones `incomplete` y 11 checkouts `unpaid`**, ni un cobro. Al
// intentar cancelar para limpiar, Stripe responde
//
//     «You cannot cancel a subscription with an active checkout session.
//      Expire the checkout session instead.»
//
// …y `cancelSubscription` devolvía ese error crudo. Resultado medido: **16 intentos de cancelar en
// el mismo minuto** (20:31 del 05/08), todos fallidos. La persona no podía ni comprar ni deshacer
// lo que tenía a medias, y la alerta que saltó (`subscription_cancel_error_burst`) nombraba el
// endpoint de CANCELAR, escondiendo que lo que había detrás era una compra atascada 18 días.
//
// Lo que Stripe pide es literalmente lo que hay que hacer: **expirar la sesión de checkout y
// reintentar**. No es una excepción que haya que sortear, es el procedimiento documentado.
//
// El criterio vive aquí y no en `queries.ts` porque allí no se puede probar sin Stripe: el fallo
// solo aparece con un cliente real con un checkout abierto de verdad.

/** Lo poco que hace falta de un error de Stripe (manda mucho más). */
export interface ErrorStripeMinimo {
  code?: string | null
  message?: string | null
  type?: string | null
}

/**
 * ¿Este error de cancelación es «hay un checkout abierto»?
 *
 * Stripe **no da un `code` propio** para este caso —viaja como `invalid_request_error` con el
 * mensaje en prosa—, así que hay que reconocerlo por el texto. Eso es frágil por naturaleza, y por
 * eso se exige que aparezcan las DOS ideas (que no se puede cancelar y que hay que expirar la
 * sesión de checkout): un mensaje que solo mencione «checkout» de pasada no basta para
 * desencadenar una escritura en Stripe.
 *
 * Si Stripe cambia el texto, esto devolverá `false` y el comportamiento vuelve a ser el de antes
 * —el error crudo al usuario—, que es el fallo conocido y no uno nuevo. **Falla hacia no actuar.**
 */
export function esBloqueoPorCheckoutAbierto(err: ErrorStripeMinimo | null | undefined): boolean {
  if (!err) return false
  const msg = (err.message ?? '').toLowerCase()
  if (!msg) return false

  const niegaCancelar = msg.includes('cannot cancel') || msg.includes('can not cancel')
  const señalaCheckout = msg.includes('checkout session')

  return niegaCancelar && señalaCheckout
}

/** Estados de una sesión de checkout que se pueden expirar. Los demás ya están cerrados. */
const EXPIRABLES = new Set(['open'])

/** Lo poco que hace falta de una sesión de checkout. */
export interface SesionCheckoutMinima {
  id?: string | null
  status?: string | null
}

/**
 * De las sesiones de checkout de un cliente, cuáles hay que expirar para poder cancelar.
 *
 * Solo las `open`: `complete` y `expired` ya no bloquean nada, y pedirle a Stripe que expire una
 * sesión cerrada devuelve error — o sea que filtrar aquí no es una optimización, evita fallos.
 */
export function sesionesAExpirar(
  sesiones: readonly (SesionCheckoutMinima | null | undefined)[] | null | undefined,
): string[] {
  if (!sesiones) return []
  return sesiones
    .filter((s): s is SesionCheckoutMinima => !!s)
    .filter((s) => !!s.id && EXPIRABLES.has(s.status ?? ''))
    .map((s) => s.id as string)
}
