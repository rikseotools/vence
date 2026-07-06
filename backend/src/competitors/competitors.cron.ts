import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { CompetitorSyncService } from './competitor-sync.service';

/**
 * Cron del "Analizador de Competidores". Sincroniza el sitemap + cursos + precios
 * de cada competidor y registra los cambios. Corre a las 05:00 UTC — ANTES del
 * radar (07:00), para que la Capa 3 del radar (adapter `competitor-db`) lea datos
 * frescos. Diseño: docs/roadmap/analizador-competidores.md
 */
@Injectable()
export class CompetitorsCron {
  private readonly logger = new Logger(CompetitorsCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly sync: CompetitorSyncService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'competitors',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 172_800_000, gracePeriodMs: 120_000 }, // 2 días
    );
  }

  @Cron('0 5 * * *', { name: 'competitors', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'competitors',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron competitors disparado');
    const startedAt = Date.now();
    try {
      const summaries = await this.sync.runAll();
      const totals = summaries.reduce(
        (a, s) => ({
          urlsNew: a.urlsNew + s.urlsNew,
          coursesNew: a.coursesNew + s.coursesNew,
          priceChanges: a.priceChanges + s.priceChanges,
          pending: a.pending + s.coursesPending,
          errors: a.errors + s.errors,
        }),
        { urlsNew: 0, coursesNew: 0, priceChanges: 0, pending: 0, errors: 0 },
      );
      await this.observability.emit({
        source: 'fargate',
        severity: totals.errors > 0 ? 'warn' : 'info',
        eventType: 'cron_run',
        endpoint: 'competitors',
        durationMs: Date.now() - startedAt,
        metadata: { status: 'success', ...totals, competitors: summaries.length },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron competitors falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'competitors',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
