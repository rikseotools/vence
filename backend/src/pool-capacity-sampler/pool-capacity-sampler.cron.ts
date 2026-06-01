import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { jitter } from '../heartbeat/jitter.helper';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { PoolCapacitySamplerService } from './pool-capacity-sampler.service';

/**
 * Cron `pool-capacity-sampler` — 1×/min.
 *
 * Muestrea `pg_stat_activity` y persiste en `pool_capacity_samples` para
 * convertir lo que hoy es script ad-hoc (`scripts/diagnostic/capture-pool-pressure.cjs`)
 * en monitorización CONTINUA + alerta predictiva.
 *
 * Roadmap: `docs/roadmap/observability-capacity.md` Acción 2.
 *
 * Heartbeat threshold = 3 min (3× interval) — si el cron no tickea en 3
 * minutos, ECS lo mata y relanza. Sin esto, un fallo silencioso del cron
 * deja ceguera operativa.
 *
 * Jitter pequeño (0-3s) — no es necesario más con cron 1×/min porque no
 * coincide con los crones */5min.
 */
@Injectable()
export class PoolCapacitySamplerCron {
  private readonly logger = new Logger(PoolCapacitySamplerCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: PoolCapacitySamplerService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // Threshold 3 min = 3× interval. Grace 90s para bootstrap inicial.
    heartbeatRegistry.register(
      'pool-capacity-sampler',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 3 * 60_000, gracePeriodMs: 90_000 },
    );
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'pool-capacity-sampler',
    timeZone: 'UTC',
  })
  async handle(): Promise<void> {
    // Jitter 0-3s — defensa-en-profundidad ligera. No es necesario más con
    // cadencia 1min y muestra ligera.
    await jitter(3_000);

    const startedAt = Date.now();
    await runWithHeartbeat(this, 'lastTickAtMs', async () => {
      try {
        const result = await this.service.run();

        // Sólo emitir observable_event cuando hay banderas rojas — 1.440
        // events/día sin valor saturaría observable_events. La tabla
        // pool_capacity_samples SIEMPRE tiene los datos; observable_events
        // sólo trackea los picos.
        const hasFlags =
          result.idleInTxOver5s > 0 || result.hungClientreadOver10s > 0;
        if (hasFlags) {
          await this.observability.emit({
            source: 'fargate',
            severity: 'warn',
            eventType: 'pool_capacity_flag',
            endpoint: 'pool-capacity-sampler',
            durationMs: Date.now() - startedAt,
            metadata: {
              sampleAt: result.sampleAt.toISOString(),
              totalConns: result.totalConns,
              activeConns: result.activeConns,
              idleInTxOver5s: result.idleInTxOver5s,
              hungClientreadOver10s: result.hungClientreadOver10s,
              frontendActiveConns: result.frontendActiveConns,
            },
          });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Cron pool-capacity-sampler falló: ${errorMessage}`,
        );
        await this.observability.emit({
          source: 'fargate',
          severity: 'error',
          eventType: 'cron_run',
          endpoint: 'pool-capacity-sampler',
          durationMs: Date.now() - startedAt,
          errorMessage,
          metadata: { status: 'failure' },
        });
      }
    });
  }
}
