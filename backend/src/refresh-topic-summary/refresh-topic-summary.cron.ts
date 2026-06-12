import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { RefreshTopicSummaryService } from './refresh-topic-summary.service';

/**
 * Cron diario que refresca las MVs de Fase D-bis Iter 1.5.
 *
 * Schedule: 03:30 UTC. Después de update-streaks (03:00) y antes de
 * refresh-theme-cache (23:00). Evita coincidencia con los crons cada 5 min
 * (refresh-rankings, canaries, alerts-engine) que están concentrados en
 * múltiplos de 5.
 *
 * Las MVs son datos topic-level (cardinalidad fija ~1.836 filas), no
 * crecen con DAU. Refresh completo tarda 4-10s — irrelevante a las 03:30.
 */
@Injectable()
export class RefreshTopicSummaryCron {
  private readonly logger = new Logger(RefreshTopicSummaryCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: RefreshTopicSummaryService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // Daily → threshold 25h (tolera 1h retraso por jitter o coincidencia).
    heartbeatRegistry.register(
      'refresh-topic-summary',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 90_000_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('30 3 * * *', { name: 'refresh-topic-summary', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'refresh-topic-summary',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron refresh-topic-summary disparado');
    const startedAt = Date.now();
    try {
      const stats = await this.service.run();
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'refresh-topic-summary',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          topicLawSummaryMs: stats.topicLawSummaryMs,
          topicOfficialMs: stats.topicOfficialMs,
          refreshedAt: stats.refreshedAt,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron refresh-topic-summary falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'refresh-topic-summary',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
