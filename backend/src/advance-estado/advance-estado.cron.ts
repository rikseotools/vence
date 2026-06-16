import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { AdvanceEstadoService } from './advance-estado.service';

/**
 * Disparador del cron `advance-estado`.
 *
 * Avanza `estado_proceso` de las oposiciones cuando un plazo/fecha vence,
 * para que no se acumulen estados stale (p.ej. `inscripcion_abierta` con
 * plazo ya cerrado). Corre a las 06:30 UTC, ANTES de `detect-timeline-silence`
 * (07:00) y `check-seguimiento` (09:00), de modo que esos sensores vean ya
 * los estados al día.
 */
@Injectable()
export class AdvanceEstadoCron {
  private readonly logger = new Logger(AdvanceEstadoCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: AdvanceEstadoService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'advance-estado',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 90_000_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('30 6 * * *', { name: 'advance-estado', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'advance-estado',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron advance-estado disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      if (result.advanced > 0) {
        this.logger.log(
          `Estados avanzados: ${result.changes
            .map((c) => `${c.slug} ${c.from}→${c.to}`)
            .join(', ')}`,
        );
      }
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'advance-estado',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          scanned: result.scanned,
          advanced: result.advanced,
          changes: result.changes,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron advance-estado falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'advance-estado',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
