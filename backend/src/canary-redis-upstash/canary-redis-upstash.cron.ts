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
import { CanaryRedisUpstashService } from './canary-redis-upstash.service';

/**
 * Cron canary-redis-upstash — SET/GET/DEL cada 5min.
 *
 * Eventos:
 *   - canary_redis_ok (info)
 *   - canary_redis_failed (critical → RULE_CANARY_REDIS_FAILED)
 *   - canary_redis_skipped (warn — credentials no configuradas)
 *   - cron_run (siempre, liveness)
 */
@Injectable()
export class CanaryRedisUpstashCron {
  private readonly logger = new Logger(CanaryRedisUpstashCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: CanaryRedisUpstashService,
    private readonly runner: CanaryRunnerService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'canary-redis-upstash',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 720_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('*/5 * * * *', { name: 'canary-redis-upstash', timeZone: 'UTC' })
  async handle(): Promise<void> {
    // Jitter 0-15s para desacoplar de refresh-rankings + alerts-engine.
    await jitter(15_000);
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'canary-redis-upstash',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron canary-redis-upstash disparado');
    // Emisión centralizada e idéntica (canary_redis_ok/skipped/failed + cron_run,
    // con provider en metadata) vía el runner. Ver canary-emit.ts (testeado).
    await this.runner.run(this.service);
  }
}
