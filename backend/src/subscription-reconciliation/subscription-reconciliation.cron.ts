import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { SubscriptionReconciliationService } from './subscription-reconciliation.service';

/**
 * Disparador del cron `subscription-reconciliation`.
 *
 * Sustituye al workflow GHA `subscription-reconciliation.yml` (cron `0 * * * *`,
 * cada hora). El workflow seguía existiendo pero sufría lag de horas en GHA
 * bajo carga.
 *
 * Migrado a backend Fargate scheduler para garantizar ejecución puntual.
 *
 * Emite 2 eventos a observability:
 *   1. `subscription_drift` — Pass-1: user_subscriptions OK pero plan_type stale.
 *      Alimentado a RULE_SUBSCRIPTION_DRIFT.
 *   2. `subscription_drift_missing_in_db` — Pass-2: Stripe tiene sub que falta
 *      en BD (caso Andrea/Rocío/Mercedes). Alimentado a
 *      RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB (severity=error).
 */
@Injectable()
export class SubscriptionReconciliationCron {
  private readonly logger = new Logger(SubscriptionReconciliationCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: SubscriptionReconciliationService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // Cron cada 1h → threshold 75min (1.25× interval, gen tarea breve).
    heartbeatRegistry.register(
      'subscription-reconciliation',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 4_500_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('0 * * * *', { name: 'subscription-reconciliation', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl());
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron subscription-reconciliation disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run(false);

      // Pass-1: drift en BD (user_subscriptions OK pero profile.plan_type stale)
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: result.pass1.detected > 0 ? 'warn' : 'info',
        eventType: 'subscription_drift',
        endpoint: 'subscription-reconciliation',
        durationMs: Date.now() - startedAt,
        metadata: {
          cron: 'subscription-reconciliation',
          pass: 1,
          detected: result.pass1.detected,
          fixed: result.pass1.fixed,
          sampleUsers: result.pass1.sample.map((s) => s.user_id),
        },
      });

      // Pass-2: caso Andrea — Stripe tiene sub OK pero BD vacía.
      // Solo emitir si hay missing (no spammear cron_run cuando todo OK).
      if (result.pass2.stripeMissingInDb > 0) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'error', // pago no aplicado = error inmediato
          eventType: 'subscription_drift_missing_in_db',
          endpoint: 'subscription-reconciliation',
          durationMs: Date.now() - startedAt,
          metadata: {
            cron: 'subscription-reconciliation',
            pass: 2,
            detected: result.pass2.stripeMissingInDb,
            fixed: result.pass2.stripeMissingFixed,
            sample: result.pass2.sample,
          },
        });
      }

      // Cron_run liveness para que la regla cron_overdue no dispare falso
      // (la regla mira event_type=cron_run con endpoint=subscription-reconciliation).
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'subscription-reconciliation',
        durationMs: Date.now() - startedAt,
        metadata: {
          cron: 'subscription-reconciliation',
          status: 'success',
          pass1_detected: result.pass1.detected,
          pass1_fixed: result.pass1.fixed,
          pass2_detected: result.pass2.stripeMissingInDb,
          pass2_fixed: result.pass2.stripeMissingFixed,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Cron subscription-reconciliation falló: ${errorMessage}`,
      );
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'subscription-reconciliation',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { cron: 'subscription-reconciliation', status: 'failure' },
      });
    }
  }
}
