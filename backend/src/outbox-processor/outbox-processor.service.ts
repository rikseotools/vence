// Worker procesador del outbox de test_questions.
//
// Lee batches de eventos pendientes (`processed_at IS NULL`) de la tabla
// `test_questions_outbox`, los dispatch a los handlers correspondientes,
// y marca `processed_at = NOW()` en éxito. En caso de error incrementa
// `retry_count`; si alcanza `maxRetries` el evento queda en DLQ (mismo
// estado: `processed_at` NULL, pero `retry_count >= maxRetries`).
//
// FASE 1.2 (commit actual): este worker NO ejecuta handlers reales todavía.
// Es un "no-op processor" que valida la infra completa (polling, batch,
// retry, DLQ, observability). Los handlers reales se añaden en Fases 1.3-1.4
// del roadmap `docs/roadmap/sprint-outbox-test-questions.md` con shadow mode
// + paridad bit-a-bit antes de DROP de cada trigger SQL original.

import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { UserArticleStatsHandler } from './handlers/user-article-stats.handler';
import {
  BatchResult,
  DEFAULT_CONFIG,
  OutboxEvent,
  OutboxEventSchema,
  OutboxProcessorConfig,
} from './outbox-processor.schema';

@Injectable()
export class OutboxProcessorService {
  private readonly logger = new Logger(OutboxProcessorService.name);
  private readonly config: OutboxProcessorConfig = DEFAULT_CONFIG;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly userArticleStatsHandler: UserArticleStatsHandler,
  ) {}

  /**
   * Procesa un batch de eventos del outbox.
   *
   * Estrategia de concurrencia: `SELECT FOR UPDATE SKIP LOCKED` permite
   * que múltiples workers paralelos lean el outbox sin pisarse. Cada
   * worker se queda con un subset disjunto de eventos pendientes.
   *
   * Estrategia de retry: cada fallo incrementa `retry_count` y guarda
   * `error_message`. Al alcanzar `maxRetries` el evento queda en DLQ
   * (sigue con `processed_at = NULL` y `retry_count >= maxRetries`,
   * el índice `idx_outbox_errors` lo cubre para inspección).
   */
  async processBatch(): Promise<BatchResult> {
    const startedAt = Date.now();
    const result: BatchResult = {
      size: 0,
      succeeded: 0,
      failed: 0,
      movedToDlq: 0,
      durationMs: 0,
    };

    try {
      // 1. Leer batch con FOR UPDATE SKIP LOCKED (transacción de lectura)
      //    Como FOR UPDATE requiere transacción explícita, usamos sql.begin.
      const events = await this.db.transaction(async (tx) => {
        const rows = await tx.execute(sql`
          SELECT id, test_question_id, event_type, payload, old_payload, user_id,
                 created_at::text AS created_at,
                 processed_at::text AS processed_at,
                 retry_count, error_message
          FROM public.test_questions_outbox
          WHERE processed_at IS NULL
            AND retry_count < ${this.config.maxRetries}
          ORDER BY created_at
          LIMIT ${this.config.batchSize}
          FOR UPDATE SKIP LOCKED
        `);
        return rows as unknown as OutboxEvent[];
      });

      result.size = events.length;
      if (events.length === 0) {
        result.durationMs = Date.now() - startedAt;
        return result;
      }

      // 2. Procesar cada evento (en serie por simplicidad inicial;
      //    en Fase 1.4 puede paralelizarse con Promise.all si necesario)
      for (const rawEvent of events) {
        try {
          const parsed = OutboxEventSchema.safeParse(rawEvent);
          if (!parsed.success) {
            const errMsg = `Zod parse failed: ${parsed.error.issues[0]?.message}`;
            await this.markFailed(rawEvent.id, errMsg);
            result.failed += 1;
            // Si alcanzó maxRetries con este intento, contamos DLQ
            if (rawEvent.retry_count + 1 >= this.config.maxRetries) {
              result.movedToDlq += 1;
            }
            continue;
          }

          // FASE 1.3: dispatch a handlers (shadow mode si SHADOW_HANDLERS_ENABLED=true).
          // Cada handler es responsable de su propio idempotency check.
          // Si SHADOW_HANDLERS_ENABLED=false, los handlers son no-op y solo
          // validamos el payload.
          await this.dispatch(parsed.data);
          await this.markProcessed(parsed.data.id);
          result.succeeded += 1;
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          this.logger.error(`Event ${rawEvent.id} failed: ${errMsg}`);
          await this.markFailed(rawEvent.id, errMsg);
          result.failed += 1;
          if (rawEvent.retry_count + 1 >= this.config.maxRetries) {
            result.movedToDlq += 1;
          }
        }
      }
    } catch (e) {
      // Si la propia query batch falla, lo logueamos y devolvemos lo poco
      // que tengamos. NO romper el cron — siguiente tick reintenta.
      const errMsg = e instanceof Error ? e.message : String(e);
      this.logger.error(`processBatch top-level error: ${errMsg}`);
    }

    result.durationMs = Date.now() - startedAt;
    return result;
  }

  /**
   * Dispatch del evento a todos los handlers registrados.
   *
   * SHADOW MODE: cada handler internamente comprueba SHADOW_HANDLERS_ENABLED.
   * Si el flag está OFF, el handler retorna inmediatamente sin tocar BD.
   *
   * En Fase 1.4 se añadirán 19 handlers más (user_daily_stats, user_hourly_stats,
   * etc.) siguiendo el mismo patrón. Cada uno con su tabla shadow propia.
   */
  private async dispatch(event: OutboxEvent): Promise<void> {
    // Todos los handlers se ejecutan en paralelo (cada uno tiene su propia BD txn)
    await Promise.all([
      this.userArticleStatsHandler.handle(event),
      // Fase 1.4: añadir aquí
      // this.userDailyStatsHandler.handle(event),
      // this.userHourlyStatsHandler.handle(event),
      // this.userDifficultyStatsHandler.handle(event),
      // this.userStatsSummaryHandler.handle(event),
      // this.userStatsTotalTimeHandler.handle(event),
      // this.userQuestionHistoryV2Handler.handle(event),
      // this.lawQuestionDifficultyHandler.handle(event),
      // this.questionFirstAttemptsHandler.handle(event),
    ]);
  }

  private async markProcessed(eventId: bigint): Promise<void> {
    await this.db.execute(sql`
      UPDATE public.test_questions_outbox
      SET processed_at = NOW()
      WHERE id = ${eventId}
    `);
  }

  private async markFailed(eventId: bigint, errorMessage: string): Promise<void> {
    await this.db.execute(sql`
      UPDATE public.test_questions_outbox
      SET retry_count = retry_count + 1,
          error_message = ${errorMessage.slice(0, 1000)}
      WHERE id = ${eventId}
    `);
  }

  /**
   * Métricas del worker para alertas/dashboard.
   * Devuelve estado actual del outbox (lag, pendientes, DLQ).
   */
  async getStats(): Promise<{
    pending: number;
    oldestPendingAgeSeconds: number | null;
    dlq: number;
  }> {
    const rows = await this.db.execute<{
      pending: bigint;
      oldest_age: number | null;
      dlq: bigint;
    }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE processed_at IS NULL AND retry_count < ${this.config.maxRetries})::bigint AS pending,
        EXTRACT(EPOCH FROM (NOW() - MIN(created_at) FILTER (WHERE processed_at IS NULL AND retry_count < ${this.config.maxRetries}))) AS oldest_age,
        COUNT(*) FILTER (WHERE processed_at IS NULL AND retry_count >= ${this.config.maxRetries})::bigint AS dlq
      FROM public.test_questions_outbox
    `);
    const row = (rows as unknown as Array<{
      pending: string | number;
      oldest_age: number | null;
      dlq: string | number;
    }>)[0];
    return {
      pending: Number(row?.pending ?? 0),
      oldestPendingAgeSeconds: row?.oldest_age != null ? Number(row.oldest_age) : null,
      dlq: Number(row?.dlq ?? 0),
    };
  }
}
