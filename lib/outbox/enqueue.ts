// lib/outbox/enqueue.ts
// Helper para encolar eventos en outbox_events DENTRO de una transacción.
//
// Patrón de uso correcto:
//
//   await db.transaction(async (tx) => {
//     await tx.insert(testQuestions).values(...)
//     await enqueueEvent(tx, {
//       eventType: 'recalc_question_difficulty',
//       payload: { questionId: '...' },
//     })
//   })
//
// Si la transacción rollbackea (p.ej. constraint violation en testQuestions),
// el evento DESAPARECE — nunca se procesa un evento "fantasma" de una escritura
// que no llegó a comitearse. Esa atomicidad es la garantía clave del patrón
// outbox.
//
// NO uses esta función fuera de una transacción salvo cuando el evento sea
// "best-effort" y la atomicidad no importe.

import type { PgTransaction } from 'drizzle-orm/pg-core'
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import { outboxEvents } from '@/db/schema'
import type { OutboxEvent } from './types'

// Tipo del primer argumento de `db.transaction((tx) => ...)` con nuestro schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTx = PgTransaction<PostgresJsQueryResultHKT, Record<string, any>, ExtractTablesWithRelations<Record<string, never>>>

/**
 * Encola un evento dentro de la transacción dada.
 *
 * @param tx     Transacción Drizzle activa (obligatorio — no se permite encolar
 *               fuera de transacción para preservar atomicidad).
 * @param event  Evento tipado: { eventType, payload }.
 *
 * @returns id del evento insertado (uuid).
 */
export async function enqueueEvent(
  tx: AnyTx,
  event: OutboxEvent,
): Promise<string> {
  const [row] = await tx
    .insert(outboxEvents)
    .values({
      eventType: event.eventType,
      payload: event.payload as Record<string, unknown>,
    })
    .returning({ id: outboxEvents.id })

  if (!row?.id) {
    throw new Error('enqueueEvent: insert did not return an id')
  }
  return row.id
}
