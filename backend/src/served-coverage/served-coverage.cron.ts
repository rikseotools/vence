import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { ServedCoverageService } from './served-coverage.service';

/**
 * Canary nocturno de cobertura servida por tema (AWS-native, Fargate — sin
 * dependencia de GitHub Actions).
 *
 * Schedule: 05:00 UTC. DESPUÉS del refresh de MV (03:30, RefreshTopicSummaryCron)
 * y del stats-drift (04:00). Si la MV se refrescó bien de madrugada, aquí debe
 * salir 0 gaps; si algo quedó stale (o un tema disponible sin preguntas), lo
 * caza y emite a observable_events.
 *
 * Ver docs/maintenance/cache-revalidation.md (§Materialized views) y
 * crear-nueva-oposicion.md (§6.bis). Incidente que lo motiva: TAI 07/07/2026.
 */
@Injectable()
export class ServedCoverageCron {
  private readonly logger = new Logger(ServedCoverageCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: ServedCoverageService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // Daily → threshold 25h (tolera 1h de retraso por jitter).
    heartbeatRegistry.register(
      'served-coverage',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 90_000_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('0 5 * * *', { name: 'served-coverage', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'served-coverage',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    const startedAt = Date.now();
    const stats = await this.service.run();
    const total = stats.mvStale + stats.emptyDisponible;

    if (total === 0) {
      this.logger.log(`OK — ${stats.checked} temas disponibles, 0 gaps`);
      return; // el heartbeat/tick ya registra que corrió; no metemos ruido.
    }

    this.logger.warn(
      `${total} gaps (${stats.mvStale} MV stale, ${stats.emptyDisponible} disponibles vacíos)`,
    );
    await this.observability.emit({
      source: 'fargate',
      severity: total > 10 ? 'critical' : 'warn',
      eventType: 'served_coverage_gap',
      endpoint: 'served-coverage',
      durationMs: Date.now() - startedAt,
      errorMessage: `Cobertura servida: ${stats.mvStale} temas con MV stale (saldrían "En desarrollo"), ${stats.emptyDisponible} disponibles vacíos`,
      metadata: {
        checked: stats.checked,
        mv_stale: stats.mvStale,
        empty_disponible: stats.emptyDisponible,
        findings: stats.findings.slice(0, 50).map((f) => ({
          o: f.positionType,
          t: f.topicNumber,
          mv: f.mvTotal,
          kind: f.kind,
        })),
        hint:
          stats.mvStale > 0
            ? 'SELECT public.refresh_topic_question_summary();'
            : undefined,
      },
    });
  }
}
