import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getLastTickMsAgo, runWithHeartbeat } from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { ReconcileConvocatoriaService } from './reconcile-convocatoria.service';

/**
 * Cron `reconcile-convocatoria` (Fase 2): compara lo que MOSTRAMOS con lo que dicen los documentos
 * OFICIALES ya guardados en el corpus, y emite `content_health_findings` con la cita literal.
 *
 * Corre a las 10:00 UTC, DESPUÉS de detect-notas-convocatoria (09:30), que es quien llena el corpus.
 * Lee de `convocatoria_documentos.extracted_text`, no de la red: re-reconciliar no re-descarga nada.
 *
 * NUNCA auto-flip: el descuadre es un hallazgo para revisar, jamás un UPDATE.
 */
@Injectable()
export class ReconcileConvocatoriaCron {
  private readonly logger = new Logger(ReconcileConvocatoriaCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: ReconcileConvocatoriaService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'reconcile-convocatoria',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 172_800_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('0 10 * * *', { name: 'reconcile-convocatoria', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'reconcile-convocatoria',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron reconcile-convocatoria disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      await this.observability.emit({
        source: 'fargate',
        severity: result.descuadres > 0 ? 'warn' : 'info',
        eventType: 'cron_run',
        endpoint: 'reconcile-convocatoria',
        durationMs: Date.now() - startedAt,
        metadata: { status: 'success', ...result },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron reconcile-convocatoria falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'reconcile-convocatoria',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
