import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { jitter } from '../heartbeat/jitter.helper';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { CanaryStripeWebhookService } from './canary-stripe-webhook.service';

/**
 * Disparador del cron canary-stripe-webhook (Nivel 3 extendido).
 *
 * Cierra el gap del incidente Rocío/Mercedes (27/05/2026). Cada 5 min
 * envía evento sintético firmado al endpoint real /api/stripe/webhook
 * y verifica response 200 {received:true}.
 *
 * Eventos emitidos:
 *   - canary_stripe_webhook_ok (info · warn si alguna cuenta quedó sin sondear)
 *   - canary_stripe_webhook_failed (critical, dispara RULE_CANARY_WEBHOOK_FAILED)
 *   - canary_stripe_webhook_skipped (warn, modo idle si falta STRIPE_WEBHOOK_SECRET)
 *   - cron_run (siempre, liveness)
 */
@Injectable()
export class CanaryStripeWebhookCron {
  private readonly logger = new Logger(CanaryStripeWebhookCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: CanaryStripeWebhookService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'canary-stripe-webhook',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 720_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('4-59/5 * * * *', { name: 'canary-stripe-webhook', timeZone: 'UTC' })
  async handle(): Promise<void> {
    // Jitter 0-25s para desacoplar de refresh-rankings + alerts-engine.
    await jitter(25_000);
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'canary-stripe-webhook',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron canary-stripe-webhook disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();

      if ('skipped' in result) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'warn',
          eventType: 'canary_stripe_webhook_skipped',
          endpoint: 'canary-stripe-webhook',
          durationMs: result.durationMs,
          metadata: { cron: 'canary-stripe-webhook', reason: result.reason },
        });
      } else if (result.ok) {
        // `degraded` = alguna cuenta Stripe conocida se quedó SIN sondear (no
        // hay signing secret en el task). No es un fallo del webhook, pero
        // tampoco es un verde: su ruta de firma no la está probando nadie.
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: result.degraded ? 'warn' : 'info',
          eventType: 'canary_stripe_webhook_ok',
          endpoint: 'canary-stripe-webhook',
          durationMs: result.durationMs,
          metadata: {
            cron: 'canary-stripe-webhook',
            event_id: result.eventId,
            degraded: !!result.degraded,
            unprobed_accounts:
              (result.accounts ?? [])
                .filter((a) => !a.probed)
                .map((a) => `${a.account}: ${a.errorMessage ?? 'sin sondear'}`)
                .join(' | ') || null,
            accounts: result.accounts ?? null,
          },
        });
      } else {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'critical',
          eventType: 'canary_stripe_webhook_failed',
          endpoint: 'canary-stripe-webhook',
          durationMs: result.durationMs,
          errorMessage: result.errorMessage,
          httpStatus: result.httpStatus,
          metadata: {
            cron: 'canary-stripe-webhook',
            step: result.step,
            event_id: result.eventId,
            failed_accounts:
              (result.accounts ?? [])
                .filter((a) => a.probed && !a.ok)
                .map((a) => a.account)
                .join(',') || null,
            accounts: result.accounts ?? null,
          },
        });
      }

      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'canary-stripe-webhook',
        durationMs: Date.now() - startedAt,
        metadata: { cron: 'canary-stripe-webhook', status: 'completed' },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron canary-stripe-webhook falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'canary-stripe-webhook',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { cron: 'canary-stripe-webhook', status: 'failure' },
      });
    }
  }
}
