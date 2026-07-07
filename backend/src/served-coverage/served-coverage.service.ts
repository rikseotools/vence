import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

export type CoverageFindingKind = 'mv_stale' | 'empty_disponible';

export interface CoverageFinding {
  positionType: string;
  topicNumber: number;
  mvTotal: number;
  kind: CoverageFindingKind;
}

export interface CoverageStats {
  checked: number;
  mvStale: number;
  emptyDisponible: number;
  findings: CoverageFinding[];
}

type CoverageRow = {
  position_type: string;
  topic_number: number;
  has_q: boolean;
  mv_total: number;
};

/**
 * Audita la cobertura SERVIDA por tema para cazar dos fallos silenciosos que
 * dejan un tema "En desarrollo" en el hub de tests aunque tenga preguntas:
 *
 *   1. MV STALE — el hub lee los conteos de la materialized view
 *      `topic_law_question_summary`. Si un tema `disponible` tiene preguntas por
 *      scope pero la MV le da 0 (oposición recién creada / scope cambiado sin
 *      refrescar la MV), sale "En desarrollo".
 *   2. DISPONIBLE VACÍO — tema marcado `disponible=true` sin ninguna pregunta en
 *      su scope (misconfig).
 *
 * Motivación: incidente TAI 07/07/2026 (Bloque I, 7.385 preguntas, salía "En
 * desarrollo" porque la MV no incluía la oposición nueva).
 */
@Injectable()
export class ServedCoverageService {
  private readonly logger = new Logger(ServedCoverageService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(): Promise<CoverageStats> {
    // Por cada topic disponible: ¿tiene preguntas por scope? (EXISTS corta al
    // primer match → ~1s para ~2.600 temas) + total que le atribuye la MV.
    const res = await this.db.execute<CoverageRow>(sql`
      SELECT
        t.position_type,
        t.topic_number,
        EXISTS(
          SELECT 1 FROM topic_scope ts
          JOIN articles a ON a.law_id = ts.law_id
            AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
          JOIN questions q ON q.primary_article_id = a.id
            AND q.is_active = true AND q.exam_case_id IS NULL
          WHERE ts.topic_id = t.id
        ) AS has_q,
        COALESCE((SELECT sum(s.total_questions) FROM topic_law_question_summary s WHERE s.topic_id = t.id), 0)::int AS mv_total
      FROM topics t
      WHERE t.is_active = true AND t.disponible = true
    `);
    const rows = (Array.isArray(res) ? res : ((res as { rows?: CoverageRow[] }).rows ?? [])) as CoverageRow[];

    const findings: CoverageFinding[] = [];
    for (const r of rows) {
      const base = { positionType: r.position_type, topicNumber: r.topic_number, mvTotal: r.mv_total };
      if (!r.has_q) {
        findings.push({ ...base, kind: 'empty_disponible' });
      } else if (r.mv_total === 0) {
        findings.push({ ...base, kind: 'mv_stale' });
      }
    }

    return {
      checked: rows.length,
      mvStale: findings.filter((f) => f.kind === 'mv_stale').length,
      emptyDisponible: findings.filter((f) => f.kind === 'empty_disponible').length,
      findings,
    };
  }
}
