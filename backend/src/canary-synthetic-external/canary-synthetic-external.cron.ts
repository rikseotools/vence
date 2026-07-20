import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { CanaryRunnerService } from '../canary-shared/canary-runner.service';
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
    private readonly runner: CanaryRunnerService,
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
    // Emisión centralizada e idéntica (ok/failed con `details` en metadata +
    // cron_run) vía el runner. Ver canary-emit.ts (testeado).
    await this.runner.run(this.service);
  }
}
