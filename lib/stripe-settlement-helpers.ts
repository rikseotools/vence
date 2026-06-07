// lib/stripe-settlement-helpers.ts
// Lógica pura de liquidación (settlement) de pagos Stripe: split Manuel/Armando
// y recálculo tras reembolsos. Sin I/O para poder testearse sin red ni BD.

/** Manuel se lleva el 90% del neto; Armando el 10% (el resto, para que cuadre). */
export const MANUEL_SHARE = 0.9

export interface SettlementSplit {
  amountNet: number
  manuelAmount: number
  armandoAmount: number
}

/**
 * Split base de un cobro: neto = bruto - fee de Stripe; Manuel 90%, Armando el
 * resto. Misma fórmula que usa el webhook al registrar la settlement, extraída
 * aquí para reutilizarla en el recálculo por reembolso y poder testearla.
 */
export function computeSettlementSplit(amountGross: number, stripeFee: number): SettlementSplit {
  const amountNet = amountGross - stripeFee
  const manuelAmount = Math.round(amountNet * MANUEL_SHARE)
  const armandoAmount = amountNet - manuelAmount
  return { amountNet, manuelAmount, armandoAmount }
}

/**
 * Recalcula el neto ADEUDADO de una settlement tras un reembolso, partiendo
 * SIEMPRE de la base inmutable (`amountGross`, `stripeFee`) y del total
 * reembolsado acumulado (`refundedAmount`, tal cual lo da Stripe en
 * `charge.amount_refunded`). Por eso es idempotente: reprocesar el mismo
 * `charge.refunded` da el mismo resultado, y un 2º reembolso parcial recalcula
 * con el acumulado mayor sin arrastrar estado previo.
 *
 * El neto se reduce en la MISMA fracción que el bruto reembolsado
 * (refundedAmount/amountGross), y el split Manuel/Armando se reaplica sobre el
 * neto resultante. Reembolso total → todo a 0 (lo que mantiene correctas las
 * queries de ingresos/payout que suman estas columnas).
 *
 * `refundedAmount` se clampa a [0, amountGross] por seguridad (Stripe nunca
 * reembolsa más que el bruto, pero defendemos contra datos raros).
 */
export function computeSettlementAfterRefund(params: {
  amountGross: number
  stripeFee: number
  refundedAmount: number
}): SettlementSplit {
  const { amountGross, stripeFee } = params
  if (amountGross <= 0) {
    return { amountNet: 0, manuelAmount: 0, armandoAmount: 0 }
  }
  const refundedAmount = Math.min(Math.max(params.refundedAmount, 0), amountGross)
  const remainingFraction = 1 - refundedAmount / amountGross
  const originalNet = amountGross - stripeFee
  const amountNet = Math.round(originalNet * remainingFraction)
  const manuelAmount = Math.round(amountNet * MANUEL_SHARE)
  const armandoAmount = amountNet - manuelAmount
  return { amountNet, manuelAmount, armandoAmount }
}
