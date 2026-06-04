import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { jitter } from '../heartbeat/jitter.helper';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { PoolerInstanceSamplerService } from './pooler-instance-sampler.service';

/**
 * Cron `pooler-instance-sampler` — 1×/min.
 *
 * Observabilidad POR INSTANCIA del self-hosted PgBouncer (ARCHITECTURE_ROADMAP
 * §03/06 prioridad nº1). Descubre las VMs del NLB y mide cada una por su IP
 * privada (SELECT 1 real + SHOW POOLS/STATS/SERVERS). Persiste en
 * `pgbouncer_instance_samples`. Las alertas viven en alert-rules.ts.
 *
 * Heartbeat 3 min (3× interval) — si el sampler muere, RULE_POOLER_SAMPLER_STALE
 * lo caza (meta-observabilidad: vigila al vigilante).
 */
@Injectable()
export class PoolerInstanceSamplerCron {
  private readonly logger = new Logger(PoolerInstanceSamplerCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: PoolerInstanceSamplerService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'pooler-instance-sampler',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 3 * 60_000, gracePeriodMs: 90_000 },
    );
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'pooler-instance-sampler',
    timeZone: 'UTC',
  })
  async handle(): Promise<void> {
    await jitter(3_000);

    const startedAt = Date.now();
    await runWithHeartbeat(this, 'lastTickAtMs', async () => {
      try {
        const result = await this.service.run();

        // Solo emitir observable_event cuando hay algo anómalo — 1.440
        // events/día sin valor saturaría observable_events. La tabla
        // pgbouncer_instance_samples SIEMPRE tiene los datos.
        if (result.unreachable > 0) {
          await this.observability.emit({
            source: 'fargate',
            severity: 'error',
            eventType: 'pooler_instance_unreachable',
            endpoint: 'pooler-instance-sampler',
            durationMs: Date.now() - startedAt,
            metadata: {
              discovered: result.discovered,
              reachable: result.reachable,
              unreachable: result.unreachable,
              instances: result.samples
                .filter((s) => !s.reachable)
                .map((s) => ({ instance: s.instance, az: s.az, error: s.error })),
            },
          });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(`Cron pooler-instance-sampler falló: ${errorMessage}`);
        await this.observability.emit({
          source: 'fargate',
          severity: 'error',
          eventType: 'cron_run',
          endpoint: 'pooler-instance-sampler',
          durationMs: Date.now() - startedAt,
          errorMessage,
          metadata: { status: 'failure' },
        });
      }
    });
  }
}
