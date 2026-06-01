import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { jitter } from '../heartbeat/jitter.helper';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { AutoPromoteCoverageService } from './auto-promote-coverage.service';

/**
 * Cron `auto-promote-coverage` — diario 04:00 UTC.
 *
 * Evalúa cada oposición y la promueve de coverage_level cuando se cumplen
 * criterios objetivos. Ver auto-promote-coverage.service.ts para la lógica.
 *
 * Sprint D del roadmap docs/roadmap/oposiciones-coverage-level-y-promocion-automatica.md.
 */
@Injectable()
export class AutoPromoteCoverageCron {
  private readonly logger = new Logger(AutoPromoteCoverageCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: AutoPromoteCoverageService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // Diario 04:00 UTC → threshold 30h (1.25× interval para tolerar deploy
    // o ejecución larga). Grace 120s para bootstrap.
    heartbeatRegistry.register(
      'auto-promote-coverage',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 108_000_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('0 4 * * *', { name: 'auto-promote-coverage', timeZone: 'UTC' })
  async handle(): Promise<void> {
    // Jitter 0-30s para no colisionar con otros crons diarios @ 04:00.
    await jitter(30_000);
    const startedAt = Date.now();
    await runWithHeartbeat(this, 'lastTickAtMs', async () => {
      try {
        const result = await this.service.run();
        await this.observability.emit({
          source: 'fargate',
          severity: 'info',
          eventType: 'cron_run',
          endpoint: 'auto-promote-coverage',
          durationMs: Date.now() - startedAt,
          metadata: {
            status: 'success',
            evaluated: result.evaluated,
            promoted: result.promoted,
            bySalto: result.bySalto,
            cacheInvalidated: result.cacheInvalidated,
          },
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(`auto-promote-coverage falló: ${errorMessage}`);
        await this.observability.emit({
          source: 'fargate',
          severity: 'error',
          eventType: 'cron_run',
          endpoint: 'auto-promote-coverage',
          durationMs: Date.now() - startedAt,
          errorMessage,
          metadata: { status: 'failure' },
        });
      }
    });
  }
}
