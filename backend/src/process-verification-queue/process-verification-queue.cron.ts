import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ProcessVerificationQueueService } from './process-verification-queue.service';

/**
 * Disparador del cron `process-verification-queue`.
 *
 * Sustituye al endpoint Vercel `GET /api/cron/process-verification-queue`
 * invocado por GitHub Actions. Se ejecuta cuatro veces al día (2h, 8h, 14h,
 * 20h UTC) para mantener la cola de verificaciones drenada durante el día.
 *
 * El timeout de 50 s por ejecución sigue siendo relevante para no monopolizar
 * el event loop; si la tarea no termina en una pasada, continuará en la
 * siguiente ejecución.
 */
@Injectable()
export class ProcessVerificationQueueCron {
  private readonly logger = new Logger(ProcessVerificationQueueCron.name);

  constructor(
    private readonly service: ProcessVerificationQueueService,
  ) {}

  @Cron('0 2,8,14,20 * * *', {
    name: 'process-verification-queue',
    timeZone: 'UTC',
  })
  async handle(): Promise<void> {
    this.logger.log('Cron process-verification-queue disparado');
    try {
      const result = await this.service.run();
      this.logger.log(
        `Cron completado — taskId=${result.taskId ?? 'ninguna'}, ` +
          `batches=${result.batchesProcessed}, ` +
          `procesadas=${result.processedThisRun}, ` +
          `total=${result.processedTotal}/${result.total}, ` +
          `completa=${result.isComplete}, ` +
          `billingError=${result.billingError}, ` +
          `${result.executionTimeMs}ms`,
      );
    } catch (error) {
      this.logger.error(
        `Cron process-verification-queue falló: ${
          error instanceof Error ? error.stack : String(error)
        }`,
      );
    }
  }
}
