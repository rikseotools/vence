import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { jitter } from '../heartbeat/jitter.helper';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import {
  CanaryTopicDataService,
  type CanaryTopicDataResult,
} from './canary-topic-data.service';

/**
 * Cron que dispara el canary topic-data cada 5 min.
 *
 * Jitter 0-30s para evitar coincidir en el segundo XX:00 con los otros 5
 * canaries que también son @Cron cada 5 min — ver incidente 30/05/2026
 * con pool=10 saturado por colisión simultánea.
 */
@Injectable()
export class CanaryTopicDataCron {
  private readonly logger = new Logger(CanaryTopicDataCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: CanaryTopicDataService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'canary-topic-data',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 720_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('*/5 * * * *', { name: 'canary-topic-data', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await jitter(30_000);
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl());
  }

  private async runImpl(): Promise<void> {
    const startedAt = Date.now();
    let result: CanaryTopicDataResult;
    try {
      result = await this.service.run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Canary topic-data threw: ${msg}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'critical',
        eventType: 'canary_topic_data_failed',
        endpoint: 'canary-topic-data',
        durationMs: Date.now() - startedAt,
        errorMessage: msg,
        metadata: { step: 'exception' },
      });
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'canary-topic-data',
        durationMs: Date.now() - startedAt,
        errorMessage: msg,
        metadata: { status: 'failure' },
      });
      return;
    }

    if ('ok' in result && result.ok) {
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'canary_topic_data_ok',
        endpoint: 'canary-topic-data',
        durationMs: result.durationMs,
        metadata: {
          totalQuestions: result.totalQuestions,
          articleCount: result.articleCount,
          officialQuestionsCount: result.officialQuestionsCount,
        },
      });
    } else {
      await this.observability.emit({
        source: 'fargate',
        severity: 'critical',
        eventType: 'canary_topic_data_failed',
        endpoint: 'canary-topic-data',
        durationMs: result.durationMs,
        errorMessage: result.errorMessage,
        metadata: {
          step: result.step,
          httpStatus: 'httpStatus' in result ? result.httpStatus : undefined,
        },
      });
    }

    // Liveness `cron_run` siempre — incluso si el canary falló — para que
    // RULE_CRON_OVERDUE pueda detectar el cron muerto, distinguir de
    // "canary falla pero el cron sigue tickeando".
    await this.observability.emit({
      source: 'fargate',
      severity: 'info',
      eventType: 'cron_run',
      endpoint: 'canary-topic-data',
      durationMs: Date.now() - startedAt,
      metadata: { status: 'ok' in result && result.ok ? 'success' : 'failure' },
    });
  }
}
