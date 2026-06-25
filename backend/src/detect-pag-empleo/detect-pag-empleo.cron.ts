import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { DetectPagEmpleoService } from './detect-pag-empleo.service';

/**
 * Disparador del cron `detect-pag-empleo`.
 *
 * Lee el Buscador del Punto de Acceso General (administracion.gob.es), un
 * agregador NACIONAL (Estado + autonómico + LOCAL) de convocatorias de empleo
 * público, filtrando grupo C1/C2 y "Plazo Abierto" → señales en
 * `oep_detection_signals` (revisión en /admin/oep-signals). Cierra el punto
 * ciego de descubrimiento que dejaba `detect-boletines` (solo BOCYL + BOE).
 *
 * Schedule: L-V 06:00 UTC (antes que detect-boletines 06:30 y el resto).
 */
@Injectable()
export class DetectPagEmpleoCron {
  private readonly logger = new Logger(DetectPagEmpleoCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: DetectPagEmpleoService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // L-V → threshold 4 días para tolerar fines de semana sin ejecución.
    heartbeatRegistry.register(
      'detect-pag-empleo',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 345_600_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('0 6 * * 1-5', { name: 'detect-pag-empleo', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'detect-pag-empleo',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron detect-pag-empleo disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'detect-pag-empleo',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          fetched: result.fetched,
          relevant: result.relevant,
          signals: result.signals,
          matched: result.matched,
          errors: result.errors,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron detect-pag-empleo falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'detect-pag-empleo',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
