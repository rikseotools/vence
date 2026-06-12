import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { jitter } from '../heartbeat/jitter.helper';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { PgStatSnapshotService } from './pg-stat-snapshot.service';

/**
 * Cron diario `pg-stat-snapshot` — 00:05 UTC.
 *
 * Captura el estado de pg_stat_statements en tabla histórica para permitir
 * cálculo de deltas 24h vía `v_pg_stat_statements_delta`. Acción 3 del
 * roadmap docs/roadmap/observability-capacity.md.
 *
 * Hora elegida (00:05 UTC): después del refresh_topic_summary diario (03:30)
 * NO — antes. 00:05 es tras la medianoche UTC y antes del primer cron pesado,
 * mínima contención. El INSERT pesa <2s típico (1 SELECT + INSERT con ~5k-50k
 * filas + 1 DELETE de poda).
 *
 * Registrado en HeartbeatRegistry → expuesto en /health/crons → monitoreado
 * por la ECS liveness probe. Threshold 28h (cron diario + margen 4h).
 */
@Injectable()
export class PgStatSnapshotCron {
  private readonly logger = new Logger(PgStatSnapshotCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: PgStatSnapshotService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // Cron diario → threshold 28h (24h + margen para tolerar ejecuciones
    // tardías por jitter o contención). Grace period 120s para bootstrap.
    heartbeatRegistry.register(
      'pg-stat-snapshot',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 28 * 3600 * 1000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('5 0 * * *', { name: 'pg-stat-snapshot', timeZone: 'UTC' })
  async handle(): Promise<void> {
    // Jitter 0-60s: cron diario único, no compite con */5min — el jitter es
    // simbólico (defensa-en-profundidad por consistencia con otros crones).
    await jitter(60_000);
    this.logger.log('Cron pg-stat-snapshot disparado');
    const startedAt = Date.now();

    await runWithHeartbeat(
      this,
      'lastTickAtMs',
      async () => {
        try {
          const result = await this.service.run();
          await this.observability.emit({
            source: 'fargate',
            severity: 'info',
            eventType: 'cron_run',
            endpoint: 'pg-stat-snapshot',
            durationMs: Date.now() - startedAt,
            metadata: {
              status: 'success',
              snapshotAt: result.snapshotAt.toISOString(),
              rowsInserted: result.rowsInserted,
              sqlFunctionMs: result.durationMs,
            },
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error(`Cron pg-stat-snapshot falló: ${errorMessage}`);
          await this.observability.emit({
            source: 'fargate',
            severity: 'error',
            eventType: 'cron_run',
            endpoint: 'pg-stat-snapshot',
            durationMs: Date.now() - startedAt,
            errorMessage,
            metadata: { status: 'failure' },
          });
        }
      },
      {
        name: 'pg-stat-snapshot',
        observability: this.observability,
      },
    );
  }
}
