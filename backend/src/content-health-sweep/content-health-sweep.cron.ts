import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { ContentHealthSweepService } from './content-health-sweep.service';

/**
 * Disparador del barrido de salud del contenido/app.
 *
 * PORT del `scripts/health-sweep.cjs` que NUNCA tuvo scheduler (se quedó fuera de
 * la migración GHA→Fargate del 07/07 → el panel `/admin/contenido` quedaba
 * congelado, incidente 19/07). Corre a las 03:00 UTC (~05:00 Madrid, hueco sin
 * colisión con los crons de 04:00/05:00), como job pesado in-process sin límite
 * de duración. Heartbeat diario: si deja de tickar, salta `cron_overdue` en el
 * propio panel de salud → el vigilante tiene quien lo vigile.
 */
@Injectable()
export class ContentHealthSweepCron {
  private readonly logger = new Logger(ContentHealthSweepCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: ContentHealthSweepService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // Daily cron → threshold 25h (tolera 1h de retraso).
    heartbeatRegistry.register(
      'content-health-sweep',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 90_000_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('0 3 * * *', { name: 'content-health-sweep', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'content-health-sweep',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron content-health-sweep disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'content-health-sweep',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          total: result.total,
          appError: result.appError,
          contentError: result.contentError,
          contentWarn: result.contentWarn,
          wrote: result.wrote,
          emailsSent: result.emailsSent,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron content-health-sweep falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'content-health-sweep',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
