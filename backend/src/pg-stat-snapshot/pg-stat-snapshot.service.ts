import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

/**
 * Resultado de un snapshot de pg_stat_statements.
 * Espejo de la tabla devuelta por la función SQL
 * `take_pg_stat_statements_snapshot()`.
 */
export interface PgStatSnapshotResult {
  snapshotAt: Date;
  rowsInserted: number;
  durationMs: number;
}

interface RawSnapshotRow {
  snapshot_at: string | Date;
  rows_inserted: number;
  duration_ms: number;
}

interface RawPruneRow {
  prune_pg_stat_statements_snapshots: number;
}

/**
 * Helper estático puro para parsear el output de la función SQL.
 * Extraído para test unitario sin necesidad de mockear Drizzle entero.
 */
export function parseSnapshotResult(rows: RawSnapshotRow[]): PgStatSnapshotResult {
  if (!rows || rows.length === 0) {
    throw new Error(
      'take_pg_stat_statements_snapshot() devolvió 0 filas — esperado: 1',
    );
  }
  const row = rows[0];
  const snapshotAt =
    row.snapshot_at instanceof Date ? row.snapshot_at : new Date(row.snapshot_at);
  return {
    snapshotAt,
    rowsInserted: Number(row.rows_inserted),
    durationMs: Number(row.duration_ms),
  };
}

/**
 * Ejecuta el snapshot diario de pg_stat_statements + poda de filas antiguas.
 *
 * Delega en 2 funciones SQL:
 *   - `take_pg_stat_statements_snapshot()`: INSERT del estado actual.
 *   - `prune_pg_stat_statements_snapshots(p_keep_days)`: DELETE filas antiguas.
 *
 * Ambas funciones están en `supabase/migrations/20260601_pg_stat_statements_snapshots.sql`.
 *
 * Cron diario `pg-stat-snapshot` a las 00:05 UTC.
 *
 * Motivación: cerrar gap "queries lentas HOY vs ruido histórico" identificado
 * en incidente 31/05/2026. Roadmap: docs/roadmap/observability-capacity.md
 * Acción 3.
 */
@Injectable()
export class PgStatSnapshotService {
  private readonly logger = new Logger(PgStatSnapshotService.name);

  /** Días de retención por defecto. Justificación en migración SQL. */
  private static readonly RETENTION_DAYS = 30;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(): Promise<PgStatSnapshotResult> {
    const startedAt = Date.now();
    this.logger.log('Iniciando snapshot de pg_stat_statements...');

    const snapshotResult = await this.db.execute(
      sql`SELECT * FROM public.take_pg_stat_statements_snapshot()`,
    );
    const parsed = parseSnapshotResult(snapshotResult as unknown as RawSnapshotRow[]);

    this.logger.log(
      `Snapshot OK: ${parsed.rowsInserted} filas insertadas en ${parsed.durationMs}ms ` +
        `(snapshot_at=${parsed.snapshotAt.toISOString()})`,
    );

    // Poda — falla silenciosa NO permitida: si la poda revienta, los datos
    // crecen sin límite. Log explícito + propagar excepción al cron, que la
    // emite a observable_events.
    const pruneResult = await this.db.execute(
      sql`SELECT public.prune_pg_stat_statements_snapshots(${PgStatSnapshotService.RETENTION_DAYS}::integer)`,
    );
    const pruneRows = pruneResult as unknown as RawPruneRow[];
    const deleted = Number(pruneRows[0]?.prune_pg_stat_statements_snapshots ?? 0);

    if (deleted > 0) {
      this.logger.log(
        `Podadas ${deleted} filas antiguas (>${PgStatSnapshotService.RETENTION_DAYS} días).`,
      );
    }

    const totalMs = Date.now() - startedAt;
    this.logger.log(`Cron pg-stat-snapshot completado en ${totalMs}ms total.`);

    return parsed;
  }
}
