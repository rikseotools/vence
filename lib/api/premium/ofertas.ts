/**
 * lib/api/premium/ofertas.ts — ofertas de precio personalizadas (precio heredado).
 *
 * Nace del caso Rocío (29/07/2026): se le mantiene el precio que ya pagaba tras una
 * subida de tarifa. La oferta vive en `user_price_offers` (dato de la persona) en vez de
 * en un enlace de Stripe suelto, por dos motivos: **marca** (contrata en Vence, viendo lo
 * que contrata, no en una URL ajena que no sabe a dónde lleva) y **seguridad** (el precio
 * bajo deja de ser un secreto compartible: el checkout comprueba que es SUYO).
 *
 * La política es pura y está aparte de la consulta para poder probarla sin BD.
 */
import { sql } from 'drizzle-orm'
import { getDb, getPoolerDb } from '@/db/client'

// Mismo criterio de pool que el resto de lecturas user-facing.
function getOfertasDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

export interface OfertaPrecio {
  id: string
  userId: string
  stripePriceId: string
  stripeAccount: string
  importeCentimos: number
  intervalo: 'mensual' | 'trimestral' | 'semestral' | 'anual'
  motivo: string
  paymentLinkUrl: string | null
  createdAt: Date
  expiresAt: Date | null
  redeemedAt: Date | null
  revokedAt: Date | null
}

/** Etiqueta de la periodicidad tal y como se le enseña a la persona. */
export const ETIQUETA_INTERVALO: Record<OfertaPrecio['intervalo'], string> = {
  mensual: 'al mes',
  trimestral: 'cada 3 meses',
  semestral: 'cada 6 meses',
  anual: 'al año',
}

/** Meses que cubre cada periodicidad (para el €/mes). */
export const MESES_INTERVALO: Record<OfertaPrecio['intervalo'], number> = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
}

/**
 * ¿Se le puede enseñar y cobrar esta oferta AHORA?
 *
 * PURA a propósito: es la misma decisión que toman la página y el guardia del checkout, y
 * si cada uno la razonara por su cuenta acabarían discrepando (la página enseñaría un
 * precio que el checkout rechaza, que es la peor cara posible ante alguien a quien ya le
 * hemos fallado una vez).
 */
export function ofertaVigente(
  oferta: Pick<OfertaPrecio, 'expiresAt' | 'redeemedAt' | 'revokedAt'> | null | undefined,
  ahora: Date = new Date(),
): boolean {
  if (!oferta) return false
  if (oferta.revokedAt) return false
  if (oferta.redeemedAt) return false
  if (oferta.expiresAt && oferta.expiresAt.getTime() <= ahora.getTime()) return false
  return true
}

/** Importe formateado en euros, con céntimos solo si los tiene (18 € / 18,50 €). */
export function formatearImporte(centimos: number): string {
  const euros = centimos / 100
  return Number.isInteger(euros) ? `${euros} €` : `${euros.toFixed(2).replace('.', ',')} €`
}

/** €/mes equivalente, para que se vea la ventaja en los planes largos. */
export function euroPorMes(centimos: number, intervalo: OfertaPrecio['intervalo']): string {
  return formatearImporte(Math.round(centimos / MESES_INTERVALO[intervalo]))
}

function mapear(row: Record<string, unknown>): OfertaPrecio {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    stripePriceId: String(row.stripe_price_id),
    stripeAccount: String(row.stripe_account),
    importeCentimos: Number(row.importe_centimos),
    intervalo: row.intervalo as OfertaPrecio['intervalo'],
    motivo: String(row.motivo),
    paymentLinkUrl: (row.payment_link_url as string) ?? null,
    createdAt: new Date(row.created_at as string),
    expiresAt: row.expires_at ? new Date(row.expires_at as string) : null,
    redeemedAt: row.redeemed_at ? new Date(row.redeemed_at as string) : null,
    revokedAt: row.revoked_at ? new Date(row.revoked_at as string) : null,
  }
}

/**
 * TODAS las ofertas vivas de una persona.
 *
 * Son varias a propósito desde el 29/07: a quien se le mantiene el precio se le pueden
 * ofrecer su mensual Y su trimestral, y que elija. Devolver solo una obligaba a decidir
 * por ella cuál — y si el mensaje le prometía dos, veía una y parecía roto.
 */
