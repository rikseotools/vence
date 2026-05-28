// Cron del worker outbox-processor.
//
// Tick cada 1 segundo (configurable). Cada tick procesa un batch de hasta
// 100 eventos del outbox con `FOR UPDATE SKIP LOCKED` para tolerar múltiples
// instancias paralelas.
//
// Métricas emitidas a `observable_events` (source=fargate):
//   - `cron_run` por cada tick (success/error con stats del batch)
//   - `outbox_dlq` cuando un evento entra en DLQ (retry_count >= maxRetries)
//   - `outbox_lag_warning` cuando el evento más antiguo pendiente tiene > 30s
//
// FASE 1.2: el cron procesa batches pero sin handlers reales (no-op).
// Sirve para validar la infra en producción antes de añadir lógica.

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ObservabilityService } from '../observability/observability.service';
import { OutboxProcessorService } from './outbox-processor.service';

@Injectable()
export class OutboxProcessorCron {
  private readonly logger = new Logger(OutboxProcessorCron.name);
  /** Umbral de lag en segundos por encima del cual emitimos warning. */
  private readonly LAG_WARNING_THRESHOLD_SECONDS = 30;

  constructor(
    private readonly service: OutboxProcessorService,
    private readonly observability: ObservabilityService,
  ) {}

  /**
   * Tick cada segundo. `@Cron('* * * * * *')` = cada segundo en estilo cron
   * de NestJS con segundos (campo extra al inicio).
   *
   * Si un tick tarda > 1s, el siguiente NO se solapará porque `@Cron` por
   * defecto serializa ejecuciones del mismo nombre.
   */
  @Cron(CronExpression.EVERY_SECOND, { name: 'outbox-processor', timeZone: 'UTC' })
  async tick(): Promise<void> {
    const startedAt = Date.now();
    try {
      const result = await this.service.processBatch();

      // Si el batch fue NO vacío, lo logueamos.
      if (result.size > 0) {
        this.logger.log(
          `Batch ${result.size} eventos: ${result.succeeded} OK, ${result.failed} fail` +
            (result.movedToDlq > 0 ? `, ${result.movedToDlq} → DLQ` : '') +
            ` (${result.durationMs}ms)`,
        );

        // Emitir cada batch no vacío como observable_event (para SLO de lag).
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: result.failed > 0 ? 'warn' : 'info',
          eventType: 'cron_run',
          endpoint: 'outbox-processor',
          durationMs: result.durationMs,
          metadata: {
            status: result.failed > 0 ? 'partial_failure' : 'success',
            size: result.size,
            succeeded: result.succeeded,
            failed: result.failed,
            movedToDlq: result.movedToDlq,
          },
        });
      }

      // Check de lag cada 10 ticks (~10s) para no martillar BD.
      // Usamos timestamp por simplicidad — un counter int sería marginalmente
      // más eficiente pero introduce estado mutable en el servicio.
      if (Math.floor(startedAt / 1000) % 10 === 0) {
        const stats = await this.service.getStats();
        if (
          stats.oldestPendingAgeSeconds != null &&
          stats.oldestPendingAgeSeconds > this.LAG_WARNING_THRESHOLD_SECONDS
        ) {
          this.logger.warn(
            `Outbox lag elevado: ${stats.oldestPendingAgeSeconds.toFixed(0)}s ` +
              `(pending=${stats.pending}, dlq=${stats.dlq})`,
          );
          this.observability.emitFireAndForget({
            source: 'fargate',
            severity: 'warn',
            eventType: 'outbox_lag_warning',
            endpoint: 'outbox-processor',
            durationMs: 0,
            metadata: {
              oldestPendingAgeSeconds: stats.oldestPendingAgeSeconds,
              pending: stats.pending,
              dlq: stats.dlq,
            },
          });
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron outbox-processor falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'outbox-processor',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
