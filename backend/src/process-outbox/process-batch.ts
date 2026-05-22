// backend/src/process-outbox/process-batch.ts
//
// Procesador de un lote de eventos del outbox.
//
// Portado desde lib/outbox/processBatch.ts (repo principal).
//
// Garantías:
//  - Aislamiento entre workers vía `FOR UPDATE SKIP LOCKED` (row-level lock
//    estándar Postgres). Si dos workers corren a la vez se reservan filas
//    distintas y cada uno procesa su lote sin colisión.
//  - Cada evento se procesa de forma independiente. Un fallo NO aborta el
//    lote: se incrementa `attempts` + se guarda `last_error`. Si `attempts`
//    llega a MAX_ATTEMPTS la fila queda como dead-letter (ignorada por el
//    SELECT, conservada para inspección).
//  - El procesamiento ocurre dentro de UNA transacción que mantiene los
//    locks adquiridos por FOR UPDATE hasta el COMMIT. Los handlers DEBEN
//    ser idempotentes (UPSERT, no INSERT) y rápidos (sin I/O largo).

import { Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { type DrizzleDB } from '../db/database.module';
import { outboxEvents } from './process-outbox.schema';

const logger = new Logger('ProcessBatch');

export interface ProcessResult {
  /** Eventos leídos del outbox en este run. */
  fetched: number;
  /** Eventos procesados correctamente. */
  processed: number;
  /** Eventos cuyo handler lanzó error en este run. */
  failed: number;
  /** True si no se encontraron eventos pendientes (lote vacío). */
  skipped: boolean;
}

/**
 * Eventos con `attempts >= MAX_ATTEMPTS` se consideran dead-letter y dejan
 * de intentarse. La fila permanece en la tabla para inspección manual.
 */
export const MAX_ATTEMPTS = 10;

/**
 * Procesa hasta `limit` eventos pendientes del outbox. Devuelve estadísticas.
 *
 * Llamado por ProcessOutboxService.run() cada 5 minutos.
 */
export async function processOutboxBatch(
  db: DrizzleDB,
  limit: number = 200,
): Promise<ProcessResult> {
  // Todo el lote va dentro de una transacción para que los row locks
  // adquiridos por FOR UPDATE SKIP LOCKED se mantengan hasta el COMMIT.
  // Workers concurrentes verán filas distintas (SKIP LOCKED).
  return db.transaction(async (tx) => {
    const pending = await tx.execute<{
      id: string;
      event_type: string;
      payload: Record<string, unknown>;
      attempts: number;
    }>(
      sql`
        SELECT id, event_type, payload, attempts
        FROM ${outboxEvents}
        WHERE processed_at IS NULL
          AND attempts < ${MAX_ATTEMPTS}
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      `,
    );

    // postgres-js devuelve el ResultSet directamente como iterable de filas.
    const rows = pending as unknown as Array<{
      id: string;
      event_type: string;
      payload: Record<string, unknown>;
      attempts: number;
    }>;

    if (rows.length === 0) {
      return { fetched: 0, processed: 0, failed: 0, skipped: true };
    }

    let processed = 0;
    let failed = 0;

    for (const event of rows) {
      try {
        await dispatch(event.event_type, event.payload);

        // UPDATE de éxito en su propio try: si falla (p.ej. blip de
        // conexión), capturamos para que el resto del lote siga adelante.
        // El evento quedará pendiente y se reprocesará en el siguiente run.
        try {
          await tx.execute(
            sql`UPDATE ${outboxEvents} SET processed_at = now() WHERE id = ${event.id}::uuid`,
          );
          processed++;
        } catch (updateErr) {
          // El handler tuvo éxito pero la marca de procesado falló.
          // Lo contamos como failed para visibilidad — el handler tendrá
          // que ejecutarse de nuevo (de ahí la exigencia de idempotencia).
          logger.warn(
            `handler OK pero UPDATE processed_at falló para ${event.id}: ${updateErr instanceof Error ? updateErr.message : updateErr}`,
          );
          failed++;
        }
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);

        // UPDATE de error también blindado: un fallo aquí no debe matar el
        // batch. Si falla, attempts no se incrementa este run pero la fila
        // sigue pendiente; el siguiente run reintenta.
        try {
          await tx.execute(
            sql`
              UPDATE ${outboxEvents}
              SET attempts = attempts + 1, last_error = ${msg.slice(0, 1000)}
              WHERE id = ${event.id}::uuid
            `,
          );
        } catch (updateErr) {
          logger.warn(
            `no se pudo registrar fallo en ${event.id}: ${updateErr instanceof Error ? updateErr.message : updateErr}`,
          );
        }
      }
    }

    return { fetched: rows.length, processed, failed, skipped: false };
  });
}

/**
 * Despacha un evento al handler que le corresponde por event_type.
 *
 * Fase 2 paso 0: no hay handlers todavía. Cualquier event_type real será
 * marcado como fallido hasta que se añada su handler (lo que deja el evento
 * pendiente y permite drenarlo cuando llegue la migración del primer trigger).
 *
 * Para añadir un handler:
 *   case 'recalc_question_difficulty':
 *     await handleRecalcQuestionDifficulty(payload as PayloadFor<'recalc_question_difficulty'>)
 *     return
 */
async function dispatch(
  eventType: string,
  // El payload se usará cuando se registren handlers reales.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _payload: Record<string, unknown>,
): Promise<void> {
  switch (eventType) {
    case '__placeholder__':
      // Evento de prueba para tests del paso 0. No hace nada, marca el flujo OK.
      return;

    default:
      throw new Error(`No handler registered for event_type=${eventType}`);
  }
}
