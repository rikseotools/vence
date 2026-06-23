import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { jitter } from '../heartbeat/jitter.helper';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { ConversionDrainService } from './conversion-drain.service';

/**
 * Disparador FIABLE del drain de conversiones (cada 2 min).
 *
 * Reemplaza el cron de GitHub Actions (.github/workflows/conversion-outbox.yml)
 * que, pese a declararse para cada 15 min, disparaba de hecho cada ~2,6h
 * (mediana, hasta 6h):
 * GHA descarta scheduled workflows bajo carga. Ese hueco era la causa raíz
 * DOMINANTE de las conversiones en DLQ (incidente 19-23/06):
 *   - gap (2,6h) >> TTL del token OAuth (~1h) → el token cacheado del proceso
 *     ECS caliente siempre caducaba → cada run re-pedía token a oauth2.googleapis.com
 *     → exposición máxima al "Premature close" intermitente del egress de prod.
 *   - los reintentos (backoff de la Fase 1) se espaciaban horas, no minutos.
 * Un scheduler fiable cada 2 min mantiene el token caliente (cache-hit casi
 * siempre) y dispara los reintentos a tiempo.
 *
 * Heartbeat threshold 5 min (2.5× interval). Grace 120s (bootstrap post-deploy).
 */
@Injectable()
export class ConversionDrainCron {
  private readonly logger = new Logger(ConversionDrainCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: ConversionDrainService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'conversion-drain',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 300_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('*/2 * * * *', { name: 'conversion-drain', timeZone: 'UTC' })
  async handle(): Promise<void> {
    // Jitter 0-5s para no colisionar con otros crons al segundo 0 del minuto.
    await jitter(5_000);
    const startedAt = Date.now();
    await runWithHeartbeat(
      this,
      'lastTickAtMs',
      async () => {
        const result = await this.service.run();
        if (result.ok) {
          this.observability.emitFireAndForget({
            source: 'fargate',
            severity: (result.dlq ?? 0) > 0 ? 'warn' : 'info',
            eventType: 'cron_run',
            endpoint: 'conversion-drain',
            durationMs: Date.now() - startedAt,
            metadata: {
              status: 'success',
              scanned: result.scanned,
              delivered: result.delivered,
              validated: result.validated,
              retried: result.retried,
              dlq: result.dlq,
              skipped: result.skipped,
            },
          });
        } else {
          const errorMessage = result.errorMessage ?? result.skippedReason ?? 'unknown';
          this.logger.error(`Cron conversion-drain falló: ${errorMessage}`);
          this.observability.emitFireAndForget({
            source: 'fargate',
            severity: 'error',
            eventType: 'cron_run',
            endpoint: 'conversion-drain',
            durationMs: Date.now() - startedAt,
            httpStatus: result.httpStatus,
            errorMessage,
            metadata: { status: 'failure' },
          });
        }
      },
      { name: 'conversion-drain', observability: this.observability },
    );
  }
}
