import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { SeoSnapshotService } from './seo-snapshot.service';

/**
 * Disparador del cron `seo-snapshot`: snapshot semanal de posición orgánica
 * (Google Search Console) de cada keyword objetivo activa → seo_keyword_snapshots.
 *
 * Sustituye al endpoint frontend `/api/cron/seo-snapshot` + workflow GHA: aquí
 * el scheduler es in-app (sin GHA-cron), las credenciales Google viven en el
 * backend (no en el frontend de usuario) y el job es plenamente observable:
 *   - heartbeat registry → alerta si deja de tickear o se cuelga.
 *   - regla "cron registrado sin cron_run" → alerta si no corre en su horario.
 *   - evento cron_run (success/error) con durationMs → lentitud y fallos visibles
 *     en observable_events y /admin/infraestructura.
 *
 * Horario: lunes 05:17 UTC (SEO se mueve en semanas, no días).
 * Doc: docs/roadmap/seo-keywords-competidores.md
 */
@Injectable()
export class SeoSnapshotCron {
  private readonly logger = new Logger(SeoSnapshotCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: SeoSnapshotService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // Semanal → threshold 8 días (1 periodo + margen). Si se salta una semana, alerta.
    heartbeatRegistry.register(
      'seo-snapshot',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 691_200_000, gracePeriodMs: 7_200_000 },
    );
  }

  @Cron('17 5 * * 1', { name: 'seo-snapshot', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'seo-snapshot',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron seo-snapshot disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'seo-snapshot',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          capturedOn: result.capturedOn,
          total: result.total,
          ranking: result.ranking,
          notRanking: result.notRanking,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron seo-snapshot falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'seo-snapshot',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
