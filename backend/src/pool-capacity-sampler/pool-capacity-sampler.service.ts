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
export function parseSampleResult(
  rows: RawRow[] | { rows?: RawRow[] } | null | undefined,
): PoolCapacitySampleResult {
  // ── EL DRIVER NO SIEMPRE DEVUELVE UN ARRAY, Y ESO MATÓ ESTE CRON 28 DÍAS (07/08/2026) ────
  // `db.execute()` entrega unas veces la lista de filas y otras un `{ rows: [...] }`. Con la
  // segunda forma, `rows.length` es `undefined`, así que la guarda de «0 filas» —que existe justo
  // para esto— NO saltaba: `undefined === 0` es falso. Se pasaba de largo y reventaba en la línea
  // siguiente con «Cannot read properties of undefined (reading 'sample_at')», un error que no
  // dice nada de la causa.
  //
  // Medido: el cron falla así desde el 10/07, o sea 28 días sin muestrear el pool. Lo tapaba el
  // `as unknown as RawRow[]` del llamador, que le promete al compilador algo que el driver no
  // garantiza — un cast así apaga precisamente la comprobación que habría avisado.
  //
  // Es el mismo patrón que `drenaje_atrasado` el mismo día (asumir `Date` donde llega cadena) y
  // el que T-613 documentó con `rowCount`: en este proyecto, la forma que devuelve el driver se
  // NORMALIZA, no se supone.
  const lista: RawRow[] = Array.isArray(rows) ? rows : (rows?.rows ?? []);
  if (lista.length === 0) {
    throw new Error('take_pool_capacity_sample() devolvió 0 filas — esperado 1');
  }
  const row = lista[0];
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
    // Sin `as unknown as RawRow[]`: ese cast le prometía al compilador una forma que el driver no
    // garantiza, y fue lo que dejó pasar 28 días de fallos. `parseSampleResult` acepta las dos
    // formas y decide con el dato, no con la promesa (T-613, 07/08).
    const parsed = parseSampleResult(sampleResult as never);

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
