import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

/**
 * Resultado de un muestreo del pool.
 * Espejo de la fila devuelta por la función SQL `take_pool_capacity_sample()`.
 */
export interface PoolCapacitySampleResult {
  sampleAt: Date;
  totalConns: number;
  activeConns: number;
  idleInTxOver5s: number;
  hungClientreadOver10s: number;
  frontendActiveConns: number;
  inserted: boolean;
}

interface RawRow {
  sample_at: string | Date;
  total_conns: number | string;
  active_conns: number | string;
  idle_in_tx_over_5s: number | string;
  hung_clientread_over_10s: number | string;
  frontend_active_conns: number | string;
  inserted: boolean;
}

interface RawPruneRow {
  prune_pool_capacity_samples: number;
}

/**
 * Helper estático puro — parsea la fila devuelta por la función SQL.
 * Exportado para test unitario sin tener que mockear Drizzle entero.
 */
export function parseSampleResult(rows: RawRow[]): PoolCapacitySampleResult {
  if (!rows || rows.length === 0) {
    throw new Error('take_pool_capacity_sample() devolvió 0 filas — esperado 1');
  }
  const row = rows[0];
  const sampleAt =
    row.sample_at instanceof Date ? row.sample_at : new Date(row.sample_at);
  return {
    sampleAt,
    totalConns: Number(row.total_conns),
    activeConns: Number(row.active_conns),
    idleInTxOver5s: Number(row.idle_in_tx_over_5s),
    hungClientreadOver10s: Number(row.hung_clientread_over_10s),
    frontendActiveConns: Number(row.frontend_active_conns),
    inserted: Boolean(row.inserted),
  };
}

/**
 * Servicio del cron `pool-capacity-sampler`.
 *
 * Cada tick (1 min) ejecuta:
 *   1. `take_pool_capacity_sample()` — muestrea pg_stat_activity y persiste.
 *   2. `prune_pool_capacity_samples(7)` — retención 7 días.
 *
 * La lógica SQL vive en `supabase/migrations/20260601_pool_capacity_samples.sql`.
 *
 * Roadmap: `docs/roadmap/observability-capacity.md` Acción 2.
 */
@Injectable()
export class PoolCapacitySamplerService {
  private readonly logger = new Logger(PoolCapacitySamplerService.name);

  /** Días de retención. Justificación en migration SQL. */
  private static readonly RETENTION_DAYS = 7;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(): Promise<PoolCapacitySampleResult> {
    const sampleResult = await this.db.execute(
      sql`SELECT * FROM public.take_pool_capacity_sample()`,
    );
    const parsed = parseSampleResult(sampleResult as unknown as RawRow[]);

    // Log compacto sólo cuando hay banderas rojas — evita ruido con 1.440
    // logs/día sin valor. Si todo OK, debug-level (no aparece en CloudWatch
    // a nivel info).
    const hasFlags =
      parsed.idleInTxOver5s > 0 || parsed.hungClientreadOver10s > 0;
    if (hasFlags) {
      this.logger.warn(
        `Pool flags @ ${parsed.sampleAt.toISOString()}: idle_in_tx_over_5s=${parsed.idleInTxOver5s}, hung_clientread_over_10s=${parsed.hungClientreadOver10s}, total=${parsed.totalConns}`,
      );
    } else {
      this.logger.debug(
        `Pool sample @ ${parsed.sampleAt.toISOString()}: total=${parsed.totalConns} active=${parsed.activeConns} frontend_active=${parsed.frontendActiveConns}`,
      );
    }

    // Poda — 1×/min suena excesivo pero el coste es despreciable (un DELETE
    // sin filas para borrar la mayor parte del tiempo). Más simple que tener
    // un cron separado de poda. Cuando hay filas viejas, las borra en una
    // sola tx.
    //
    // Falla silenciosa NO permitida — si la poda revienta, log explícito
    // (lo emite el cron tracker, no aquí, para que llegue a observable_events).
    const pruneResult = await this.db.execute(
      sql`SELECT public.prune_pool_capacity_samples(${PoolCapacitySamplerService.RETENTION_DAYS}::integer)`,
    );
    const pruneRows = pruneResult as unknown as RawPruneRow[];
    const deleted = Number(pruneRows[0]?.prune_pool_capacity_samples ?? 0);
    if (deleted > 0) {
      this.logger.log(
        `Podadas ${deleted} muestras antiguas (>${PoolCapacitySamplerService.RETENTION_DAYS} días).`,
      );
    }

    return parsed;
  }
}
