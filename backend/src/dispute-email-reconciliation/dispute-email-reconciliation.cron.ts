import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { DisputeEmailReconciliationService } from './dispute-email-reconciliation.service';

/**
 * Cron `dispute-email-reconciliation` (Gap 17 del manual de observabilidad).
 *
 * Cada hora verifica la invariante "impugnación cerrada ⇒ email enviado (o skip
 * legítimo)". Emite:
 *   - `invariant_violation` (severity=error) SOLO si hay `realDrops` > 0 — un
 *     fallo silencioso de notificación al usuario (el caso Eva 03/06).
 *   - `cron_run` siempre (liveness para la regla cron_overdue).
 *
 * Detección pura (sin red, sin escrituras). El auto-reenvío del email caído se
 * añade en un paso posterior (endpoint `dispute/resend-email`).
 */
@Injectable()
export class DisputeEmailReconciliationCron {
  private readonly logger = new Logger(DisputeEmailReconciliationCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: DisputeEmailReconciliationService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // Cron cada 1h → threshold 75min (1.25× interval), igual que el resto.
    heartbeatRegistry.register(
      'dispute-email-reconciliation',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 4_500_000, gracePeriodMs: 120_000 },
    );
  }

  // Offset :15 para no solapar con subscription-reconciliation (:00).
  @Cron('15 * * * *', {
    name: 'dispute-email-reconciliation',
    timeZone: 'UTC',
  })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl());
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron dispute-email-reconciliation disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();

      if (result.realDrops > 0) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'error', // notificación al usuario perdida = error inmediato
          eventType: 'invariant_violation',
          endpoint: 'dispute-email-reconciliation',
          durationMs: Date.now() - startedAt,
          metadata: {
            cron: 'dispute-email-reconciliation',
            invariant: 'dispute_resolved_without_email',
            realDrops: result.realDrops,
            expectedSkips: result.expectedSkips,
            sample: result.sample,
          },
        });
      }

      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'dispute-email-reconciliation',
        durationMs: Date.now() - startedAt,
        metadata: {
          cron: 'dispute-email-reconciliation',
          status: 'success',
          realDrops: result.realDrops,
          expectedSkips: result.expectedSkips,
          withoutEmail: result.withoutEmail,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Cron dispute-email-reconciliation falló: ${errorMessage}`,
      );
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'dispute-email-reconciliation',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: {
          cron: 'dispute-email-reconciliation',
          status: 'failure',
        },
      });
    }
  }
}
