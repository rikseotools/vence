import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { jitter } from '../heartbeat/jitter.helper';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { CanaryRunnerService } from '../canary-shared/canary-runner.service';
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
    private readonly runner: CanaryRunnerService,
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
    // El runner cronometra, emite canary_db_pool_ok/failed + cron_run (idéntico a
    // antes) y no lanza. La emisión vive UNA vez en canary-emit.ts (testeado), no aquí.
    await this.runner.run(this.service);
  }
}
