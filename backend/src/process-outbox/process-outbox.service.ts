import { Inject, Injectable, Logger } from '@nestjs/common';
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

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

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
