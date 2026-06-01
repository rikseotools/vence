import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { jitter } from '../heartbeat/jitter.helper';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { NotifyCoverageUpgradesService } from './notify-coverage-upgrades.service';

/**
 * Cron `notify-coverage-upgrades` — diario 06:00 UTC.
 *
 * Tras el cron auto-promote-coverage (04:00 UTC) que promueve oposiciones,
 * este cron detecta los saltos de las últimas 24h y notifica a los usuarios
 * con target_oposicion = slug.
 *
 * Sprint F del roadmap docs/roadmap/oposiciones-coverage-level-y-promocion-automatica.md.
 */
@Injectable()
export class NotifyCoverageUpgradesCron {
  private readonly logger = new Logger(NotifyCoverageUpgradesCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: NotifyCoverageUpgradesService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // Diario 06:00 UTC → threshold 30h (1.25× interval). Grace 120s.
    heartbeatRegistry.register(
      'notify-coverage-upgrades',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 108_000_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('0 6 * * *', { name: 'notify-coverage-upgrades', timeZone: 'UTC' })
  async handle(): Promise<void> {
    // Jitter 0-60s para no colisionar con otros @ 06:00.
    await jitter(60_000);
    const startedAt = Date.now();
    await runWithHeartbeat(this, 'lastTickAtMs', async () => {
      try {
        const result = await this.service.run();
        await this.observability.emit({
          source: 'fargate',
          severity: 'info',
          eventType: 'cron_run',
          endpoint: 'notify-coverage-upgrades',
          durationMs: Date.now() - startedAt,
          metadata: {
            status: 'success',
            upgrades_detected: result.upgrades_detected,
            emails_sent: result.emails_sent,
            emails_skipped: result.emails_skipped,
            errors: result.errors,
          },
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(`notify-coverage-upgrades falló: ${errorMessage}`);
        await this.observability.emit({
          source: 'fargate',
          severity: 'error',
          eventType: 'cron_run',
          endpoint: 'notify-coverage-upgrades',
          durationMs: Date.now() - startedAt,
          errorMessage,
          metadata: { status: 'failure' },
        });
      }
    });
  }
}
