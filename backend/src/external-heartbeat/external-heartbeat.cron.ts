import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ObservabilityService } from '../observability/observability.service';
import { ExternalHeartbeatService } from './external-heartbeat.service';

/**
 * Cron external-heartbeat — ping a servicio externo cada 5min.
 *
 * Eventos:
 *   - external_heartbeat_ok (info — ping recibido por externo)
 *   - external_heartbeat_failed (warn — el externo NO recibió ping; pero
 *     no es critical porque el ALARM viene del externo, no de aquí)
 *   - external_heartbeat_skipped (warn — HEARTBEAT_URL no configurada)
 *   - cron_run (siempre, liveness)
 *
 * IMPORTANTE: la alarma operativa de "backend caído" la dispara el
 * servicio externo (Healthchecks.io), NO una RULE local. Por eso el
 * fallo aquí es warn (operativo: investigar) y no critical (no añade
 * info nueva, lo critical lo manda el externo).
 */
@Injectable()
export class ExternalHeartbeatCron {
  private readonly logger = new Logger(ExternalHeartbeatCron.name);

  constructor(
    private readonly service: ExternalHeartbeatService,
    private readonly observability: ObservabilityService,
  ) {}

  @Cron('*/5 * * * *', { name: 'external-heartbeat', timeZone: 'UTC' })
  async handle(): Promise<void> {
    this.logger.log('Cron external-heartbeat disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();

      if ('skipped' in result) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'warn',
          eventType: 'external_heartbeat_skipped',
          endpoint: 'external-heartbeat',
          durationMs: result.durationMs,
          metadata: { cron: 'external-heartbeat', reason: result.reason },
        });
      } else if (result.ok) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'info',
          eventType: 'external_heartbeat_ok',
          endpoint: 'external-heartbeat',
          durationMs: result.durationMs,
          httpStatus: result.httpStatus,
          metadata: { cron: 'external-heartbeat' },
        });
      } else {
        // WARN (no critical) — el critical lo dispara el servicio externo.
        // Aquí solo registramos que el ping desde nuestro lado falló;
        // útil para diagnóstico pero no es la alarma operativa.
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'warn',
          eventType: 'external_heartbeat_failed',
          endpoint: 'external-heartbeat',
          durationMs: result.durationMs,
          httpStatus: result.httpStatus,
          errorMessage: result.errorMessage,
          metadata: { cron: 'external-heartbeat' },
        });
      }

      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'external-heartbeat',
        durationMs: Date.now() - startedAt,
        metadata: { cron: 'external-heartbeat', status: 'completed' },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron external-heartbeat falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'external-heartbeat',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { cron: 'external-heartbeat', status: 'failure' },
      });
    }
  }
}
