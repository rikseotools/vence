import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { CacheService } from '../cache/cache.service';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import {
  RANKING_MEDALS,
  type CachedMedals,
  type GetMedalsResponse,
  type UserMedal,
} from './medals.constants';

/**
 * Servicio de medallas (Bloque 3 canary).
 *
 * Port del GET de `lib/api/medals/queries.ts` (función `getUserMedals` +
 * `getStoredUserMedals` + `normalizeStoredMedal`).
 *
 * El POST de medallas (`checkAndSaveNewMedals`) sigue en Vercel — esta
 * primera versión solo cubre el read path, que es lo que más se llama
 * (badge del header).
 *
 * Estrategia cache-first (mismo patrón que Vercel):
 *   - Cache fresh <6h en `medals:{userId}` → devuelve sin tocar BD.
 *   - Cache stale o miss → SELECT lookup en user_medals (PK).
 *   - Timeout BD → si hay stale (<24h), servir stale. Si no → 503.
 *
 * Mismo Redis Upstash que la app Next.js: invalidación POST→GET coherente.
 */
@Injectable()
export class MedalsService {
  private readonly logger = new Logger(MedalsService.name);

  // Quick-fail para la query BD. Si user_medals (lookup PK) tarda más,
  // algo va muy mal — mejor servir 503 retryable que aguantar.
  private static readonly READ_TIMEOUT_MS = 3000;
  // Fresh window: 6h. Igual que en Vercel.
  private static readonly FRESH_WINDOW_MS = 6 * 60 * 60 * 1000;
  // Stale TTL: 24h. Igual que en Vercel.
  private static readonly STALE_TTL_S = 24 * 60 * 60;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly cache: CacheService,
  ) {}

  /**
   * GET de medallas con cache-first. Devuelve `cacheStatus` para que el
   * controller añada el header `x-medals-cache: hit|miss|stale` y se pueda
   * comparar con el equivalente de Vercel durante el canary.
   */
  async getUserMedals(userId: string): Promise<{
    response: GetMedalsResponse;
    cacheStatus: 'hit' | 'miss' | 'stale';
    httpStatus: number;
  }> {
    const cacheKey = `medals:${userId}`;
    const cached = await this.cache.getCached<CachedMedals>(cacheKey);

    // Fast path: cache fresh (<6h) — devolver sin tocar BD.
    if (
      cached?.data?.success &&
      Date.now() - cached.ts < MedalsService.FRESH_WINDOW_MS
    ) {
      return { response: cached.data, cacheStatus: 'hit', httpStatus: 200 };
    }

    // Miss/stale: lectura ligera de user_medals con quick-fail.
    try {
      const result = await this.withTimeout(
        () => this.getStoredUserMedals(userId),
        MedalsService.READ_TIMEOUT_MS,
      );
      const response: GetMedalsResponse = { success: true, medals: result };
      // Fire-and-forget: Redis no bloquea la respuesta.
      this.cache.setCached(
        cacheKey,
        { data: response, ts: Date.now() },
        MedalsService.STALE_TTL_S,
      );
      return { response, cacheStatus: 'miss', httpStatus: 200 };
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === 'DB_TIMEOUT';
      if (isTimeout && cached?.data?.success) {
        // Stale-if-error: servir stale (200) en vez de 503.
        const ageS = Math.floor((Date.now() - cached.ts) / 1000);
        this.logger.warn(
          `timeout, sirviendo cache stale (${ageS}s old) para user ${userId.slice(0, 8)}`,
        );
        return { response: cached.data, cacheStatus: 'stale', httpStatus: 200 };
      }
      if (isTimeout) {
        this.logger.warn(`Timeout sin cache para user ${userId.slice(0, 8)}`);
        return {
          response: {
            success: false,
            error: 'Servicio saturado momentáneamente. Reintenta en 5 minutos.',
          },
          cacheStatus: 'miss',
          httpStatus: 503,
        };
      }
      this.logger.error('Error inesperado leyendo medallas', err);
      return {
        response: { success: false, error: 'Error interno del servidor' },
        cacheStatus: 'miss',
        httpStatus: 500,
      };
    }
  }

  /**
   * Lookup directo en user_medals por user_id. Index Scan PK, <5ms típico.
   * Devuelve la lista normalizada (cada row → UserMedal con title/desc/etc
   * resueltos contra RANKING_MEDALS).
   */
  private async getStoredUserMedals(userId: string): Promise<UserMedal[]> {
    const rows = (await this.db.execute(
      sql`SELECT medal_id, medal_data, unlocked_at
          FROM user_medals
          WHERE user_id = ${userId}::uuid
          ORDER BY unlocked_at DESC`,
    )) as unknown as Array<{
      medal_id: string;
      medal_data: unknown;
      unlocked_at: string | null;
    }>;

    return rows
      .map((row) => this.normalizeStoredMedal(row, userId))
      .filter((m): m is UserMedal => m !== null);
  }

  /**
   * Convierte un row crudo de user_medals a UserMedal. `medal_data` es
   * jsonb con el snapshot del momento en que se ganó (puede tener title,
   * desc, etc) — se prioriza ese snapshot y se cae a `RANKING_MEDALS`
   * como fallback de definición.
   */
  private normalizeStoredMedal(
    row: { medal_id: string; medal_data: unknown; unlocked_at: string | null },
    userId: string,
  ): UserMedal | null {
    const medalData = row?.medal_data;
    const stored: Record<string, unknown> =
      typeof medalData === 'object' && medalData !== null
        ? (medalData as Record<string, unknown>)
        : {};
    const medalId =
      typeof row?.medal_id === 'string'
        ? row.medal_id
        : typeof stored.id === 'string'
          ? stored.id
          : null;
    if (typeof medalId !== 'string') return null;

    const definition = Object.values(RANKING_MEDALS).find(
      (medal) => medal.id === medalId,
    );
    const unlockedAt = row?.unlocked_at
      ? new Date(row.unlocked_at).toISOString()
      : typeof stored.unlockedAt === 'string'
        ? stored.unlockedAt
        : new Date().toISOString();

    const storedStats = stored.stats as
      | { totalQuestions?: number; correctAnswers?: number; accuracy?: number }
      | undefined;

    return {
      id: medalId,
      title:
        typeof stored.title === 'string'
          ? stored.title
          : (definition?.title ?? medalId),
      description:
        typeof stored.description === 'string'
          ? stored.description
          : (definition?.description ?? ''),
      category:
        typeof stored.category === 'string'
          ? stored.category
          : (definition?.category ?? 'Ranking'),
      emailTemplate:
        typeof stored.emailTemplate === 'string'
          ? stored.emailTemplate
          : (definition?.emailTemplate ?? ''),
      unlocked: true,
      progress:
        typeof stored.progress === 'string'
          ? stored.progress
          : 'Medalla conseguida',
      unlockedAt,
      rank: typeof stored.rank === 'number' ? stored.rank : 0,
      period: typeof stored.period === 'string' ? stored.period : 'stored',
      stats:
        typeof stored.stats === 'object' && stored.stats !== null
          ? {
              userId,
              totalQuestions: Number(storedStats?.totalQuestions ?? 0),
              correctAnswers: Number(storedStats?.correctAnswers ?? 0),
              accuracy: Number(storedStats?.accuracy ?? 0),
            }
          : {
              userId,
              totalQuestions: 0,
              correctAnswers: 0,
              accuracy: 0,
            },
    };
  }

  /**
   * Quick-fail wrapper. Si la promise no resuelve en `ms`, lanza
   * Error('DB_TIMEOUT'). Igual concepto que `lib/db/timeout.ts` de la app.
   */
  private async withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error('DB_TIMEOUT')), ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
