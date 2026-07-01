import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { CacheService } from '../cache/cache.service';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { MedalEmailService } from '../email/medal-email.service';
import {
  RANKING_MEDALS,
  type CachedMedals,
  type CheckMedalsResponse,
  type GetMedalsResponse,
  type MedalDefinition,
  type PeriodConfig,
  type RankingUser,
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

  // Circuit breaker para getRankingForPeriod. Si la query agota
  // statement_timeout, abrimos el circuit 5min — los siguientes hits
  // devuelven [] sin tocar BD (evita cascada cuando BD está saturada).
  // Estado por instancia singleton — al ser proceso largo se mantiene
  // entre requests (a diferencia de Vercel donde cada lambda lo tiene
  // efímero). Eso es UNA mejora vs el comportamiento Vercel.
  private circuitOpenUntil = 0;
  private static readonly CIRCUIT_BREAKER_DURATION_MS = 5 * 60 * 1000;
  // TTL del cache Redis del ranking: 30 días (períodos cerrados, no cambian).
  private static readonly RANKING_REDIS_TTL_S = 30 * 24 * 60 * 60;

  // Flag para desactivar el cálculo runtime si BD está bajo presión.
  // Lectura en constructor (no en cada request) — cambio requiere reinicio.
  private readonly runtimeRecalcEnabled: boolean;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly cache: CacheService,
    private readonly emailService: MedalEmailService,
    config: ConfigService,
  ) {
    // env validado por Zod → ya viene como boolean en config.
    this.runtimeRecalcEnabled = config.get<boolean>(
      'MEDALS_RUNTIME_RECALC_ENABLED',
      true,
    );
  }

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

  // ═══════════════════════════════════════════════════════════════════
  // POST /api/medals — verifica medallas nuevas y las guarda
  // Port 1:1 de checkAndSaveNewMedals de lib/api/medals/queries.ts.
  // Cero dependencia a Vercel ni a Supabase Auth.
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Verifica si el usuario tiene medallas nuevas (cálculo runtime de
   * ranking) e INSERTa las nuevas en user_medals. Invalida cache.
   * Envía emails de felicitación (best-effort) para las nuevas.
   *
   * Flag MEDALS_RUNTIME_RECALC_ENABLED=false desactiva todo el cálculo
   * sin tocar BD (devuelve newMedals: []). Útil bajo presión.
   */
  async checkAndSaveNewMedals(userId: string): Promise<CheckMedalsResponse> {
    if (!this.runtimeRecalcEnabled) {
      return { success: true, newMedals: [] };
    }

    try {
      const storedMedals = await this.getStoredUserMedals(userId);
      const currentMedals = await this.calculateCurrentUserMedals(
        userId,
        storedMedals,
      );
      const storedMedalIds = new Set(storedMedals.map((m) => m.id));
      const newMedals = currentMedals.filter((m) => !storedMedalIds.has(m.id));

      if (newMedals.length === 0) {
        return { success: true, newMedals: [] };
      }

      // INSERT idempotente — ON CONFLICT por (user_id, medal_id) DO NOTHING.
      for (const medal of newMedals) {
        await this.db.execute(
          sql`INSERT INTO user_medals (user_id, medal_id, medal_data, unlocked_at, viewed)
              VALUES (${userId}::uuid, ${medal.id}, ${JSON.stringify(medal)}::jsonb, NOW(), false)
              ON CONFLICT (user_id, medal_id) DO NOTHING`,
        );
      }

      this.logger.log(
        `${newMedals.length} medalla(s) guardada(s) para user ${userId.slice(0, 8)}`,
      );

      // Invalidar cache para que el próximo GET vea las medallas nuevas
      // (vs servir stale durante ≤6h). Cross-runtime coherente — Vercel
      // también lo verá fresh porque comparten Upstash.
      await this.cache.invalidate(`medals:${userId}`);

      // Emails best-effort solo si el user NO está activo ahora mismo
      // (evita interrumpir su sesión actual con notificaciones email).
      const isActive = await this.isUserRecentlyActive(userId);
      if (!isActive) {
        // Secuencial intencional: si Resend rate-limita, no spammeamos.
        for (const medal of newMedals) {
          await this.emailService.sendMedalCongratulation(userId, medal);
        }
      }

      return { success: true, newMedals };
    } catch (err) {
      this.logger.error('Error en checkAndSaveNewMedals:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Error desconocido',
      };
    }
  }

  /**
   * Determina qué períodos evaluar para asignar medallas.
   * Medallas se otorgan AL DÍA SIGUIENTE del período cerrado:
   *   - Diarias: siempre (evalúa ayer)
   *   - Semanales: solo lunes (evalúa semana anterior completa)
   *   - Mensuales: solo día 1 (evalúa mes anterior completo)
   * Port literal de getMedalPeriods de la app.
   */
  private getMedalPeriods(now: Date): {
    today?: PeriodConfig;
    week?: PeriodConfig;
    month?: PeriodConfig;
  } {
    const isMonday = now.getUTCDay() === 1;
    const isFirstDayOfMonth = now.getUTCDate() === 1;
    const periods: {
      today?: PeriodConfig;
      week?: PeriodConfig;
      month?: PeriodConfig;
    } = {};

    // Diarias: evaluar ayer
    const yesterday = new Date(now);
    yesterday.setUTCDate(now.getUTCDate() - 1);
    const yesterdayStart = new Date(
      Date.UTC(
        yesterday.getUTCFullYear(),
        yesterday.getUTCMonth(),
        yesterday.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const yesterdayEnd = new Date(
      Date.UTC(
        yesterday.getUTCFullYear(),
        yesterday.getUTCMonth(),
        yesterday.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );
    periods.today = {
      name: 'today',
      startDate: yesterdayStart,
      endDate: yesterdayEnd,
    };

    // Semanales: lunes anterior a domingo (solo si hoy es lunes)
    if (isMonday) {
      const weekStart = new Date(now);
      weekStart.setUTCDate(now.getUTCDate() - 8);
      weekStart.setUTCHours(0, 0, 0, 0);
      const weekEnd = new Date(now);
      weekEnd.setUTCDate(now.getUTCDate() - 2);
      weekEnd.setUTCHours(23, 59, 59, 999);
      periods.week = { name: 'week', startDate: weekStart, endDate: weekEnd };
    }

    // Mensuales: mes anterior completo (solo si hoy es día 1)
    if (isFirstDayOfMonth) {
      const lastMonthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0),
      );
      const lastMonthEnd = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999),
      );
      periods.month = {
        name: 'month',
        startDate: lastMonthStart,
        endDate: lastMonthEnd,
      };
    }

    return periods;
  }

  /**
   * Calcula qué medallas tiene el user actualmente basado en su ranking
   * en cada período evaluable. Solo añade las que no estén ya almacenadas.
   */
  private async calculateCurrentUserMedals(
    userId: string,
    storedMedals: UserMedal[],
  ): Promise<UserMedal[]> {
    try {
      const now = new Date();
      const periods = this.getMedalPeriods(now);
      const medals: UserMedal[] = [...storedMedals];
      const existingIds = new Set(storedMedals.map((m) => m.id));

      for (const [, period] of Object.entries(periods)) {
        if (!period) continue;
        const ranking = await this.getRankingForPeriod(
          period.startDate.toISOString(),
          period.endDate.toISOString(),
        );
        const periodMedals = this.assignMedalsForPeriod(
          period.name,
          ranking,
          userId,
        );
        for (const medal of periodMedals) {
          if (existingIds.has(medal.id)) continue;
          existingIds.add(medal.id);
          medals.push(medal);
        }
      }

      return medals;
    } catch (err) {
      this.logger.error('Error en calculateCurrentUserMedals:', err);
      return storedMedals;
    }
  }

  /**
   * Ranking por período con cache Redis permanente + circuit breaker.
   * Períodos cerrados (ayer, sem pasada, mes pasado) → ranking nunca
   * cambia → cache permanente (TTL 30d, invalidar manual si hace falta).
   * Si BD agota statement_timeout → abre circuit 5min y devuelve [].
   */
  private async getRankingForPeriod(
    startISO: string,
    endISO: string,
  ): Promise<RankingUser[]> {
    if (Date.now() < this.circuitOpenUntil) {
      this.logger.warn(
        'Circuit breaker abierto — devolviendo [] sin tocar BD',
      );
      return [];
    }

    const cacheKey = `medals_ranking:${startISO}:${endISO}:v2`;
    try {
      // Cache-first: si Upstash tiene la key, devuélvela. Si no, ejecuta
      // la query pesada y cachea. Mismo cache key que Vercel — coherente.
      const cached = await this.cache.getCached<RankingUser[]>(cacheKey);
      if (cached !== null) return cached;

      const ranking = await this.getRankingForPeriodInternal(startISO, endISO);
      this.cache.setCached(
        cacheKey,
        ranking,
        MedalsService.RANKING_REDIS_TTL_S,
      );
      return ranking;
    } catch (err) {
      if (this.isStatementTimeoutError(err)) {
        this.circuitOpenUntil =
          Date.now() + MedalsService.CIRCUIT_BREAKER_DURATION_MS;
        this.logger.warn(
          `Statement timeout en ranking ${startISO}..${endISO}. Circuit abierto 5min.`,
        );
      } else {
        this.logger.error('Error en getRankingForPeriod:', err);
      }
      return [];
    }
  }

  /**
   * Query estructuralmente cara: GROUP BY user_id sobre test_questions
   * (~192k filas en peor caso "month"). Devuelve top 100 por accuracy
   * desempate por volumen, filtrando users con <5 preguntas.
   */
  private async getRankingForPeriodInternal(
    startISO: string,
    endISO: string,
  ): Promise<RankingUser[]> {
    const rows = (await this.db.execute(
      sql`SELECT
            tq.user_id,
            COUNT(*)::bigint                                  AS total_questions,
            COUNT(*) FILTER (WHERE tq.is_correct)::bigint     AS correct_answers,
            ROUND((COUNT(*) FILTER (WHERE tq.is_correct)::numeric / COUNT(*)) * 100, 0) AS accuracy
          FROM test_questions tq
          WHERE tq.user_id IS NOT NULL
            AND tq.created_at >= ${startISO}::timestamptz
            AND tq.created_at <= ${endISO}::timestamptz
            -- Excluir cuentas canary/smoke (100% sintético): no deben ganar
            -- medallas ni desplazar a usuarios reales del 1er puesto.
            AND tq.user_id NOT IN (SELECT id FROM user_profiles WHERE registration_source = 'internal_canary')
          GROUP BY tq.user_id
          HAVING COUNT(*) >= 5
          ORDER BY accuracy DESC, total_questions DESC
          LIMIT 100`,
    )) as unknown as Array<{
      user_id: string;
      total_questions: bigint | number;
      correct_answers: bigint | number;
      accuracy: bigint | number;
    }>;

    return rows.map((row) => ({
      userId: row.user_id,
      totalQuestions: Number(row.total_questions),
      correctAnswers: Number(row.correct_answers),
      accuracy: Number(row.accuracy),
    }));
  }

  /**
   * Función pura: dado un ranking y un userId, devuelve qué medallas
   * merece. Port literal de assignMedalsForPeriod.
   */
  private assignMedalsForPeriod(
    periodName: string,
    ranking: RankingUser[],
    userId: string,
  ): UserMedal[] {
    const medals: UserMedal[] = [];
    const userRank = ranking.findIndex((u) => u.userId === userId) + 1;
    if (userRank === 0) return medals;

    const userStats = ranking[userRank - 1];
    const now = new Date().toISOString();

    // Primer lugar
    if (userRank === 1 && ranking.length >= 1) {
      const def = RANKING_MEDALS[`FIRST_PLACE_${periodName.toUpperCase()}`];
      if (def) {
        medals.push(
          this.buildMedal(def, userRank, ranking.length, periodName, userStats, now),
        );
      }
    }

    // Top 3 (posiciones 2 y 3)
    if (userRank >= 2 && userRank <= 3 && ranking.length >= 2) {
      const def = RANKING_MEDALS[`TOP_3_${periodName.toUpperCase()}`];
      if (def) {
        medals.push(
          this.buildMedal(def, userRank, ranking.length, periodName, userStats, now),
        );
      }
    }

    // Medallas de rendimiento y volumen (solo semanales)
    if (periodName === 'week') {
      // Alta precisión: ≥90% con ≥20 preguntas
      if (userStats.accuracy >= 90 && userStats.totalQuestions >= 20) {
        medals.push(
          this.buildMedal(
            RANKING_MEDALS.HIGH_ACCURACY,
            userRank,
            ranking.length,
            periodName,
            userStats,
            now,
            `${userStats.accuracy}% de aciertos en ${userStats.totalQuestions} preguntas`,
          ),
        );
      }
      // Volumen: ≥100 preguntas
      if (userStats.totalQuestions >= 100) {
        medals.push(
          this.buildMedal(
            RANKING_MEDALS.VOLUME_LEADER,
            userRank,
            ranking.length,
            periodName,
            userStats,
            now,
            `${userStats.totalQuestions} preguntas respondidas esta semana`,
          ),
        );
      }
    }

    return medals;
  }

  /** Helper puro: construye UserMedal desde MedalDefinition + stats. */
  private buildMedal(
    def: MedalDefinition,
    rank: number,
    totalUsers: number,
    period: string,
    stats: RankingUser,
    unlockedAt: string,
    customProgress?: string,
  ): UserMedal {
    return {
      ...def,
      unlocked: true,
      progress: customProgress ?? `Posicion #${rank} de ${totalUsers} usuarios`,
      unlockedAt,
      rank,
      period,
      stats: {
        userId: stats.userId,
        totalQuestions: stats.totalQuestions,
        correctAnswers: stats.correctAnswers,
        accuracy: stats.accuracy,
      },
    };
  }

  /** True si el user respondió alguna pregunta en los últimos 5 min. */
  private async isUserRecentlyActive(userId: string): Promise<boolean> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const rows = (await this.db.execute(
        sql`SELECT 1
            FROM test_questions tq
            WHERE tq.user_id = ${userId}::uuid
              AND tq.created_at >= ${fiveMinutesAgo.toISOString()}::timestamptz
            LIMIT 1`,
      )) as unknown as Array<unknown>;
      return rows.length > 0;
    } catch {
      return false;
    }
  }

  /** Detecta error Postgres 57014 (statement timeout). */
  private isStatementTimeoutError(err: unknown): boolean {
    if (typeof err !== 'object' || err === null) return false;
    const e = err as { code?: string; message?: string };
    return e.code === '57014' || /statement timeout/i.test(e.message ?? '');
  }
}
