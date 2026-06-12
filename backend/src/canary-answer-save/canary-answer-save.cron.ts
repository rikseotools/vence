import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { CanaryAnswerSaveService } from './canary-answer-save.service';

/**
 * Cron canary-answer-save — POST sintético al endpoint más caliente cada 5min.
 *
 * Eventos emitidos:
 *   - canary_answer_save_ok (info)
 *   - canary_answer_save_failed (critical → RULE_CANARY_ANSWER_SAVE_FAILED)
 *   - canary_answer_save_question_invalid (warn — pregunta canary retirada,
 *     NO dispara alarma critical; mensaje accionable para updater)
 *   - canary_answer_save_skipped (warn — modo idle si faltan envs)
 *   - cron_run (siempre, liveness)
 */
@Injectable()
export class CanaryAnswerSaveCron {
  private readonly logger = new Logger(CanaryAnswerSaveCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: CanaryAnswerSaveService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'canary-answer-save',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 720_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('*/5 * * * *', { name: 'canary-answer-save', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'canary-answer-save',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron canary-answer-save disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();

      if ('skipped' in result) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'warn',
          eventType: 'canary_answer_save_skipped',
          endpoint: 'canary-answer-save',
          durationMs: result.durationMs,
          metadata: { cron: 'canary-answer-save', reason: result.reason },
        });
      } else if ('questionInvalid' in result) {
        // Pregunta canary retirada/modificada — deuda del canary, NO regresión.
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'warn',
          eventType: 'canary_answer_save_question_invalid',
          endpoint: 'canary-answer-save',
          durationMs: result.durationMs,
          errorMessage: result.errorMessage,
          httpStatus: result.httpStatus,
          metadata: {
            cron: 'canary-answer-save',
            hint: 'Actualizar SMOKE_QUESTION.id en canary-answer-save.service.ts',
          },
        });
      } else if (result.ok) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'info',
          eventType: 'canary_answer_save_ok',
          endpoint: 'canary-answer-save',
          durationMs: result.durationMs,
          httpStatus: result.httpStatus,
          metadata: {
            cron: 'canary-answer-save',
            is_correct: result.isCorrect,
          },
        });
      } else {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'critical',
          eventType: 'canary_answer_save_failed',
          endpoint: 'canary-answer-save',
          durationMs: result.durationMs,
          errorMessage: result.errorMessage,
          httpStatus: result.httpStatus,
          metadata: {
            cron: 'canary-answer-save',
            step: result.step,
          },
        });
      }

      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'canary-answer-save',
        durationMs: Date.now() - startedAt,
        metadata: { cron: 'canary-answer-save', status: 'completed' },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron canary-answer-save falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'canary-answer-save',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { cron: 'canary-answer-save', status: 'failure' },
      });
    }
  }
}
