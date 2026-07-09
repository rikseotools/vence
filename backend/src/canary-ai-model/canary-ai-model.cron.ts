import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getLastTickMsAgo, runWithHeartbeat } from '../heartbeat/heartbeat.helpers';
import { jitter } from '../heartbeat/jitter.helper';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { CanaryAiModelService, type CanaryAiModelResult } from './canary-ai-model.service';

/**
 * Cron que dispara el canary ai-model cada 10 min (jitter 0-30s). Menos frecuente
 * que los de 5 min porque pinga APIs externas de pago (coste mínimo, pero ~4 tokens
 * por proveedor cada 10 min basta para detectar un modelo muerto a tiempo).
 */
@Injectable()
export class CanaryAiModelCron {
  private readonly logger = new Logger(CanaryAiModelCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: CanaryAiModelService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'canary-ai-model',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 1_320_000, gracePeriodMs: 180_000 },
    );
  }

  @Cron('*/10 * * * *', { name: 'canary-ai-model', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await jitter(30_000);
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'canary-ai-model',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    const startedAt = Date.now();
    let result: CanaryAiModelResult;
    try {
      result = await this.service.run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Canary ai-model threw: ${msg}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'critical',
        eventType: 'canary_ai_model_failed',
        endpoint: 'canary-ai-model',
        durationMs: Date.now() - startedAt,
        errorMessage: msg,
        metadata: { step: 'exception' },
      });
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'canary-ai-model',
        durationMs: Date.now() - startedAt,
        errorMessage: msg,
        metadata: { status: 'failure' },
      });
      return;
    }

    if (result.skipped) {
      await this.observability.emit({
        source: 'fargate',
        severity: 'warn',
        eventType: 'canary_ai_model_skipped',
        endpoint: 'canary-ai-model',
        durationMs: result.durationMs,
        metadata: { reason: result.reason },
      });
    } else if (result.ok) {
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'canary_ai_model_ok',
        endpoint: 'canary-ai-model',
        durationMs: result.durationMs,
        metadata: { checked: result.checked },
      });
    } else {
      await this.observability.emit({
        source: 'fargate',
        severity: 'critical',
        eventType: 'canary_ai_model_failed',
        endpoint: 'canary-ai-model',
        durationMs: result.durationMs,
        errorMessage: result.errorMessage,
        metadata: { step: result.step, httpStatus: result.httpStatus, checked: result.checked },
      });
    }

    await this.observability.emit({
      source: 'fargate',
      severity: 'info',
      eventType: 'cron_run',
      endpoint: 'canary-ai-model',
      durationMs: Date.now() - startedAt,
      metadata: { status: result.ok || result.skipped ? 'success' : 'failure' },
    });
  }
}
