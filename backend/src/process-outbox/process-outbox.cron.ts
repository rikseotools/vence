import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ObservabilityService } from '../observability/observability.service';
import { ProcessOutboxService } from './process-outbox.service';

/**
 * Disparador del cron `process-outbox`.
 *
 * Sustituye al endpoint Vercel `/api/cron/process-outbox` llamado por
 * GitHub Actions o vercel.json. Aquí el scheduler es in-app y el job corre
 * sin límite de duración.
 *
 * Cadencia: cada 5 minutos (* /5 * * * *), igual que la cadencia objetivo del
 * cron original de Vercel.
 *
 * `FOR UPDATE SKIP LOCKED` en processOutboxBatch garantiza que si dos
 * instancias del cron se solapan por algún motivo, cada una reserva filas
 * distintas sin colisión.
 */
@Injectable()
export class ProcessOutboxCron {
  private readonly logger = new Logger(ProcessOutboxCron.name);

  constructor(
    private readonly service: ProcessOutboxService,
    private readonly observability: ObservabilityService,
  ) {}

  @Cron('*/5 * * * *', { name: 'process-outbox', timeZone: 'UTC' })
  async handle(): Promise<void> {
    this.logger.log('Cron process-outbox disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'process-outbox',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          fetched: result.fetched,
          processed: result.processed,
          failed: result.failed,
          skipped: result.skipped,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron process-outbox falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'process-outbox',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
