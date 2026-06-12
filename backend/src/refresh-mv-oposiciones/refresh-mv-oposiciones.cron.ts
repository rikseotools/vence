import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { jitter } from '../heartbeat/jitter.helper';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { RefreshMvOposicionesService } from './refresh-mv-oposiciones.service';

/**
 * Cron `refresh-mv-oposiciones` — cada 30 min.
 *
 * REFRESH CONCURRENTLY de mv_oposiciones_activas + invalidación de cache
 * catalog. Sprint G.4 del roadmap sprint-g-oposiciones-vs-convocatorias.md.
 */
@Injectable()
export class RefreshMvOposicionesCron {
  private readonly logger = new Logger(RefreshMvOposicionesCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: RefreshMvOposicionesService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // Cada 30 min → threshold 75 min (2.5× interval).
    heartbeatRegistry.register(
      'refresh-mv-oposiciones',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 4_500_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('*/30 * * * *', { name: 'refresh-mv-oposiciones', timeZone: 'UTC' })
  async handle(): Promise<void> {
    // Jitter 0-15s para no colisionar exactamente XX:00/XX:30 con otros.
    await jitter(15_000);
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
            endpoint: 'refresh-mv-oposiciones',
            durationMs: Date.now() - startedAt,
            metadata: {
              status: 'success',
              refreshMs: result.durationMs,
              cacheInvalidated: result.cacheInvalidated,
            },
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error(`refresh-mv-oposiciones falló: ${errorMessage}`);
          await this.observability.emit({
            source: 'fargate',
            severity: 'error',
            eventType: 'cron_run',
            endpoint: 'refresh-mv-oposiciones',
            durationMs: Date.now() - startedAt,
            errorMessage,
            metadata: { status: 'failure' },
          });
        }
      },
      {
        name: 'refresh-mv-oposiciones',
        observability: this.observability,
      },
    );
  }
}
