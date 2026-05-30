import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { BoeChangesService } from './boe-changes.service';

/**
 * Disparador del cron `check-boe-changes`.
 *
 * Sustituye al workflow de GitHub Actions `check-boe-changes.yml` (cron
 * `0 8 * * *`) que ejecutaba el endpoint Vercel con `maxDuration`. Aquí el
 * scheduler es in-app y el job corre sin límite de duración.
 */
@Injectable()
export class BoeChangesCron {
  private readonly logger = new Logger(BoeChangesCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: BoeChangesService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'check-boe-changes',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 90_000_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('0 8 * * *', { name: 'check-boe-changes', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl());
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron check-boe-changes disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.runCheck();
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'check-boe-changes',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          total: result.total,
          checked: result.checked,
          headUnchanged: result.headUnchanged,
          sizeChangeDetected: result.sizeChangeDetected,
          cachedOffset: result.cachedOffset,
          partial: result.partial,
          fullDownload: result.fullDownload,
          changesDetected: result.changesDetected,
          errors: result.errors,
          totalBytes: result.totalBytes,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron check-boe-changes falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'check-boe-changes',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
