import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getLastTickMsAgo, runWithHeartbeat } from '../heartbeat/heartbeat.helpers';
import { jitter } from '../heartbeat/jitter.helper';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { CanaryPorLeyesScopeService, type CanaryPorLeyesScopeResult } from './canary-por-leyes-scope.service';

/**
 * Cron que dispara el canary por-leyes-scope cada 5 min (jitter 0-30s para no
 * colisionar con los otros canaries que también corren cada 5 min).
 */
@Injectable()
export class CanaryPorLeyesScopeCron {
  private readonly logger = new Logger(CanaryPorLeyesScopeCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: CanaryPorLeyesScopeService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'canary-por-leyes-scope',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 720_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('*/5 * * * *', { name: 'canary-por-leyes-scope', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await jitter(30_000);
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'canary-por-leyes-scope',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    const startedAt = Date.now();
    let result: CanaryPorLeyesScopeResult;
    try {
      result = await this.service.run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Canary por-leyes-scope threw: ${msg}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'critical',
        eventType: 'canary_por_leyes_scope_failed',
        endpoint: 'canary-por-leyes-scope',
        durationMs: Date.now() - startedAt,
        errorMessage: msg,
        metadata: { step: 'exception' },
      });
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'canary-por-leyes-scope',
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
        eventType: 'canary_por_leyes_scope_skipped',
        endpoint: 'canary-por-leyes-scope',
        durationMs: result.durationMs,
        metadata: { reason: result.reason },
      });
    } else if (result.ok) {
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'canary_por_leyes_scope_ok',
        endpoint: 'canary-por-leyes-scope',
        durationMs: result.durationMs,
        metadata: { scopedMax: result.scopedMax, fullMax: result.fullMax },
      });
    } else {
      await this.observability.emit({
        source: 'fargate',
        severity: 'critical',
        eventType: 'canary_por_leyes_scope_failed',
        endpoint: 'canary-por-leyes-scope',
        durationMs: result.durationMs,
        errorMessage: result.errorMessage,
        metadata: { step: result.step, httpStatus: result.httpStatus, scopedMax: result.scopedMax, fullMax: result.fullMax },
      });
    }

    await this.observability.emit({
      source: 'fargate',
      severity: 'info',
      eventType: 'cron_run',
      endpoint: 'canary-por-leyes-scope',
      durationMs: Date.now() - startedAt,
      metadata: { status: result.ok || result.skipped ? 'success' : 'failure' },
    });
  }
}
