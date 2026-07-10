import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { CanaryCompetitorMentionService } from './canary-competitor-mention.service';

/**
 * Cron canary-competitor-mention — cada hora cuenta preguntas VISIBLES que
 * mencionan a un competidor (Aulaplus / OpositaTest y variantes). Si hay > 0 →
 * contenido visible con nombre de competidor → critical + alerta.
 *
 * El gate de `transition_question_state` ya impide PROMOCIONAR una pregunta con
 * mención; este canary cubre el hueco del EDIT directo de una pregunta ya visible.
 *
 * Eventos:
 *   - canary_competitor_mention_ok (info)
 *   - competitor_mention_active (critical → alerta: nombre de competidor visible)
 *   - canary_competitor_mention_failed (error — el propio canary falló)
 *   - cron_run (siempre, liveness)
 */
@Injectable()
export class CanaryCompetitorMentionCron {
  private readonly logger = new Logger(CanaryCompetitorMentionCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: CanaryCompetitorMentionService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'canary-competitor-mention',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 9_000_000, gracePeriodMs: 600_000 },
    );
  }

  @Cron('7 * * * *', { name: 'canary-competitor-mention', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'canary-competitor-mention',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron canary-competitor-mention disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();

      if ('error' in result) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'error',
          eventType: 'canary_competitor_mention_failed',
          endpoint: 'canary-competitor-mention',
          durationMs: result.durationMs,
          errorMessage: result.error,
          metadata: { cron: 'canary-competitor-mention' },
        });
      } else if (result.ok) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'info',
          eventType: 'canary_competitor_mention_ok',
          endpoint: 'canary-competitor-mention',
          durationMs: result.durationMs,
          metadata: { cron: 'canary-competitor-mention' },
        });
      } else {
        // activeHits > 0 → una pregunta VISIBLE menciona a un competidor AHORA.
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'critical',
          eventType: 'competitor_mention_active',
          endpoint: 'canary-competitor-mention',
          durationMs: result.durationMs,
          errorMessage: `${result.activeHits} pregunta(s) VISIBLE(s) mencionan a un competidor (Aulaplus/OpositaTest). Limpiar la explicación de inmediato.`,
          metadata: {
            cron: 'canary-competitor-mention',
            activeHits: result.activeHits,
            sampleIds: result.sampleIds,
          },
        });
      }

      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'canary-competitor-mention',
        durationMs: Date.now() - startedAt,
        metadata: { cron: 'canary-competitor-mention', status: 'completed' },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron canary-competitor-mention falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'canary-competitor-mention',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { cron: 'canary-competitor-mention', status: 'failure' },
      });
    }
  }
}
