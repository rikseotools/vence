import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { CacheService } from '../cache/cache.service';

const COVERAGE_KEY = 'oposiciones:catalog:v1';

/**
 * Sprint G.4 — refresh nocturno de mv_oposiciones_activas.
 *
 * La MV pre-JOINEa oposicion + convocatoria vigente. Se refresca
 * CONCURRENTLY cada 30 min para que los listings públicos sirvan datos
 * actualizados sin penalty (REFRESH CONCURRENTLY no bloquea reads).
 *
 * Tras refresh, invalida cache Redis del catálogo para que el endpoint
 * /api/oposiciones/catalog devuelva el snapshot fresco.
 */
@Injectable()
export class RefreshMvOposicionesService {
  private readonly logger = new Logger(RefreshMvOposicionesService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly cache: CacheService,
  ) {}

  async run(): Promise<{ durationMs: number; cacheInvalidated: boolean }> {
    const startedAt = Date.now();

    await this.db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_oposiciones_activas`);

    let cacheInvalidated = false;
    try {
      await this.cache.invalidate(COVERAGE_KEY);
      cacheInvalidated = true;
    } catch (e) {
      this.logger.warn(
        `No se pudo invalidar cache ${COVERAGE_KEY}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    const durationMs = Date.now() - startedAt;
    this.logger.log(`mv_oposiciones_activas refreshed en ${durationMs}ms`);
    return { durationMs, cacheInvalidated };
  }
}
