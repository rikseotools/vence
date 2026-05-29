import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ObservabilityService } from '../observability/observability.service';
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
    private readonly observability: ObservabilityService,
  ) {}

  @Cron('0 2,8,14,20 * * *', {
    name: 'process-verification-queue',
    timeZone: 'UTC',
  })
  async handle(): Promise<void> {
    this.logger.log('Cron process-verification-queue disparado');
    const startedAt = Date.now();
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
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'process-verification-queue',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          taskId: result.taskId,
          topicId: result.topicId,
          batchesProcessed: result.batchesProcessed,
          processedThisRun: result.processedThisRun,
          processedTotal: result.processedTotal,
          total: result.total,
          successful: result.successful,
          failed: result.failed,
          isComplete: result.isComplete,
          billingError: result.billingError,
          executionTimeMs: result.executionTimeMs,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Cron process-verification-queue falló: ${errorMessage}`,
      );
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'process-verification-queue',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
