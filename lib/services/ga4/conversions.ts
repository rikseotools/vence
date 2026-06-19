// lib/services/ga4/conversions.ts
//
// F4 — destino GA4. Envía el evento `purchase` a Google Analytics 4 por
// Measurement Protocol (server-side, desde el outbox). Esto da a GA4 visión de
// INGRESO por canal (no solo Ads): orgánico, directo, redes… + audiencias de
// remarketing. Complementa (no sustituye) la subida a Google Ads.
//
// Requiere el `client_id` de GA (cookie _ga) capturado en el registro, para que
// GA4 ate la compra a la sesión/usuario y atribuya el canal. Sin client_id no se
// puede enviar (GA4 MP lo exige) → el destino no acepta esas ventas (supports).
//
// Endpoint MP: https://www.google-analytics.com/mp/collect?measurement_id=&api_secret=
// Idempotencia: GA4 deduplica `purchase` por `transaction_id`.

import type { ConversionDestination, ConversionEvent, DeliverOptions, DeliveryResult } from '@/lib/conversions/types'

const MP_ENDPOINT = 'https://www.google-analytics.com/mp/collect'
const DEFAULT_MEASUREMENT_ID = 'G-WXQ069CRY9'

export interface Ga4PurchaseInput {
  clientId: string
  valueEur: number
  currency: string
  transactionId: string
  dryRun?: boolean
}

/** Envía un evento `purchase` a GA4 por Measurement Protocol. */
export async function sendGa4Purchase(input: Ga4PurchaseInput): Promise<DeliveryResult> {
  const apiSecret = process.env.GA4_API_SECRET
  const measurementId = process.env.GA4_MEASUREMENT_ID || DEFAULT_MEASUREMENT_ID
  // Terminales: reintentar no arregla ni la config ausente ni la falta de id.
  if (!apiSecret) return { ok: false, detail: 'ga4_api_secret_missing', terminal: true }
  if (!input.clientId) return { ok: false, detail: 'no_client_id', terminal: true }

  const body = {
    client_id: input.clientId,
    // GA4 MP: en validación se usa /debug/mp/collect; aquí marcamos dryRun con
    // el endpoint de debug para no registrar el evento real.
    events: [
      {
        name: 'purchase',
        params: {
          currency: (input.currency || 'EUR').toUpperCase(),
          value: input.valueEur,
          transaction_id: input.transactionId,
        },
      },
    ],
  }

  const base = input.dryRun
    ? 'https://www.google-analytics.com/debug/mp/collect'
    : MP_ENDPOINT
  const url = `${base}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    // MP collect devuelve 204 sin cuerpo. El endpoint /debug devuelve 200 + JSON
    // con validationMessages (vacío = OK).
    if (input.dryRun) {
      const json = await res.json().catch(() => ({}))
      const msgs = (json as { validationMessages?: unknown[] }).validationMessages || []
      if (Array.isArray(msgs) && msgs.length > 0) {
        // Datos inválidos → terminal (reintentar el mismo payload no cambia).
        return { ok: false, detail: `validation: ${JSON.stringify(msgs).slice(0, 200)}`, terminal: true }
      }
      return { ok: true, detail: 'validated' }
    }
    if (res.status === 204 || res.ok) return { ok: true, detail: 'sent' }
    // 4xx = error de cliente (datos/auth) → terminal; 5xx = servidor → reintentable.
    return { ok: false, detail: `http_${res.status}`, terminal: res.status >= 400 && res.status < 500 }
  } catch (e) {
    // Error de red → reintentable (terminal undefined).
    return { ok: false, detail: e instanceof Error ? e.message : String(e) }
  }
}

/** Adapter de GA4 para el bus de conversiones. */
export const ga4Destination: ConversionDestination = {
  name: 'ga4',

  supports(event: ConversionEvent): boolean {
    // Solo purchase, solo si está habilitado y tenemos client_id (GA4 MP lo
    // exige). Sin client_id no se encola → no ensucia la DLQ.
    return (
      process.env.GA4_UPLOAD_ENABLED === 'true' &&
      event.type === 'purchase' &&
      !!event.attribution.gaClientId
    )
  },

  async deliver(event: ConversionEvent, opts: DeliverOptions): Promise<DeliveryResult> {
    return sendGa4Purchase({
      clientId: event.attribution.gaClientId!,
      valueEur: event.valueCents / 100,
      currency: event.currency,
      transactionId: event.orderId || event.dedupId,
      dryRun: opts.dryRun,
    })
  },
}
