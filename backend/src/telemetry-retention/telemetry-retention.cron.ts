import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { TelemetryRetentionService } from './telemetry-retention.service';

/**
 * Disparador del cron `telemetry-retention`.
 *
 * Poda diaria de las tablas de telemetría (`observable_events`,
 * `validation_error_logs`) para que no crezcan sin límite. Ver el porqué en
 * `TelemetryRetentionService`.
 *
 * Horario: 04:10 UTC (fuera de pico y separado de archive-interactions 03:30 y
 * de los checks de integridad 04:30, para no solaparse en el VACUUM).
 */
@Injectable()
export class TelemetryRetentionCron {
  private readonly logger = new Logger(TelemetryRetentionCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: TelemetryRetentionService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'telemetry-retention',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 90_000_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('10 4 * * *', { name: 'telemetry-retention', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'telemetry-retention',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron telemetry-retention disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'telemetry-retention',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          observableEventsDeleted: result.observableEventsDeleted,
          validationErrorLogsDeleted: result.validationErrorLogsDeleted,
          batches: result.batches,
          // Lo que QUEDA fuera de retención al terminar. Va en el mismo evento a
          // propósito: «borradas» solo se puede interpretar junto a «pendientes»
          // (T-613). Lo vigila la regla `drenaje_atrasado`.
          remaining: result.remaining,
          // Tablas cuyo VACUUM (ANALYZE) falló esta pasada (vacío = todo bien). El
          // borrado sigue siendo `status: 'success'` aunque esto no esté vacío: VACUUM
          // es higiene, no la medida — ver el comentario en TelemetryRetentionService.
          vacuumFailed: result.vacuumFailed,
          // Tablas cuyo bucle de borrado se cortó a mitad de pasada (vacío = todo
          // bien). También `status: 'success'` aunque esto no esté vacío: lo ya
          // borrado y `remaining` son reales, solo faltó terminar esta tabla — la
          // próxima noche retoma. Ver el comentario en TelemetryRetentionService.
          purgeFailed: result.purgeFailed,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron telemetry-retention falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'telemetry-retention',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