export async function getOfertasActivas(userId: string): Promise<OfertaPrecio[]> {
  const db = getOfertasDb()
  const rows = await db.execute(sql`
    SELECT * FROM user_price_offers
    WHERE user_id = ${userId} AND redeemed_at IS NULL AND revoked_at IS NULL
    ORDER BY importe_centimos
  `)
  const arr = (rows as unknown as { rows?: unknown[] }).rows ?? (rows as unknown as unknown[])
  return (arr as Record<string, unknown>[]).map(mapear).filter((o) => ofertaVigente(o))
}

/** La primera oferta viva (compatibilidad con quien espera una sola). */
export async function getOfertaActiva(userId: string): Promise<OfertaPrecio | null> {
  const db = getOfertasDb()
  const rows = await db.execute(sql`
    SELECT * FROM user_price_offers
    WHERE user_id = ${userId}
      AND redeemed_at IS NULL
      AND revoked_at IS NULL
    LIMIT 1
  `)
  const arr = (rows as unknown as { rows?: unknown[] }).rows ?? (rows as unknown as unknown[])
  const row = (arr as Record<string, unknown>[])[0]
  if (!row) return null
  const oferta = mapear(row)
  return ofertaVigente(oferta) ? oferta : null
}

/**
 * ¿Este precio es de esta persona? Lo usa el guardia del checkout.
 *
 * Sin esto, cualquiera que conociese un `price_...` heredado podría pagarlo poniéndolo en
 * la petición: el endpoint acepta el `priceId` que le manden.
 */
export async function priceEsDelUsuario(userId: string, priceId: string): Promise<boolean> {
  const db = getOfertasDb()
  const rows = await db.execute(sql`
    SELECT expires_at, redeemed_at, revoked_at FROM user_price_offers
    WHERE user_id = ${userId} AND stripe_price_id = ${priceId}
    LIMIT 1
  `)
  const arr = (rows as unknown as { rows?: unknown[] }).rows ?? (rows as unknown as unknown[])
  const row = (arr as Record<string, unknown>[])[0]
  if (!row) return false
  return ofertaVigente({
    expiresAt: row.expires_at ? new Date(row.expires_at as string) : null,
    redeemedAt: row.redeemed_at ? new Date(row.redeemed_at as string) : null,
    revokedAt: row.revoked_at ? new Date(row.revoked_at as string) : null,
  })
}

/** Marca la oferta como usada (la llama el webhook al activarse la suscripción). */
export async function marcarOfertaCanjeada(userId: string, priceId: string): Promise<void> {
  const db = getOfertasDb()
  await db.execute(sql`
    UPDATE user_price_offers
    SET redeemed_at = now()
    WHERE user_id = ${userId} AND stripe_price_id = ${priceId} AND redeemed_at IS NULL
  `)
}

/**
 * ¿Le queda suscripción viva a esta persona, y hasta cuándo? (T-355, 31/07/2026)
 *
 * El botón «Continuar con mi precio» se le enseña a todo el que no puede renovar en su cuenta, y
 * eso incluye a las **186 suscripciones que siguen ACTIVAS marcadas «no renueva»** y que se apagan
 * solas entre ahora y enero de 2027. Si una de esas personas contrata hoy, **paga las dos** hasta
 * que la vieja caduque: de días a meses (79 son trimestrales y 73 semestrales).
 *
 * Se lee de `user_subscriptions` a propósito: mientras no contrate la nueva, esa fila **es** la
 * antigua. En cuanto contrata, se sobrescribe con la nueva — y entonces este dato ya no sirve para
 * saber qué tenía antes (el gotcha que documenta T-355, y que costó un falso positivo al medirlo).
 */
export async function premiumVigenteHasta(userId: string): Promise<Date | null> {
  const db = getPoolerDb() ?? getDb()
  const res = await db.execute(sql`
    SELECT max(current_period_end) AS hasta
      FROM user_subscriptions
     WHERE user_id = ${userId}::uuid
       AND status = 'active'
       AND current_period_end > now()`)
  // El driver devuelve `{rows}` en unos casos y un array pelado en otros (mismo patrón que
  // `filasDe` en ofertaHeredada): se normaliza aquí en vez de suponer una forma.
  const crudo = res as unknown
  const filas = (Array.isArray(crudo) ? crudo : ((crudo as { rows?: unknown[] })?.rows ?? [])) as Array<Record<string, unknown>>
  const hasta = filas[0]?.hasta
  return hasta ? new Date(String(hasta)) : null
}
