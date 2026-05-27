import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
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

  constructor(
    private readonly service: CheckWebhookHealthService,
    private readonly observability: ObservabilityService,
  ) {}

  @Cron('*/15 * * * *', { name: 'check-webhook-health', timeZone: 'UTC' })
  async handle(): Promise<void> {
    this.logger.log('Cron check-webhook-health disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();

      // Emit doble: cron_run liveness siempre + webhook_unhealthy si aplica.
      // La separación es deliberada para que dashboards puedan medir
      // healthy_rate sin confundir con liveness del cron.
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: result.healthy ? 'info' : 'error',
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
