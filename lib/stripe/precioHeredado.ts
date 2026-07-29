/**
 * lib/stripe/precioHeredado.ts — NÚCLEO PURO de los precios heredados.
 *
 * ## Qué es un precio heredado
 *
 * El precio que le mantenemos a UNA persona porque ya lo tenía antes de una subida de
 * tarifa. Nace del caso Rocío (29/07/2026): pagaba 18 €/mes, su suscripción entró en el
 * barrido de "no renovar" del 20/07 y al volver se encontró el mensual a 29 €. Reclamó,
 * y la decisión fue mantenerle su precio.
 *
 * ## Por qué un PRICE dedicado y no un cupón
 *
 * Un cupón obliga a razonar en porcentajes (18/29 = -37,93 %, con redondeos que no
 * cuadran) y se descoloca en cuanto cambia la tarifa base. Un price recurrente propio
 * factura 18 € limpios mes tras mes, es lo que la persona ve en su recibo, y sobrevive a
 * cualquier cambio de tarifa. Además el webhook decide el plan por INTERVALO, no por
 * price id (`determinePlanType` en `lib/stripe-webhook-handlers.ts`), así que un precio
 * a medida da premium sin tocar una línea de código.
 *
 * ## Escalable por construcción
 *
 * El price se identifica por `lookup_key` derivada de (intervalo, importe): dos personas
 * con el mismo precio heredado REUTILIZAN el mismo price, y crear uno nuevo es cambiar el
 * importe en la llamada. Sin tablas nuevas, sin ramas por usuario.
 *
 * CLI que lo usa: `scripts/stripe/precio-heredado.cjs`.
 */

export type IntervaloHeredado = 'mensual' | 'trimestral' | 'semestral' | 'anual'

export interface RecurrenciaStripe {
  interval: 'month' | 'year'
  interval_count: number
}

/**
 * Intervalo → recurrencia de Stripe. Los mismos que usa el catálogo vigente, para que
 * `determinePlanType` los mapee a premium_monthly/quarterly/semester/annual.
 */
export const RECURRENCIA: Record<IntervaloHeredado, RecurrenciaStripe> = {
  mensual: { interval: 'month', interval_count: 1 },
  trimestral: { interval: 'month', interval_count: 3 },
  semestral: { interval: 'month', interval_count: 6 },
  anual: { interval: 'year', interval_count: 1 },
}

export const INTERVALOS = Object.keys(RECURRENCIA) as IntervaloHeredado[]

/** ¿Es un intervalo admitido? (el CLI valida la entrada del operador con esto) */
export function esIntervaloValido(v: string): v is IntervaloHeredado {
  return (INTERVALOS as string[]).includes(v)
}

/**
 * Euros → céntimos, con las validaciones que impiden un desastre de tarifa.
 *
 * Rechaza el 0 y los negativos (un "regalo" se hace con plan free o cupón 100 %, no con
 * un price a 0 que además Stripe no admite en una suscripción normal) y más de dos
 * decimales (18,333 € factura mal y descuadra la contabilidad).
 */
export function euroACentimos(euros: number): number {
  if (!Number.isFinite(euros)) throw new Error('El importe no es un número')
  if (euros <= 0) throw new Error('El importe debe ser mayor que 0')
  const centimos = Math.round(euros * 100)
  if (Math.abs(euros * 100 - centimos) > 1e-9) {
    throw new Error('El importe no puede tener más de dos decimales')
  }
  return centimos
}

/**
 * Clave estable del price. Es la que hace la herramienta idempotente: llamar dos veces
 * con el mismo (intervalo, importe) reutiliza el price en vez de crear un duplicado, que
 * es como se acaba con siete precios de 18 € y ninguno identificable.
 */
export function lookupKeyPrecioHeredado(intervalo: IntervaloHeredado, centimos: number): string {
  return `heredado_${intervalo}_${centimos}`
}

/** Nombre del producto tal y como lo verá la persona en su recibo de Stripe. */
export function nombreProductoHeredado(intervalo: IntervaloHeredado): string {
  const etiqueta: Record<IntervaloHeredado, string> = {
    mensual: 'Mensual',
    trimestral: 'Trimestral',
    semestral: 'Semestral',
    anual: 'Anual',
  }
  return `Vence Premium ${etiqueta[intervalo]}`
}

/**
 * Aviso cuando el precio heredado NO es más barato que la tarifa vigente.
 *
 * No lo bloquea (puede haber un motivo legítimo, p. ej. reproducir un precio antiguo más
 * caro tras una BAJADA de tarifa), pero el operador debe verlo: mantener un precio peor
 * que el público es un error caro de detectar después.
 */
export function avisoSiNoMejora(centimosHeredado: number, centimosVigente: number | null): string | null {
  if (centimosVigente == null) return null
  if (centimosHeredado < centimosVigente) return null
  return centimosHeredado === centimosVigente
    ? 'El precio heredado es IGUAL que la tarifa vigente: no hace falta un price aparte.'
    : `El precio heredado (${(centimosHeredado / 100).toFixed(2)} €) es MÁS CARO que la tarifa vigente (${(centimosVigente / 100).toFixed(2)} €).`
}

/** Metadata de auditoría del price/enlace: quién, por qué y para quién. */
export function metadataHeredado(params: {
  userId: string
  email: string
  motivo: string
  feedbackId?: string | null
  creadoPor?: string
}): Record<string, string> {
  const meta: Record<string, string> = {
    supabase_user_id: params.userId,
    email: params.email,
    tipo: 'precio_heredado',
    motivo: params.motivo,
    creado_por: params.creadoPor || 'soporte',
  }
  if (params.feedbackId) meta.feedback_id = params.feedbackId
  return meta
}
