import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from './observability.service';

/**
 * Cron de poda — borra eventos `observable_events` con más de 30 días.
 *
 * Bloque 4 Gap 10 del manual de observabilidad.
 *
 * Por qué 30 días:
 *   - 95% de la utilidad operativa es <24h (alertas, debugging activo).
 *   - Investigación postmortem necesita hasta ~1 semana — 30d cubre con margen.
 *   - A 10k DAU × 50 eventos/día/user = ~15M filas/mes. Retención 30d
 *     ⇒ ~15M filas activas. Manejable con índices BTREE estándar.
 *   - Beyond 30d: archivar a S3 cuando compliance/análisis lo requiera.
 *
 * Schedule: diario 04:00 UTC (ventana baja de tráfico EU + US).
 *
 * El propio cron también emite su run a observable_events — meta-observability,
 * útil para detectar si la poda deja de funcionar y la tabla crece sin freno.
 */
@Injectable()
export class ObservabilityCleanupCron {
  private readonly logger = new Logger(ObservabilityCleanupCron.name);
  private static readonly RETENTION_DAYS = 30;
  public lastTickAtMs: number | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'observability-cleanup',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 90_000_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('0 4 * * *', { name: 'observability-cleanup', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl());
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron observability-cleanup disparado');
    const startedAt = Date.now();

    try {
      const result = await this.db.execute(
        sql`DELETE FROM public.observable_events
            WHERE ts < NOW() - (${ObservabilityCleanupCron.RETENTION_DAYS}::int * INTERVAL '1 day')
            RETURNING 1`,
      );

      // postgres-js devuelve array de filas; longitud = filas eliminadas
      const deletedCount = Array.isArray(result) ? result.length : 0;

      this.logger.log(
        `observability-cleanup completado: ${deletedCount} filas eliminadas en ${Date.now() - startedAt}ms`,
      );

      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'observability-cleanup',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          deletedCount,
          retentionDays: ObservabilityCleanupCron.RETENTION_DAYS,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron observability-cleanup falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'observability-cleanup',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
