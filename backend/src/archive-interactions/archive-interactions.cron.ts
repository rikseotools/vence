import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { ArchiveInteractionsService } from './archive-interactions.service';

/**
 * Disparador del cron `archive-interactions`.
 *
 * Sustituye al workflow de GitHub Actions que ejecutaba el endpoint Vercel con
 * `maxDuration: 300`. Aquí el scheduler es in-app y corre sin límite de tiempo.
 *
 * Horario: 03:30 UTC (fuera de pico de usuarios).
 */
@Injectable()
export class ArchiveInteractionsCron {
  private readonly logger = new Logger(ArchiveInteractionsCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: ArchiveInteractionsService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'archive-interactions',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 90_000_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('30 3 * * *', { name: 'archive-interactions', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'archive-interactions',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron archive-interactions disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'archive-interactions',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          archived: result.archived,
          deleted: result.deleted,
          batches: result.batches,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron archive-interactions falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'archive-interactions',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
