import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { CheckSeguimientoService } from './check-seguimiento.service';

/**
 * Disparador del cron `check-seguimiento`.
 *
 * Sustituye al workflow de GitHub Actions `check-seguimiento.yml`
 * (cron `0 9 * * 1-5`) que ejecutaba el endpoint Vercel con `maxDuration=300`.
 * Aquí el scheduler es in-app y el job corre sin límite de duración.
 *
 * Horario: L-V a las 09:00 UTC (igual que el workflow anterior).
 */
@Injectable()
export class CheckSeguimientoCron {
  private readonly logger = new Logger(CheckSeguimientoCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: CheckSeguimientoService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // L-V daily → threshold 4 días.
    heartbeatRegistry.register(
      'check-seguimiento',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 345_600_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('0 9 * * 1-5', { name: 'check-seguimiento', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'check-seguimiento',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron check-seguimiento disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'check-seguimiento',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          total: result.total,
          checked: result.checked,
          changed: result.changed,
          errors: result.errors,
          unchanged: result.unchanged,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron check-seguimiento falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'check-seguimiento',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
