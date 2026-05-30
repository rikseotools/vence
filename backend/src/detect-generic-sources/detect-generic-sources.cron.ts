import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { DetectGenericSourcesService } from './detect-generic-sources.service';

/**
 * Disparador del cron `detect-generic-sources`.
 *
 * Equivale al endpoint `app/api/cron/detect-generic-sources/route.ts`.
 * Schedule: L-V a las 08:00 UTC.
 */
@Injectable()
export class DetectGenericSourcesCron {
  private readonly logger = new Logger(DetectGenericSourcesCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: DetectGenericSourcesService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // L-V daily → threshold 4 días para tolerar fines de semana sin ejecución.
    heartbeatRegistry.register(
      'detect-generic-sources',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 345_600_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('0 8 * * 1-5', { name: 'detect-generic-sources', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl());
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron detect-generic-sources disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'detect-generic-sources',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          total: result.total,
          checked: result.checked,
          hashChanged: result.hashChanged,
          signals: result.signals,
          errors: result.errors,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron detect-generic-sources falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'detect-generic-sources',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
