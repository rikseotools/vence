import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { CanaryAnswerPremiumService } from './canary-answer-premium.service';

/**
 * Cron canary-answer-premium — cada 5min verifica que un usuario PREMIUM no es
 * bloqueado por el límite diario en ningún endpoint de respuesta.
 *
 * Eventos emitidos:
 *   - canary_answer_premium_ok (info)
 *   - canary_answer_premium_blocked (critical → alerta: premium bloqueado = regresión)
 *   - canary_answer_premium_failed (error — fallo del propio canary, no regresión clara)
 *   - canary_answer_premium_skipped (warn — modo idle si faltan envs)
 *   - cron_run (siempre, liveness)
 */
@Injectable()
export class CanaryAnswerPremiumCron {
  private readonly logger = new Logger(CanaryAnswerPremiumCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: CanaryAnswerPremiumService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'canary-answer-premium',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 720_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('*/5 * * * *', { name: 'canary-answer-premium', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'canary-answer-premium',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron canary-answer-premium disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();

      if ('skipped' in result) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'warn',
          eventType: 'canary_answer_premium_skipped',
          endpoint: 'canary-answer-premium',
          durationMs: result.durationMs,
          metadata: { cron: 'canary-answer-premium', reason: result.reason },
        });
      } else if (result.ok) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'info',
          eventType: 'canary_answer_premium_ok',
          endpoint: 'canary-answer-premium',
          durationMs: result.durationMs,
          metadata: { cron: 'canary-answer-premium' },
        });
      } else if (result.blockedEndpoints?.length) {
        // Premium bloqueado = REGRESIÓN de negocio → critical → alerta.
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'critical',
          eventType: 'canary_answer_premium_blocked',
          endpoint: 'canary-answer-premium',
          durationMs: result.durationMs,
          errorMessage: result.errorMessage,
          metadata: {
            cron: 'canary-answer-premium',
            blockedEndpoints: result.blockedEndpoints,
          },
        });
      } else {
        // Fallo del propio canary (daily-limit no premium, red, firma) → error, no critical.
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'error',
          eventType: 'canary_answer_premium_failed',
          endpoint: 'canary-answer-premium',
          durationMs: result.durationMs,
          errorMessage: result.errorMessage,
          metadata: { cron: 'canary-answer-premium' },
        });
      }

      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'canary-answer-premium',
        durationMs: Date.now() - startedAt,
        metadata: { cron: 'canary-answer-premium', status: 'completed' },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron canary-answer-premium falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'canary-answer-premium',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { cron: 'canary-answer-premium', status: 'failure' },
      });
    }
  }
}
