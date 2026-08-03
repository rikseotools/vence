import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { FeedbackEmailReconciliationService } from './feedback-email-reconciliation.service';

/**
 * Cron `feedback-email-reconciliation` ([T-501]).
 *
 * Gemelo de `dispute-email-reconciliation` para el otro canal por el que le contestamos a
 * una persona. Cada hora verifica la invariante "respuesta de admin ⇒ email enviado (o
 * salto legítimo)". Emite:
 *   - `invariant_violation` (severity=error) SOLO si hay `realDrops` > 0.
 *   - `cron_run` siempre (liveness para la regla cron_overdue).
 *
 * Detección pura: no reenvía nada. Una respuesta que se descubre perdida semanas después NO
 * se reenvía —es peor que no hacerlo, decisión de Manuel el 03/08/2026—, así que el valor
 * de esto está entero en enterarse DENTRO de las 24 h.
 */
@Injectable()
export class FeedbackEmailReconciliationCron {
  private readonly logger = new Logger(FeedbackEmailReconciliationCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: FeedbackEmailReconciliationService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // Cron cada 1h → threshold 75min (1.25× interval), igual que el resto.
    heartbeatRegistry.register(
      'feedback-email-reconciliation',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 4_500_000, gracePeriodMs: 120_000 },
    );
  }

  // Offset :35 para no solaparse con subscription-reconciliation (:00) ni con su gemelo
  // de impugnaciones (:15).
  @Cron('35 * * * *', {
    name: 'feedback-email-reconciliation',
    timeZone: 'UTC',
  })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'feedback-email-reconciliation',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron feedback-email-reconciliation disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();

      if (result.realDrops > 0) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'error', // notificación al usuario perdida = error inmediato
          eventType: 'invariant_violation',
          endpoint: 'feedback-email-reconciliation',
          durationMs: Date.now() - startedAt,
          metadata: {
            cron: 'feedback-email-reconciliation',
            invariant: 'feedback_responded_without_email',
            realDrops: result.realDrops,
            expectedSkips: result.expectedSkips,
            inferredSkips: result.inferredSkips,
            sample: result.sample,
          },
        });
      }

      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'feedback-email-reconciliation',
        durationMs: Date.now() - startedAt,
        metadata: {
          cron: 'feedback-email-reconciliation',
          status: 'success',
          realDrops: result.realDrops,
          expectedSkips: result.expectedSkips,
          inferredSkips: result.inferredSkips,
          withoutEmail: result.withoutEmail,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Cron feedback-email-reconciliation falló: ${errorMessage}`,
      );
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'feedback-email-reconciliation',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: {
          cron: 'feedback-email-reconciliation',
          status: 'failure',
        },
      });
    }
  }
}
