import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { jitter } from '../heartbeat/jitter.helper';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { CanaryThemeStatsService } from './canary-theme-stats.service';

/**
 * Cron canary-theme-stats — cada 10 min verifica que el endpoint de stats por
 * tema refleja el progreso real del usuario más pesado (modelo artículo→topic_scope).
 *
 * Eventos:
 *   - canary_theme_stats_ok (info — incluye expected/endpointSum en metadata)
 *   - canary_theme_stats_failed (critical → RULE_CANARY_THEME_STATS_FAILED)
 *   - canary_theme_stats_skipped (warn — no hay base suficiente, raro)
 *   - cron_run (siempre, liveness)
 */
@Injectable()
export class CanaryThemeStatsCron {
  private readonly logger = new Logger(CanaryThemeStatsCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: CanaryThemeStatsService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'canary-theme-stats',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 1_320_000, gracePeriodMs: 180_000 },
    );
  }

  @Cron('*/10 * * * *', { name: 'canary-theme-stats', timeZone: 'UTC' })
  async handle(): Promise<void> {
    // Jitter 0-25s para desacoplar de refresh-rankings + otros canaries.
    await jitter(25_000);
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'canary-theme-stats',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron canary-theme-stats disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();

      if ('skipped' in result) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'warn',
          eventType: 'canary_theme_stats_skipped',
          endpoint: 'canary-theme-stats',
          durationMs: result.durationMs,
          metadata: { cron: 'canary-theme-stats', reason: result.reason },
        });
      } else if (result.ok) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'info',
          eventType: 'canary_theme_stats_ok',
          endpoint: 'canary-theme-stats',
          durationMs: result.durationMs,
          metadata: {
            cron: 'canary-theme-stats',
            positionType: result.positionType,
            expected: result.expected,
            endpointSum: result.endpointSum,
          },
        });
      } else {
        // Separar LATENCIA de CORRECTITUD: un timeout (cold-start de Vercel /
        // red) NO es "el endpoint devuelve datos malos" → es señal de latencia,
        // se emite como warn y NO dispara el RULE_CANARY_THEME_STATS_FAILED
        // (critical). Solo las regresiones de correctitud (http/response/semantic)
        // son críticas. Evita spam de críticos por flakiness de red.
        const isLatency = result.step === 'timeout';
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: isLatency ? 'warn' : 'critical',
          eventType: isLatency
            ? 'canary_theme_stats_slow'
            : 'canary_theme_stats_failed',
          endpoint: 'canary-theme-stats',
          durationMs: result.durationMs,
          errorMessage: result.errorMessage,
          metadata: {
            cron: 'canary-theme-stats',
            step: result.step,
            positionType: result.positionType,
            expected: result.expected,
            endpointSum: result.endpointSum,
          },
        });
      }

      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'canary-theme-stats',
        durationMs: Date.now() - startedAt,
        metadata: { cron: 'canary-theme-stats', status: 'completed' },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron canary-theme-stats falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'canary-theme-stats',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { cron: 'canary-theme-stats', status: 'failure' },
      });
    }
  }
}
