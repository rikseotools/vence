import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { type RefreshRankingCacheRow } from './refresh-rankings.schema';

export interface RankingRefreshStats {
  filters: Array<{
    filter: string;
    inserted: number;
    ms: number;
  }>;
  totalInserted: number;
  slowestMs: number;
  durationMs: number;
}

/**
 * Refresca la tabla `ranking_cache` para los 4 timeFilters
 * (`today`, `yesterday`, `week`, `month`) llamando a la función SQL
 * `refresh_ranking_cache()`.
 *
 * La función SQL gestiona la tabla internamente de forma transaccional
 * por timeFilter: borra e inserta dentro de la misma transacción, por lo
 * que si el cron falla en algún filtro los datos anteriores se mantienen.
 *
 * Reemplaza el endpoint Next.js `/api/cron/refresh-rankings/route.ts`
 * que tenía `maxDuration = 60` en Vercel. Aquí corre sin límite de tiempo.
 */
@Injectable()
export class RefreshRankingsService {
  private readonly logger = new Logger(RefreshRankingsService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Ejecuta `refresh_ranking_cache()` y devuelve estadísticas de la operación.
   *
   * La función SQL agrega sobre `test_questions` (potencialmente 1M+ filas
   * para el filtro `month`) por lo que puede tardar 15-20s. Al correr en
   * el backend NestJS no hay presupuesto de tiempo que lo limite.
   */
  async run(): Promise<RankingRefreshStats> {
    const startTime = Date.now();
    this.logger.log('Iniciando refresh de ranking_cache...');

    const result = await this.db.execute(
      sql`SELECT * FROM refresh_ranking_cache()`,
    );

    const rows = result as unknown as RefreshRankingCacheRow[];

    const filters = rows.map((r) => ({
      filter: r.filter_name,
      inserted: r.rows_inserted,
      ms: r.duration_ms,
    }));

    const totalInserted = filters.reduce((acc, r) => acc + r.inserted, 0);
    const slowestMs = filters.length > 0 ? Math.max(...filters.map((r) => r.ms)) : 0;
    const durationMs = Date.now() - startTime;

    this.logger.log(
      `refresh_ranking_cache() completado: ${totalInserted} filas totales, ` +
        `filtro más lento: ${slowestMs}ms, duración total: ${durationMs}ms`,
    );

    for (const f of filters) {
      this.logger.log(`  [${f.filter}] ${f.inserted} filas insertadas en ${f.ms}ms`);
    }

    return { filters, totalInserted, slowestMs, durationMs };
  }
}
