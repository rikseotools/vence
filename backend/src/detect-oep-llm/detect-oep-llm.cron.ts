import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { DetectOepLlmService } from './detect-oep-llm.service';

/**
 * Disparador del cron `detect-oep-llm`.
 *
 * Equivale al endpoint `app/api/cron/detect-oep-llm/route.ts`.
 * Schedule: L-V a las 10:00 UTC.
 */
@Injectable()
export class DetectOepLlmCron {
  private readonly logger = new Logger(DetectOepLlmCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: DetectOepLlmService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'detect-oep-llm',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 345_600_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('0 10 * * 1-5', { name: 'detect-oep-llm', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl());
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron detect-oep-llm disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'detect-oep-llm',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          total: result.total,
          scanned: result.scanned,
          withExtraction: result.withExtraction,
          signals: result.signals,
          errors: result.errors,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron detect-oep-llm falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'detect-oep-llm',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
