import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { CanaryPsychometricIntegrityService } from './canary-psychometric-integrity.service';

/**
 * Cron canary-psychometric-integrity — cada 15min cuenta sesiones psicotécnicas
 * "fantasma" (completadas con nota pero sin respuestas guardadas) creadas en la
 * última ventana. Si hay > 0 → REGRESIÓN de guardado → critical + alerta.
 *
 * Eventos:
 *   - canary_psychometric_integrity_ok (info)
 *   - psychometric_phantom_sessions (critical → alerta: guardado de respuestas roto)
 *   - canary_psychometric_integrity_failed (error — el propio canary falló)
 *   - cron_run (siempre, liveness)
 */
@Injectable()
export class CanaryPsychometricIntegrityCron {
  private readonly logger = new Logger(CanaryPsychometricIntegrityCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: CanaryPsychometricIntegrityService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'canary-psychometric-integrity',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 2_400_000, gracePeriodMs: 300_000 },
    );
  }

  @Cron('*/15 * * * *', { name: 'canary-psychometric-integrity', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'canary-psychometric-integrity',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron canary-psychometric-integrity disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();

      if ('error' in result) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'error',
          eventType: 'canary_psychometric_integrity_failed',
          endpoint: 'canary-psychometric-integrity',
          durationMs: result.durationMs,
          errorMessage: result.error,
          metadata: { cron: 'canary-psychometric-integrity' },
        });
      } else if (result.ok) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'info',
          eventType: 'canary_psychometric_integrity_ok',
          endpoint: 'canary-psychometric-integrity',
          durationMs: result.durationMs,
          metadata: { cron: 'canary-psychometric-integrity', windowMin: result.windowMin },
        });
      } else {
        // phantom > 0 → un guardado de respuestas está fallando AHORA.
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'critical',
          eventType: 'psychometric_phantom_sessions',
          endpoint: 'canary-psychometric-integrity',
          durationMs: result.durationMs,
          errorMessage: `${result.phantom} sesión(es) psicotécnica(s) completada(s) SIN respuestas guardadas en los últimos ${result.windowMin}min — el guardado está fallando (nota-fantasma).`,
          metadata: {
            cron: 'canary-psychometric-integrity',
            phantom: result.phantom,
            windowMin: result.windowMin,
          },
        });
      }

      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'canary-psychometric-integrity',
        durationMs: Date.now() - startedAt,
        metadata: { cron: 'canary-psychometric-integrity', status: 'completed' },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron canary-psychometric-integrity falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'canary-psychometric-integrity',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { cron: 'canary-psychometric-integrity', status: 'failure' },
      });
    }
  }
}
