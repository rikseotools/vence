import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { processOutboxBatch, type ProcessResult } from './process-batch';

/**
 * Servicio que orquesta el procesamiento del outbox.
 *
 * Encapsula la lógica de run/logging para que el cron solo dispare y gestione
 * errores sin mezclar detalles de procesamiento.
 */
@Injectable()
export class ProcessOutboxService {
  private readonly logger = new Logger(ProcessOutboxService.name);

  /** Tamaño del lote por ejecución. 200 eventos es suficiente para un cron de 5 min. */
  private readonly batchSize = 200;

  /** Retención de filas YA procesadas (solo valor forense). Sin poda crecían sin
   *  techo: 514k filas / 1,7 GB acumuladas desde 2026-05 → bloat. */
  private readonly processedRetentionDays = 7;
  /** Máx. filas procesadas a podar por ejecución (drena el backlog en varias corridas
   *  sin lock largo; una vez drenado, la mayoría de runs borran ~0). */
  private readonly pruneBatch = 5000;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Borra en lote las filas procesadas más antiguas que la retención. Idempotente
   *  y acotado. Devuelve cuántas borró. Defensivo: no rompe el run si falla. */
  private async pruneProcessed(): Promise<number> {
    try {
      const res = await this.db.execute(sql`
        DELETE FROM test_questions_outbox
        WHERE ctid IN (
          SELECT ctid FROM test_questions_outbox
          WHERE processed_at IS NOT NULL
            AND processed_at < now() - interval '${sql.raw(String(this.processedRetentionDays))} days'
          LIMIT ${this.pruneBatch}
        )
      `);
      const n = (res as unknown as { rowCount?: number }).rowCount ?? res.length ?? 0;
      if (n > 0) this.logger.log(`Outbox: podadas ${n} filas procesadas > ${this.processedRetentionDays}d`);
      return n;
    } catch (err) {
      this.logger.error(`Poda de outbox falló (no bloquea el run): ${err instanceof Error ? err.message : err}`);
      return 0;
    }
  }

  /**
   * Procesa el siguiente lote del outbox y registra estadísticas.
   *
   * No lanza excepciones — los errores se loguean y se propagan en el
   * resultado para que el cron decida cómo actuar.
   */
  async run(): Promise<ProcessResult> {
    const startTime = Date.now();
    this.logger.log('Iniciando proceso de outbox...');

    const result = await processOutboxBatch(this.db, this.batchSize);

    // Poda de procesadas (bloat). Se ejecuta SIEMPRE, incluso sin pendientes, para
    // drenar el backlog histórico (514k filas acumuladas). No cuenta como fallo.
    await this.pruneProcessed();

    const durationMs = Date.now() - startTime;

    if (result.skipped) {
      this.logger.log(`Sin eventos pendientes (${durationMs}ms)`);
      return result;
    }

    if (result.fetched > 0 && result.processed === 0) {
      this.logger.error(
        `Todos los eventos del lote fallaron: ${result.failed}/${result.fetched} (${durationMs}ms)`,
      );
    } else {
      this.logger.log(
        `Procesados ${result.processed}/${result.fetched} eventos` +
          (result.failed > 0 ? `, ${result.failed} fallidos` : '') +
          ` (${durationMs}ms)`,
      );
    }

    return result;
  }
}
