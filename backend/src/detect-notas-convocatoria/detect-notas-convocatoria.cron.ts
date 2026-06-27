import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { DetectNotasConvocatoriaService } from './detect-notas-convocatoria.service';

/**
 * Cron `detect-notas-convocatoria`: lee a diario las notas informativas de cada
 * oposición y deja en `convocatoria_notas` lo que afecte a las preguntas
 * (versiones de software, fechas, criterios) para que Claude lo triaje.
 * Schedule: a diario 09:30 UTC (tras check-seguimiento / detect-oep-llm).
 */
@Injectable()
export class DetectNotasConvocatoriaCron {
  private readonly logger = new Logger(DetectNotasConvocatoriaCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: DetectNotasConvocatoriaService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'detect-notas-convocatoria',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 172_800_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('30 9 * * *', { name: 'detect-notas-convocatoria', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'detect-notas-convocatoria',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron detect-notas-convocatoria disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      await this.observability.emit({
        source: 'fargate',
        severity: result.needsManual > 0 ? 'warn' : 'info',
        eventType: 'cron_run',
        endpoint: 'detect-notas-convocatoria',
        durationMs: Date.now() - startedAt,
        metadata: { status: 'success', ...result },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron detect-notas-convocatoria falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'detect-notas-convocatoria',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
