import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { CanarySyntheticExternalService } from './canary-synthetic-external.service';

/**
 * Cron canary-synthetic-external — check externo cada 5 min (home + assets + health).
 *
 * Eventos emitidos:
 *   - canary_synthetic_external_ok (info)
 *   - canary_synthetic_external_failed (critical → RULE_CANARY_SYNTHETIC_EXTERNAL_FAILED)
 *   - cron_run (siempre, liveness)
 */
@Injectable()
export class CanarySyntheticExternalCron {
  private readonly logger = new Logger(CanarySyntheticExternalCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: CanarySyntheticExternalService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'canary-synthetic-external',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 720_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('*/5 * * * *', { name: 'canary-synthetic-external', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'canary-synthetic-external',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron canary-synthetic-external disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();

      if (result.ok) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'info',
          eventType: 'canary_synthetic_external_ok',
          endpoint: 'canary-synthetic-external',
          durationMs: result.durationMs,
          metadata: { cron: 'canary-synthetic-external', ...result.details },
        });
      } else {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'critical',
          eventType: 'canary_synthetic_external_failed',
          endpoint: 'canary-synthetic-external',
          durationMs: result.durationMs,
          errorMessage: result.errorMessage,
          metadata: { cron: 'canary-synthetic-external', step: result.step, ...result.details },
        });
      }

      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'canary-synthetic-external',
        durationMs: Date.now() - startedAt,
        metadata: { cron: 'canary-synthetic-external', status: 'completed' },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron canary-synthetic-external falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'canary-synthetic-external',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { cron: 'canary-synthetic-external', status: 'failure' },
      });
    }
  }
}
