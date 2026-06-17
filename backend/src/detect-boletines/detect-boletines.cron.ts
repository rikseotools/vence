import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { DetectBoletinesService } from './detect-boletines.service';

/**
 * Disparador del cron `detect-boletines`.
 *
 * Lee los sumarios de boletines oficiales (BOCYL, BOE) y descubre convocatorias
 * de ingreso C1/C2 nuevas → señales en `oep_detection_signals` (revisión en
 * /admin/oep-signals). Cubre el punto ciego que dejó el retiro de
 * `detect-regional-oeps` el 01/06/2026 (caso ULE Escala Administrativa).
 *
 * Schedule: L-V a las 06:30 UTC (antes que detect-generic-sources 08:00 y
 * detect-oep-llm 10:00, para que las señales nuevas estén listas a primera hora).
 */
@Injectable()
export class DetectBoletinesCron {
  private readonly logger = new Logger(DetectBoletinesCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: DetectBoletinesService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // L-V → threshold 4 días para tolerar fines de semana sin ejecución.
    heartbeatRegistry.register(
      'detect-boletines',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 345_600_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('30 6 * * 1-5', { name: 'detect-boletines', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'detect-boletines',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron detect-boletines disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'detect-boletines',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          boletines: result.boletines,
          daysScanned: result.daysScanned,
          candidatesDays: result.candidatesDays,
          signals: result.signals,
          errors: result.errors,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron detect-boletines falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'detect-boletines',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
