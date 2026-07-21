import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { DetectExamenesSignalsService } from './detect-examenes-signals.service';

/**
 * Disparador del cron `detect-examenes-signals`.
 *
 * Schedule: 10:00 UTC diario, DESPUÉS de `detect-notas-convocatoria` (09:30 UTC),
 * para leer las notas recién refrescadas del mismo día.
 */
@Injectable()
export class DetectExamenesSignalsCron {
  private readonly logger = new Logger(DetectExamenesSignalsCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: DetectExamenesSignalsService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'detect-examenes-signals',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 90_000_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('0 10 * * *', { name: 'detect-examenes-signals', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'detect-examenes-signals',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron detect-examenes-signals disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'detect-examenes-signals',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          candidates: result.candidates,
          emitted: result.emitted,
          inserted: result.inserted,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron detect-examenes-signals falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'detect-examenes-signals',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
