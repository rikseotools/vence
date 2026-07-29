import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { CheckWebhookHealthService } from './check-webhook-health.service';

/**
 * Disparador del cron `check-webhook-health`.
 *
 * Sustituye al workflow GHA `check-webhook-health.yml` (cron `*∕15 * * * *`).
 * El workflow seguía existiendo pero sufría lag de horas en GHA bajo carga
 * (descubierto 27/05/2026 durante incidente Rocío/Mercedes — el cron no se
 * ejecutó en 5h45min pese a estar configurado cada 15min).
 *
 * Aquí el scheduler es in-app: NestJS @Cron decorator funciona desde la
 * propia task ECS, sin depender de la cola compartida de GitHub Actions.
 *
 * Horario: cada 15 minutos. Cuando emite `webhook_unhealthy` (severity error),
 * la regla `RULE_WEBHOOK_UNHEALTHY` en alerts dispara notificación email.
 */
@Injectable()
export class CheckWebhookHealthCron {
  private readonly logger = new Logger(CheckWebhookHealthCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: CheckWebhookHealthService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // Cron cada 15min → threshold 35min (2.3× interval).
    heartbeatRegistry.register(
      'check-webhook-health',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 2_100_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('11-56/15 * * * *', { name: 'check-webhook-health', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'check-webhook-health',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron check-webhook-health disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();

      // Emit doble: cron_run liveness siempre + webhook_unhealthy si aplica.
      // La separación es deliberada para que dashboards puedan medir
      // healthy_rate sin confundir con liveness del cron.
      //
      // Tres severidades desde el multi-cuenta (29/07/2026):
      //   error → alguna cuenta LEGIBLE por encima del umbral (pagos sin aplicar)
      //   warn  → todas las legibles bien, pero alguna cuenta conocida NO se
      //           pudo mirar (sin secret key o error de API) = punto ciego
      //   info  → todas las cuentas conocidas vistas y sanas
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: !result.healthy ? 'error' : result.degraded ? 'warn' : 'info',
        eventType: result.healthy ? 'cron_run' : 'webhook_unhealthy',
        endpoint: 'check-webhook-health',
        durationMs: Date.now() - startedAt,
        metadata: {
          cron: 'check-webhook-health',
          total_events_1h: result.totalEvents,
          pending_events_1h: result.pendingEvents,
          pending_pct: result.pendingPct,
          threshold_pct: result.thresholdPct,
          healthy: result.healthy,
          degraded: result.degraded,
          unhealthy_accounts: result.unhealthyAccounts.join(',') || null,
          unmonitored_accounts:
            result.accounts
              .filter((a) => !a.readable)
              .map((a) => `${a.account}: ${a.error ?? 'sin leer'}`)
              .join(' | ') || null,
          accounts: result.accounts,
          oldest_pending_type: result.oldestPendingType,
          oldest_pending_age_s: result.oldestPendingAgeS,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron check-webhook-health falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'check-webhook-health',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { cron: 'check-webhook-health', status: 'failure' },
      });
    }
  }
}
