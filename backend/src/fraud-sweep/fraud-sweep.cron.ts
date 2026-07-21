import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getLastTickMsAgo, runWithHeartbeat } from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { FraudSweepService } from './fraud-sweep.service';

/**
 * Disparador del barrido ANTIFRAUDE. Corre a las 03:15 UTC (tras content-health-sweep
 * de las 03:00), como job in-process sin límite de duración. Heartbeat diario: si deja
 * de tickar, salta `cron_overdue`. Solo DETECTA (no bloquea). Runbook: revisar-fraudes.md.
 */
@Injectable()
export class FraudSweepCron {
  private readonly logger = new Logger(FraudSweepCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: FraudSweepService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'fraud-sweep',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 90_000_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('15 3 * * *', { name: 'fraud-sweep', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'fraud-sweep',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron fraud-sweep disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'fraud-sweep',
        durationMs: Date.now() - startedAt,
        metadata: { status: 'success', ...result },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron fraud-sweep falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'fraud-sweep',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
