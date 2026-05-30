import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { ProcessOutboxService } from './process-outbox.service';

/**
 * Disparador del cron `process-outbox` (cada 5 min).
 *
 * Heartbeat tracking en HeartbeatRegistry → expuesto vía /health/crons.
 * Threshold 12 min (2.4× interval). Grace period 120s para bootstrap.
 */
@Injectable()
export class ProcessOutboxCron {
  private readonly logger = new Logger(ProcessOutboxCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: ProcessOutboxService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'process-outbox',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 720_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('*/5 * * * *', { name: 'process-outbox', timeZone: 'UTC' })
  async handle(): Promise<void> {
    this.logger.log('Cron process-outbox disparado');
    const startedAt = Date.now();
    await runWithHeartbeat(this, 'lastTickAtMs', async () => {
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
    });
  }
}
