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
 *   3. `premium_sin_respaldo` — Pass-3: premium que NADIE paga (la dirección
 *      contraria, que no vigilaba ninguna de las 8 reglas existentes).
 *      Alimentado a RULE_PREMIUM_SIN_RESPALDO (severity=warn: no hay daño al
 *      usuario, hay dinero escapándose).
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
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'subscription-reconciliation',
      observability: this.observability,
    });
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
      // Se emite si hay missing O si alguna cuenta Stripe no se pudo
      // reconciliar: "0 pendientes" con una cuenta ciega no es un verde, es
      // una cuenta sin red de rescate (mismo criterio que check-webhook-health).
      const p2 = result.pass2;
      if (p2.stripeMissingInDb > 0 || p2.degraded) {
        const unreconciled = (p2.accounts ?? [])
          .filter((a) => !a.readable)
          .map((a) => `${a.account}: ${a.error ?? 'sin leer'}`);
        this.observability.emitFireAndForget({
          source: 'fargate',
          // pago no aplicado = error inmediato · cuenta ciega = warn
          severity: p2.stripeMissingInDb > 0 ? 'error' : 'warn',
          eventType: 'subscription_drift_missing_in_db',
          endpoint: 'subscription-reconciliation',
          durationMs: Date.now() - startedAt,
          metadata: {
            cron: 'subscription-reconciliation',
            pass: 2,
            detected: p2.stripeMissingInDb,
            fixed: p2.stripeMissingFixed,
            degraded: !!p2.degraded,
            affected_accounts:
              [
                ...new Set(
                  (p2.sample ?? []).map((s) => s.account).filter(Boolean),
                ),
              ].join(',') || null,
            unreconciled_accounts: unreconciled.join(' | ') || null,
            accounts: p2.accounts ?? null,
            sample: p2.sample,
          },
        });
      }

      // Pass-3: premium que nadie paga. La dirección que faltaba — ver el método en el
      // servicio. Evento propio para que la alerta pueda distinguirlo del caso Andrea, que es
      // el contrario y se atiende de otra manera.
      const sinRespaldo = result.pass2.sinRespaldo ?? [];
      if (sinRespaldo.length > 0) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'warn', // no es daño al usuario: es dinero que se escapa
          eventType: 'premium_sin_respaldo',
          endpoint: 'subscription-reconciliation',
          durationMs: Date.now() - startedAt,
          metadata: {
            cron: 'subscription-reconciliation',
            pass: 3,
            detected: sinRespaldo.length,
            por_motivo: sinRespaldo.reduce<Record<string, number>>((acc, x) => {
              acc[x.motivo] = (acc[x.motivo] ?? 0) + 1;
              return acc;
            }, {}),
            sample: sinRespaldo.slice(0, 5),
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
