import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { CanaryStatsPipelineService } from './canary-stats-pipeline.service';

/**
 * Cron canary-stats-pipeline — cada 5 min inyecta una respuesta sintética y
 * verifica que propaga end-to-end al pipeline de stats materializadas
 * (outbox → handler → user_question_history_v2). Cobertura 24/7 independiente
 * del tráfico real (cierra el punto ciego de las reglas de paridad/frescura).
 *
 * Eventos:
 *   - canary_stats_pipeline_ok (info)
 *   - canary_stats_pipeline_failed (critical → RULE_CANARY_STATS_PIPELINE_FAILED)
 *   - canary_stats_pipeline_question_invalid (warn — pregunta canary retirada)
 *   - canary_stats_pipeline_skipped (warn — faltan envs)
 *   - cron_run (liveness)
 */
@Injectable()
export class CanaryStatsPipelineCron {
  private readonly logger = new Logger(CanaryStatsPipelineCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: CanaryStatsPipelineService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'canary-stats-pipeline',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 720_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('*/5 * * * *', { name: 'canary-stats-pipeline', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'canary-stats-pipeline',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron canary-stats-pipeline disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();

      if ('skipped' in result) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'warn',
          eventType: 'canary_stats_pipeline_skipped',
          endpoint: 'canary-stats-pipeline',
          durationMs: result.durationMs,
          metadata: { cron: 'canary-stats-pipeline', reason: result.reason },
        });
      } else if ('questionInvalid' in result) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'warn',
          eventType: 'canary_stats_pipeline_question_invalid',
          endpoint: 'canary-stats-pipeline',
          durationMs: result.durationMs,
          errorMessage: result.errorMessage,
          httpStatus: result.httpStatus,
          metadata: {
            cron: 'canary-stats-pipeline',
            hint: 'Actualizar SMOKE_QUESTION.id',
          },
        });
      } else if (result.ok) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'info',
          eventType: 'canary_stats_pipeline_ok',
          endpoint: 'canary-stats-pipeline',
          durationMs: result.durationMs,
          metadata: {
            cron: 'canary-stats-pipeline',
            propagationMs: result.propagationMs,
            uqh: result.uqh,
          },
        });
      } else {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'critical',
          eventType: 'canary_stats_pipeline_failed',
          endpoint: 'canary-stats-pipeline',
          durationMs: result.durationMs,
          errorMessage: result.errorMessage,
          httpStatus: result.httpStatus,
          metadata: { cron: 'canary-stats-pipeline', step: result.step },
        });
      }

      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'canary-stats-pipeline',
        durationMs: Date.now() - startedAt,
        metadata: { cron: 'canary-stats-pipeline', status: 'completed' },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron canary-stats-pipeline falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'canary-stats-pipeline',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { cron: 'canary-stats-pipeline', status: 'failure' },
      });
    }
  }
}
