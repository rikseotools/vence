// lib/conversions/recordConversion.ts
//
// Punto de entrada del bus: encola un evento de conversión en el outbox, UNA
// fila por destino suscrito. No envía nada (eso lo hace el worker). Idempotente
// por `id` determinista (reintentar no duplica). Nunca lanza: el tracking no
// debe romper el flujo de negocio que lo invoca (webhook de Stripe, auth…).

import { getAdminDb } from '@/db/client'
import { conversionOutbox } from '@/db/schema'
import type { ConversionEvent } from './types'
import { getDestinations } from './registry'

export async function recordConversion(event: ConversionEvent): Promise<{ enqueued: number }> {
  try {
    const dests = getDestinations().filter((d) => d.supports(event))
    if (dests.length === 0) return { enqueued: 0 }

    const rows = dests.map((d) => ({
      id: `${event.dedupId}:${d.name}`,
      eventType: event.type,
      destination: d.name,
      userId: event.userId,
      valueCents: event.valueCents,
      currency: event.currency,
      occurredAt: event.occurredAt,
      payload: {
        attribution: event.attribution,
        orderId: event.orderId ?? null,
      },
    }))

    await getAdminDb()
      .insert(conversionOutbox)
      .values(rows)
      .onConflictDoNothing()

    return { enqueued: rows.length }
  } catch (err) {
    // No propagar: el caller (webhook) no debe fallar por el tracking.
    console.error('❌ [recordConversion] error encolando:', err)
    return { enqueued: 0 }
  }
}
