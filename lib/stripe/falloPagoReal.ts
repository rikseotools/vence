// lib/stripe/falloPagoReal.ts
//
// ¿Un `invoice.payment_failed` de Stripe significa que el pago ha FALLADO de verdad?
//
// No siempre, y esa diferencia es la que motivó este módulo (T-594, 05/08/2026). Cuando la tarjeta
// exige autenticación reforzada (3D Secure / SCA, lo normal en España), Stripe emite `invoice.
// payment_failed` **junto a** `invoice.payment_action_required` en el mismo segundo: no es un
// rechazo, es «esta persona está ahora mismo en la pantalla de su banco». Segundos después llega
// `payment_intent.succeeded` y el cobro entra sin más.
//
// Nuestro webhook trataba los dos casos igual y mandaba el correo «Problema con el pago de tu
// suscripción» en cuanto veía el `payment_failed`. Medido sobre los correos de julio y agosto de
// 2026: **148 de 214 (69%) fueron a personas cuya suscripción se activó a los pocos segundos** —
// es decir, a quien estaba pagando bien, en mitad de la compra, y con la firma inconfundible de
// llegar ~5 s ANTES de que arrancara su periodo. Caso que lo destapó: el feedback `ec8e59fe`
// («me han enviado un correo como que ha habido un error en el pago, pero en la página me sale que
// está bien»); su factura en Stripe está `paid` con `attempt_count=1`.
//
// El criterio va aquí y no en el handler porque el handler no se puede probar sin Stripe.

/** Lo poco que hace falta del PaymentIntent (Stripe manda mucho más). */
export interface PaymentIntentMinimo {
  status?: string | null
  last_payment_error?: { code?: string | null } | null
}

/** Lo poco que hace falta de la factura. */
export interface FacturaMinima {
  status?: string | null
  paid?: boolean | null
}

export type MotivoOmision =
  | 'autenticacion_pendiente' // 3DS/SCA en curso: la persona está en la pantalla de su banco
  | 'ya_pagada' // carrera: cuando miramos, la factura ya estaba cobrada

export interface VeredictoFalloPago {
  /** ¿Avisamos a la persona de que su pago ha fallado? */
  avisar: boolean
  /** Por qué NO avisamos (null si sí avisamos). */
  motivo: MotivoOmision | null
}

const AVISAR: VeredictoFalloPago = { avisar: true, motivo: null }

/**
 * Decide si un `invoice.payment_failed` merece el correo de pago fallido.
 *
 * **Falla hacia AVISAR.** Si no tenemos el PaymentIntent (no vino, o Stripe no nos lo dio) se
 * avisa, que es el comportamiento histórico: callar un fallo real es peor que un aviso de más, y
 * la duda no puede convertirse en silencio.
 */
export function decidirAvisoPagoFallido(
  factura: FacturaMinima | null | undefined,
  pi: PaymentIntentMinimo | null | undefined,
): VeredictoFalloPago {
  // La factura ya está cobrada: el `payment_failed` que estamos procesando quedó atrás.
  if (factura?.status === 'paid' || factura?.paid === true) {
    return { avisar: false, motivo: 'ya_pagada' }
  }

  if (!pi) return AVISAR

  // El cobro entró entre el evento y nuestra consulta.
  if (pi.status === 'succeeded' || pi.status === 'processing') {
    return { avisar: false, motivo: 'ya_pagada' }
  }

  // SCA/3DS en curso. Las dos señales que Stripe usa para lo mismo.
  if (pi.status === 'requires_action' || pi.status === 'requires_confirmation') {
    return { avisar: false, motivo: 'autenticacion_pendiente' }
  }
  if (pi.last_payment_error?.code === 'authentication_required') {
    return { avisar: false, motivo: 'autenticacion_pendiente' }
  }

  // Rechazo de verdad (`requires_payment_method` con `card_declined`,
  // `insufficient_funds`…) o cualquier estado que no sepamos leer.
  return AVISAR
}
