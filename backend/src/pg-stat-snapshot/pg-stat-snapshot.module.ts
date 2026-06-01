import { Module } from '@nestjs/common';
import { PgStatSnapshotCron } from './pg-stat-snapshot.cron';
import { PgStatSnapshotService } from './pg-stat-snapshot.service';

/**
 * Acción 3 del roadmap docs/roadmap/observability-capacity.md.
 * Cron diario que persiste el estado de pg_stat_statements en
 * `pg_stat_statements_snapshots` para cálculo de deltas 24h.
 */
@Module({
  providers: [PgStatSnapshotService, PgStatSnapshotCron],
  exports: [PgStatSnapshotService],
})
export class PgStatSnapshotModule {}
