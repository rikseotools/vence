import { Inject, Injectable, Logger } from '@nestjs/common';
import type postgres from 'postgres';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

// El cliente postgres-js crudo subyacente a Drizzle (para reservar una conexión con
// statement_timeout propio en el refresh pesado). Drizzle lo expone en runtime como
// `db.$client` pero no en el tipo → cast estructural mínimo.
type PgClient = ReturnType<typeof postgres>;

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
    // La función hace `REFRESH MATERIALIZED VIEW CONCURRENTLY` ×2 y tarda 12-44s+,
    // LEGÍTIMAMENTE por encima del `statement_timeout: 30s` del pool (job de fondo de
    // analítica) → moría con "canceling statement due to statement timeout" y el cron
    // se marcaba fallido (alertas de madrugada 12/07). CONCURRENTLY no puede ir en una
    // transacción → descarta `SET LOCAL`; y `ALTER FUNCTION SET statement_timeout` NO
    // sirve (el timeout se arma en el statement EXTERIOR, no lo re-arma la config de la
    // función — probado a ciencia cierta 12/07). Fix robusto: conexión RESERVADA
    // dedicada con su propio statement_timeout amplio, reseteado al soltarla → sin fuga
    // al resto del pool. El resto de queries siguen protegidas por los 30s.
    const client = (this.db as unknown as { $client: PgClient }).$client;
    const conn = await client.reserve();
    let rows: Array<{ result: RefreshRow }>;
    try {
      await conn`SET statement_timeout = '180000'`;
      rows = (await conn`SELECT (refresh_topic_question_summary())::jsonb AS result`) as unknown as Array<{ result: RefreshRow }>;
    } finally {
      // Restaurar EXPLÍCITAMENTE el timeout del pool (30s) antes de devolver la
      // conexión — NO `RESET` (revierte al default de sesión, que puede ser 0 =
      // sin límite → una conexión sin protección al reusarse). Debe coincidir con
      // `statement_timeout` de db/database.module.ts. Best-effort.
      try {
        await conn`SET statement_timeout = '30000'`;
      } catch {
        /* si falla, al soltar la conexión postgres-js la descarta */
      }
      conn.release();
    }
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
