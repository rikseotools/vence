import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

interface RawTemaRow {
  question_id: string;
  topic_id: string;
  topic_number: number;
  topic_title: string | null;
}

interface TemaCacheEntry {
  temaNumber: number | null;
  timestamp: number;
}

/**
 * Servicio TemaResolver — Fase 3 (fast path implementado).
 *
 * Port literal de `resolveTemaByQuestionIdFast` de
 * lib/api/tema-resolver/queries.ts. NO portamos el resto del módulo
 * (resolveTemasBatch, resolveTemaByArticle, etc. son para flujos
 * batch/admin que no afectan a answer-and-save).
 */
@Injectable()
export class TemaResolverService {
  private readonly logger = new Logger(TemaResolverService.name);

  /** Cache in-memory por (questionId, positionType). TTL 30 min. */
  private readonly cache = new Map<string, TemaCacheEntry>();
  private static readonly CACHE_TTL_MS = 30 * 60 * 1000;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Resuelve el `topic_number` de una pregunta legislativa rápidamente
   * mediante una sola query SQL con CTE + JOIN a `topic_scope` + `topics`.
   *
   * Path único: pregunta → artículo → topic_scope que cubre ese artículo
   * (con `article_numbers @> ARRAY[...]` o `article_numbers IS NULL` para
   * "ley completa") → topic activo del position_type pedido.
   *
   * DISTINCT ON con ORDER BY prefiere matches específicos
   * (`article_numbers IS NOT NULL`) sobre matches de "ley completa".
   *
   * Devuelve null si:
   *  - questionId no encontrado en `questions`
   *  - questions.primary_article_id es NULL
   *  - No hay topic_scope que cubra esa ley para ese position_type
   *  - Error de BD (todos se convierten en null — graceful)
   */
  async resolveTemaByQuestionIdFast(
    questionId: string,
    positionType: string,
  ): Promise<number | null> {
    if (!questionId) return null;

    const cacheKey = `${questionId}:${positionType}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < TemaResolverService.CACHE_TTL_MS) {
      return cached.temaNumber;
    }

    try {
      // Single query con CTE — port literal del frontend.
      const rows = (await this.db.execute(sql`
        WITH question_data AS (
          SELECT q.id, a.law_id, a.article_number
          FROM questions q
          JOIN articles a ON q.primary_article_id = a.id
          WHERE q.id = ${questionId}::uuid
            AND q.primary_article_id IS NOT NULL
        )
        SELECT DISTINCT ON (qd.id)
          qd.id AS question_id,
          t.id AS topic_id,
          t.topic_number,
          t.title AS topic_title
        FROM question_data qd
        JOIN topic_scope ts ON ts.law_id = qd.law_id
        JOIN topics t ON t.id = ts.topic_id
          AND t.position_type = ${positionType}
          AND t.is_active = true
        WHERE ts.article_numbers @> ARRAY[qd.article_number]::text[]
           OR ts.article_numbers IS NULL
        ORDER BY qd.id, CASE WHEN ts.article_numbers IS NOT NULL THEN 0 ELSE 1 END
        LIMIT 1
      `)) as unknown as RawTemaRow[];

      const row = rows[0];
      const temaNumber =
        row && typeof row.topic_number === 'number' ? row.topic_number : null;

      this.cache.set(cacheKey, { temaNumber, timestamp: Date.now() });
      return temaNumber;
    } catch (err) {
      this.logger.warn(
        `Error resolviendo tema para questionId=${questionId.slice(0, 8)} positionType=${positionType}:`,
        err,
      );
      return null;
    }
  }

  /** Invalida cache para una key específica o todo el cache. */
  invalidateCache(cacheKey?: string): void {
    if (cacheKey) {
      this.cache.delete(cacheKey);
    } else {
      this.cache.clear();
    }
  }
}
