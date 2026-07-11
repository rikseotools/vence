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
