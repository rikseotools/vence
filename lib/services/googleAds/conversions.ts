// lib/services/googleAds/conversions.ts
//
// F1 — subida de conversiones de COMPRA a Google Ads (Offline Conversion Import
// + Enhanced Conversions). Es lo que hace que una venta del webhook de Stripe
// llegue a Google Ads con su valor en €.
//
//   - OCI: si hay click-ID (gclid/gbraid/wbraid) lo adjunta → atribución exacta.
//   - Enhanced Conversions: adjunta el email hasheado SHA-256 → recupera ventas
//     sin click-ID y mejora el match. Nunca se envía PII en claro.
//
// Seguridad: mismo patrón que mutations.ts — `dryRun` usa `validate_only` para
// que Google VALIDE sin escribir (detecta errores reales sin tocar la cuenta).
//
// La acción de conversión "vence (web) purchase":
//   customers/9148967335/conversionActions/7447588685  (activar antes del live).

import { createHash } from 'crypto'
import { loadAdsConfig } from './config'
import { normalizeGoogleAdsError } from './errors'
// NOTA: `./client` (que importa la librería google-ads-api, ESM-pesada) se
// carga PEREZOSAMENTE dentro de uploadPurchaseConversion — así este módulo es
// testeable sin red y no penaliza el cold-start de quien no sube conversiones.
import type { ConversionDestination, ConversionEvent, DeliverOptions, DeliveryResult } from '@/lib/conversions/types'

// Resource name de la acción de conversión de compra (cuenta Vence 914-896-7335).
const PURCHASE_CONVERSION_ACTION = 'customers/9148967335/conversionActions/7447588685'

export interface PurchaseConversionInput {
  gclid?: string | null
  gbraid?: string | null
  wbraid?: string | null
  /** SHA-256 hex del email normalizado (Enhanced Conversions). */
  emailSha256?: string | null
  valueEur: number
  currency: string
  orderId: string
  /** ISO 8601. Se convierte a "yyyy-mm-dd hh:mm:ss+00:00" (formato Ads). */
  occurredAt: string
  dryRun?: boolean
}

/** SHA-256 hex de un email normalizado (lowercase + trim). Para Enhanced Conversions. */
export function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}

/** ISO 8601 → "yyyy-mm-dd hh:mm:ss+00:00" en UTC (lo que exige Google Ads). */
function toAdsDateTime(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+00:00`
}

/**
 * Sube una conversión de compra a Google Ads. Devuelve `{ ok, detail }` en vez
 * de lanzar, para que el worker del outbox decida reintento/DLQ.
 */
export async function uploadPurchaseConversion(input: PurchaseConversionInput): Promise<DeliveryResult> {
  const dryRun = input.dryRun ?? true

  // El email hasheado (Enhanced Conversions) solo se envía si la cuenta lo tiene
  // CONFIGURADO con método "Google Ads API" (no basta con aceptar los customer
  // data terms). Si se manda sin configurar, Google RECHAZA la conversión ENTERA
  // —aunque el gclid sea válido—. Por eso va detrás de un flag: por defecto OFF,
  // así el camino gclid funciona limpio; se enciende cuando se configura en Ads.
  const enhancedEnabled = process.env.ADS_ENHANCED_CONVERSIONS_ENABLED === 'true'
  const useEmail = enhancedEnabled && !!input.emailSha256

  const hasClickId = !!(input.gclid || input.gbraid || input.wbraid)
  if (!hasClickId && !useEmail) {
    return { ok: false, detail: 'no_identifier' } // ni click-ID ni email utilizable → no atribuible
  }

  const conversion: Record<string, unknown> = {
    conversion_action: PURCHASE_CONVERSION_ACTION,
    conversion_date_time: toAdsDateTime(input.occurredAt),
    conversion_value: input.valueEur,
    currency_code: (input.currency || 'EUR').toUpperCase(),
    order_id: input.orderId, // idempotencia en el lado de Google
  }
  if (input.gclid) conversion.gclid = input.gclid
  if (input.gbraid) conversion.gbraid = input.gbraid
  if (input.wbraid) conversion.wbraid = input.wbraid
  if (useEmail) {
    conversion.user_identifiers = [{ hashed_email: input.emailSha256 }]
  }

  try {
    const { getGoogleAdsCustomer } = await import('./client')
    const customer = getGoogleAdsCustomer()
    const customerId = loadAdsConfig().customerId
    const response = await customer.conversionUploads.uploadClickConversions({
      customer_id: customerId,
      conversions: [conversion],
      partial_failure: true,
      validate_only: dryRun,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    // partial_failure devuelve los errores por fila aquí en vez de lanzar.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pfe = (response as any)?.partial_failure_error
    if (pfe && (pfe.code || pfe.message)) {
      return { ok: false, detail: `partial_failure: ${pfe.message || JSON.stringify(pfe)}` }
    }

    return { ok: true, detail: dryRun ? 'validated' : 'uploaded' }
  } catch (e) {
    const err = normalizeGoogleAdsError(e)
    return { ok: false, detail: err.message }
  }
}

/** Adapter de Google Ads para el bus de conversiones. */
export const googleAdsDestination: ConversionDestination = {
  name: 'google_ads',

  supports(event: ConversionEvent): boolean {
    // Refunds requieren conversion ADJUSTMENT (otro servicio) → futuro.
    return event.type === 'purchase'
  },

  async deliver(event: ConversionEvent, opts: DeliverOptions): Promise<DeliveryResult> {
    const a = event.attribution
    return uploadPurchaseConversion({
      gclid: a.gclid,
      gbraid: a.gbraid,
      wbraid: a.wbraid,
      emailSha256: a.emailSha256,
      valueEur: event.valueCents / 100,
      currency: event.currency,
      orderId: event.orderId || event.dedupId,
      occurredAt: event.occurredAt,
      dryRun: opts.dryRun,
    })
  },
}
