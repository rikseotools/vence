// lib/conversions/worker.ts
//
// Worker del outbox de conversiones: drena los pendientes y los entrega a su
// destino. At-least-once + idempotente + reintentos con DLQ. Lo invoca el cron
// app/api/cron/conversion-outbox.
//
// dryRun: en modo validate-only NO marca delivered (la fila queda pending para
// cuando se active el envío real); solo confirma que la subida valida contra la
// plataforma sin error. En modo real, marca delivered o reintenta hasta DLQ.

import { getAdminDb } from '@/db/client'
import { conversionOutbox } from '@/db/schema'
import { and, asc, eq } from 'drizzle-orm'
import { getDestinationByName } from './registry'
import type { ConversionEvent } from './types'

const MAX_RETRY = 5

export interface DrainSummary {
  scanned: number
  delivered: number
  validated: number
  retried: number
  dlq: number
  dryRun: boolean
}

type OutboxRow = typeof conversionOutbox.$inferSelect

function rehydrate(row: OutboxRow): ConversionEvent {
  const payload = (row.payload ?? {}) as { attribution?: ConversionEvent['attribution']; orderId?: string | null }
  // dedupId base = id sin el sufijo ":<destination>"
  const dedupId = row.id.endsWith(`:${row.destination}`)
    ? row.id.slice(0, -(row.destination.length + 1))
    : row.id
  return {
    dedupId,
    type: row.eventType as ConversionEvent['type'],
    userId: row.userId,
    valueCents: row.valueCents,
    currency: row.currency,
    occurredAt: row.occurredAt,
    orderId: payload.orderId ?? null,
    attribution: payload.attribution ?? {},
  }
}

export async function drainConversionOutbox(
  opts: { limit?: number; dryRun: boolean },
): Promise<DrainSummary> {
  const { limit = 50, dryRun } = opts
  const db = getAdminDb()

  const pending = await db
    .select()
    .from(conversionOutbox)
    .where(eq(conversionOutbox.status, 'pending'))
    .orderBy(asc(conversionOutbox.createdAt))
    .limit(limit)

  const summary: DrainSummary = { scanned: pending.length, delivered: 0, validated: 0, retried: 0, dlq: 0, dryRun }

  for (const row of pending) {
    const dest = getDestinationByName(row.destination)
    if (!dest) {
      await db.update(conversionOutbox)
        .set({ status: 'failed', lastError: `unknown_destination:${row.destination}`, retryCount: row.retryCount + 1 })
        .where(eq(conversionOutbox.id, row.id))
      summary.dlq++
      continue
    }

    const event = rehydrate(row)
    try {
      const res = await dest.deliver(event, { dryRun })
      if (!res.ok) throw new Error(res.detail || 'delivery_failed')

      if (dryRun) {
        // Validate-only: no consumir la fila; solo limpiar error previo.
        await db.update(conversionOutbox)
          .set({ lastError: null })
          .where(eq(conversionOutbox.id, row.id))
        summary.validated++
      } else {
        await db.update(conversionOutbox)
          .set({ status: 'delivered', deliveredAt: new Date().toISOString(), lastError: null })
          .where(eq(conversionOutbox.id, row.id))
        summary.delivered++
      }
    } catch (err) {
      const retry = row.retryCount + 1
      const status = retry >= MAX_RETRY ? 'failed' : 'pending'
      await db.update(conversionOutbox)
        .set({ status, retryCount: retry, lastError: err instanceof Error ? err.message : String(err) })
        .where(and(eq(conversionOutbox.id, row.id)))
      if (status === 'failed') summary.dlq++
      else summary.retried++
    }
  }

  return summary
}
