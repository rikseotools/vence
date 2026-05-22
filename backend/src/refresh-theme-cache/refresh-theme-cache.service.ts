import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, gte, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { tests } from './refresh-theme-cache.schema';

interface RefreshStats {
  totalUsers: number;
  usersProcessed: number;
  totalTopics: number;
  errors: number;
  durationSeconds: number;
}

interface BatchError {
  userId: string;
  error: string;
}

/** Refresca la caché de rendimiento por tema para todos los usuarios activos del día. */
@Injectable()
export class RefreshThemeCacheService {
  private readonly logger = new Logger(RefreshThemeCacheService.name);

  /** Lotes paralelos de usuarios: equilibra carga sin saturar el pool de Postgres. */
  private readonly batchSize = 5;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Obtiene usuarios únicos que completaron al menos un test en las últimas 24h,
   * y llama a la función RPC `refresh_user_theme_performance_cache` para cada uno.
   */
  async run(): Promise<RefreshStats> {
    const startTime = Date.now();
    this.logger.log('Iniciando refresh de caché de rendimiento por tema...');

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const activeRows = await this.db
      .select({ userId: tests.userId })
      .from(tests)
      .where(and(gte(tests.createdAt, since), eq(tests.isCompleted, true)));

    const uniqueUserIds = [
      ...new Set(
        activeRows
          .map((r) => r.userId)
          .filter((id): id is string => id !== null),
      ),
    ];

    this.logger.log(`Procesando ${uniqueUserIds.length} usuarios activos...`);

    let usersProcessed = 0;
    let totalTopics = 0;
    const batchErrors: BatchError[] = [];

    for (let i = 0; i < uniqueUserIds.length; i += this.batchSize) {
      const batch = uniqueUserIds.slice(i, i + this.batchSize);

      const results = await Promise.allSettled(
        batch.map((userId) => this.refreshUserCache(userId)),
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j]!;
        if (result.status === 'fulfilled') {
          usersProcessed++;
          totalTopics += result.value.topicsCount;
        } else {
          const reason = result.reason as unknown;
          batchErrors.push({
            userId: batch[j] ?? 'unknown',
            error: reason instanceof Error ? reason.message : String(reason),
          });
        }
      }
    }

    const durationSeconds = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));

    this.logger.log(
      `Caché de rendimiento por tema actualizado: ${usersProcessed}/${uniqueUserIds.length} usuarios, ` +
        `${totalTopics} temas en ${durationSeconds}s`,
    );

    if (batchErrors.length > 0) {
      this.logger.warn(`${batchErrors.length} errores durante el procesamiento`);
    }

    return {
      totalUsers: uniqueUserIds.length,
      usersProcessed,
      totalTopics,
      errors: batchErrors.length,
      durationSeconds,
    };
  }

  /** Llama a la función RPC `refresh_user_theme_performance_cache` para un usuario. */
  private async refreshUserCache(userId: string): Promise<{ topicsCount: number }> {
    const result = await this.db.execute<{ refresh_user_theme_performance_cache: number }>(
      sql`SELECT refresh_user_theme_performance_cache(${userId}::uuid)`,
    );

    const row = result[0];
    const topicsCount =
      row?.refresh_user_theme_performance_cache != null
        ? Number(row.refresh_user_theme_performance_cache)
        : 0;

    return { topicsCount };
  }
}
