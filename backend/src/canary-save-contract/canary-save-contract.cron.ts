import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { CanarySaveContractService } from './canary-save-contract.service';

/**
 * Cron canary-save-contract — replica el flujo de guardado del cliente + verifica
 * en RDS, cada 5 min.
 *
 * Eventos:
 *   - canary_save_contract_ok (info)
 *   - canary_save_contract_failed (critical → RULE_CANARY_SAVE_CONTRACT_FAILED)
 *   - canary_save_contract_skipped (warn — faltan envs)
 *   - cron_run (liveness)
 */
@Injectable()
export class CanarySaveContractCron {
  private readonly logger = new Logger(CanarySaveContractCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: CanarySaveContractService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'canary-save-contract',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 720_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('*/5 * * * *', { name: 'canary-save-contract', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'canary-save-contract',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron canary-save-contract disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();

      if (result.skipped) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'warn',
          eventType: 'canary_save_contract_skipped',
          endpoint: 'canary-save-contract',
          durationMs: result.durationMs,
          metadata: { cron: 'canary-save-contract', reason: result.reason },
        });
      } else if (result.ok) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'info',
          eventType: 'canary_save_contract_ok',
          endpoint: 'canary-save-contract',
          durationMs: result.durationMs,
          metadata: { cron: 'canary-save-contract' },
        });
      } else {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'critical',
          eventType: 'canary_save_contract_failed',
          endpoint: 'canary-save-contract',
          durationMs: result.durationMs,
          errorMessage: result.errorMessage,
          httpStatus: result.httpStatus,
          metadata: { cron: 'canary-save-contract', step: result.step },
        });
      }

      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'canary-save-contract',
        durationMs: Date.now() - startedAt,
        metadata: { cron: 'canary-save-contract', status: 'completed' },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron canary-save-contract falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'canary-save-contract',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { cron: 'canary-save-contract', status: 'failure' },
      });
    }
  }
}
