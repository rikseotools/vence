import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { jitter } from '../heartbeat/jitter.helper';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
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
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl());
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron canary-redis-upstash disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();

      if ('skipped' in result) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'warn',
          eventType: 'canary_redis_skipped',
          endpoint: 'canary-redis-upstash',
          durationMs: result.durationMs,
          metadata: { cron: 'canary-redis-upstash', reason: result.reason },
        });
      } else if (result.ok) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'info',
          eventType: 'canary_redis_ok',
          endpoint: 'canary-redis-upstash',
          durationMs: result.durationMs,
          metadata: { cron: 'canary-redis-upstash' },
        });
      } else {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'critical',
          eventType: 'canary_redis_failed',
          endpoint: 'canary-redis-upstash',
          durationMs: result.durationMs,
          errorMessage: result.errorMessage,
          metadata: { cron: 'canary-redis-upstash', step: result.step },
        });
      }

      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'canary-redis-upstash',
        durationMs: Date.now() - startedAt,
        metadata: { cron: 'canary-redis-upstash', status: 'completed' },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron canary-redis-upstash falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'canary-redis-upstash',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { cron: 'canary-redis-upstash', status: 'failure' },
      });
    }
  }
}
