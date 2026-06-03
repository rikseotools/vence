// lib/conversions/types.ts
//
// Contratos del bus de conversiones (F1 trackeo-conversiones-ventas).
// Un único evento canónico + una interfaz de destino. Añadir una plataforma
// nueva (Meta/GA4/TikTok) = implementar `ConversionDestination`, sin tocar el
// bus ni el webhook. Mismo patrón "agnóstico by contract" que observabilidad.

export type ConversionEventType =
  | 'purchase'
  | 'refund'
  | 'registration'
  | 'checkout_started'

/** Identificadores de clic de cada plataforma + email hasheado (Enhanced Conversions). */
export interface AttributionSnapshot {
  gclid?: string | null
  gbraid?: string | null
  wbraid?: string | null
  fbclid?: string | null
  ttclid?: string | null
  msclkid?: string | null
  /** SHA-256 del email normalizado (lowercase+trim). Nunca PII en claro. */
  emailSha256?: string | null
}

export interface ConversionEvent {
  /** Base determinista para idempotencia, p.ej. `purchase:in_123`. El outbox
   *  añade el destino → `purchase:in_123:google_ads`. */
  dedupId: string
  type: ConversionEventType
  userId: string | null
  valueCents: number
  currency: string
  /** ISO 8601 del momento del evento (no de la subida). */
  occurredAt: string
  /** Identificador de pedido para los destinos (order_id en Google Ads). */
  orderId?: string | null
  attribution: AttributionSnapshot
}

export interface DeliveryResult {
  ok: boolean
  /** Descripción legible (para logs / last_error). */
  detail?: string
}

export interface DeliverOptions {
  dryRun: boolean
}

/** Un destino publicitario (Google Ads, Meta, GA4…). Implementación idempotente. */
export interface ConversionDestination {
  readonly name: string
  /** ¿este destino acepta este tipo de evento? */
  supports(event: ConversionEvent): boolean
  /** Entrega el evento. Debe ser idempotente (dedup por orderId/dedupId). */
  deliver(event: ConversionEvent, opts: DeliverOptions): Promise<DeliveryResult>
}
