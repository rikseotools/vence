import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { jitter } from '../heartbeat/jitter.helper';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { RefreshRankingsService } from './refresh-rankings.service';

/**
 * Disparador del cron `refresh-rankings` (cada 5 min).
 *
 * Sustituye al workflow de GitHub Actions que ejecutaba el endpoint Vercel
 * `/api/cron/refresh-rankings`. Scheduler in-app sin límite de duración.
 *
 * Registrado en HeartbeatRegistry → expuesto en /health/crons → monitoreado
 * por la ECS liveness probe. Si cuelga >12 min (2× interval + margen),
 * el container es matado y relanzado automáticamente.
 */
@Injectable()
export class RefreshRankingsCron {
  private readonly logger = new Logger(RefreshRankingsCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: RefreshRankingsService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // Cron cada 5min → threshold 12min (2.4× interval para tolerar
    // ejecuciones largas). Grace period 120s para bootstrap.
    heartbeatRegistry.register(
      'refresh-rankings',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 720_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('*/5 * * * *', { name: 'refresh-rankings', timeZone: 'UTC' })
  async handle(): Promise<void> {
    // Jitter 0-30s: cron pesado (3-5s típico). Evita colisión XX:25:00 UTC
    // con alerts-engine + 4 canaries que también son @Cron('*/5 * * * *').
    await jitter(30_000);
    this.logger.log('Cron refresh-rankings disparado');
    const startedAt = Date.now();
    await runWithHeartbeat(
      this,
      'lastTickAtMs',
      async () => {
        try {
          const result = await this.service.run();
          await this.observability.emit({
            source: 'fargate',
            severity: 'info',
            eventType: 'cron_run',
            endpoint: 'refresh-rankings',
            durationMs: Date.now() - startedAt,
            metadata: {
              status: 'success',
              totalInserted: result.totalInserted,
              slowestMs: result.slowestMs,
            },
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error(`Cron refresh-rankings falló: ${errorMessage}`);
          await this.observability.emit({
            source: 'fargate',
            severity: 'error',
            eventType: 'cron_run',
            endpoint: 'refresh-rankings',
            durationMs: Date.now() - startedAt,
            errorMessage,
            metadata: { status: 'failure' },
          });
        }
      },
      {
        name: 'refresh-rankings',
        observability: this.observability,
      },
    );
  }
}
