import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

export interface RefreshTopicSummaryStats {
  topicLawSummaryMs: number;
  topicOfficialMs: number;
  totalMs: number;
  refreshedAt: string;
}

type RefreshRow = {
  success: boolean;
  topic_law_summary_ms: number;
  topic_official_ms: number;
  total_ms: number;
  refreshed_at: string;
};

/**
 * Refresca las dos materialized views de Fase D-bis Iter 1.5:
 *   - topic_law_question_summary
 *   - topic_official_by_position
 *
 * Delega en la función SQL `refresh_topic_question_summary()` que invoca
 * `REFRESH MATERIALIZED VIEW CONCURRENTLY` sobre ambas. CONCURRENTLY evita
 * bloquear lectores activos (el endpoint `/api/topics/[numero]` sigue
 * sirviendo el snapshot anterior hasta que el refresh termina y hace swap
 * atómico).
 */
@Injectable()
export class RefreshTopicSummaryService {
  private readonly logger = new Logger(RefreshTopicSummaryService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(): Promise<RefreshTopicSummaryStats> {
    const startedAt = Date.now();
    const result = await this.db.execute<RefreshRow>(
      sql`SELECT (refresh_topic_question_summary())::jsonb AS result`,
    );
    const rows = result as unknown as Array<{ result: RefreshRow }>;
    const payload = rows[0]?.result;
    if (!payload || !payload.success) {
      throw new Error(
        `refresh_topic_question_summary devolvió payload inválido: ${JSON.stringify(payload)}`,
      );
    }
    const stats: RefreshTopicSummaryStats = {
      topicLawSummaryMs: payload.topic_law_summary_ms,
      topicOfficialMs: payload.topic_official_ms,
      totalMs: payload.total_ms,
      refreshedAt: payload.refreshed_at,
    };
    this.logger.log(
      `Refresh OK en ${stats.totalMs}ms (law=${stats.topicLawSummaryMs}ms, official=${stats.topicOfficialMs}ms, wallclock=${Date.now() - startedAt}ms)`,
    );
    return stats;
  }
}
