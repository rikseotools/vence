import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { jitter } from '../heartbeat/jitter.helper';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { CanaryDatabasePoolService } from './canary-database-pool.service';

/**
 * Cron canary-database-pool — SELECT 1 cada 5min con timeout 1s.
 *
 * Eventos:
 *   - canary_db_pool_ok (info)
 *   - canary_db_pool_failed (critical → RULE_CANARY_DB_POOL_FAILED)
 *   - cron_run (siempre, liveness)
 */
@Injectable()
export class CanaryDatabasePoolCron {
  private readonly logger = new Logger(CanaryDatabasePoolCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: CanaryDatabasePoolService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'canary-database-pool',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 720_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('*/5 * * * *', { name: 'canary-database-pool', timeZone: 'UTC' })
  async handle(): Promise<void> {
    // Jitter 0-20s para desacoplar de refresh-rankings + alerts-engine.
    await jitter(20_000);
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'canary-database-pool',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron canary-database-pool disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();

      if (result.ok) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'info',
          eventType: 'canary_db_pool_ok',
          endpoint: 'canary-database-pool',
          durationMs: result.durationMs,
          metadata: { cron: 'canary-database-pool' },
        });
      } else {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'critical',
          eventType: 'canary_db_pool_failed',
          endpoint: 'canary-database-pool',
          durationMs: result.durationMs,
          errorMessage: result.errorMessage,
          metadata: { cron: 'canary-database-pool', step: result.step },
        });
      }

      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'canary-database-pool',
        durationMs: Date.now() - startedAt,
        metadata: { cron: 'canary-database-pool', status: 'completed' },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron canary-database-pool falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'canary-database-pool',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { cron: 'canary-database-pool', status: 'failure' },
      });
    }
  }
}
