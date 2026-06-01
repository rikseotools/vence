import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { CacheService } from '../cache/cache.service';

export interface AutoPromoteCoverageResult {
  evaluated: number;
  promoted: number;
  bySalto: Record<string, number>;
  cacheInvalidated: boolean;
  durationMs: number;
}

const COVERAGE_KEY = 'oposiciones:catalog:v1';

/**
 * Sprint D del roadmap docs/roadmap/oposiciones-coverage-level-y-promocion-automatica.md.
 *
 * Cron diario que evalúa cada oposición según criterios objetivos y la
 * promueve de coverage_level cuando corresponda. Registra cada salto en
 * coverage_history para SLAs medibles.
 *
 * Niveles (orden):
 *   1. catalogada
 *   2. monitorizada
 *   3. con_temario
 *   4. con_tests
 *   5. con_landing
 *   6. full      <-- salto manual, este cron no lo aplica
 *
 * Criterios de promoción:
 *   catalogada → monitorizada:   tiene plazas, fecha examen, BOE o convocatoria
 *   monitorizada → con_temario:  ≥5 topics activos (position_type derivado del slug)
 *   con_temario → con_tests:     ≥50 preguntas activas vía topic_scope
 *   con_tests → con_landing:     landing_faqs + landing_estadisticas + examen_config completos
 *
 * Tras promover ≥1 oposición, invalida el cache Redis del catálogo para que
 * la próxima request a /api/oposiciones/catalog refresque.
 */
@Injectable()
export class AutoPromoteCoverageService {
  private readonly logger = new Logger(AutoPromoteCoverageService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly cache: CacheService,
  ) {}

  async run(): Promise<AutoPromoteCoverageResult> {
    const startedAt = Date.now();
    this.logger.log('Evaluando coverage_level para todas las oposiciones...');

    // Calcular el nivel "deseado" para cada oposición vía CTE.
    // El position_type es derivado del slug invirtiendo guiones por underscores.
    const rows = await this.db.execute<{
      id: string;
      slug: string;
      current_level: string;
      calculated_level: string;
    }>(sql`
      WITH topics_count AS (
        SELECT position_type, COUNT(*)::int AS n_topics
        FROM topics
        WHERE is_active = true
        GROUP BY position_type
      ),
      questions_count AS (
        SELECT t.position_type, COUNT(DISTINCT q.id)::int AS n_questions
        FROM topics t
        JOIN topic_scope ts ON ts.topic_id = t.id
        JOIN articles a
          ON a.law_id = ts.law_id
         AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
        JOIN questions q ON q.primary_article_id = a.id
        WHERE t.is_active = true AND q.is_active = true
        GROUP BY t.position_type
      )
      SELECT
        o.id::text AS id,
        o.slug,
        o.coverage_level AS current_level,
        CASE
          WHEN o.landing_faqs IS NOT NULL
               AND jsonb_array_length(o.landing_faqs) >= 3
               AND o.landing_estadisticas IS NOT NULL
               AND jsonb_array_length(o.landing_estadisticas) >= 3
               AND o.examen_config IS NOT NULL
               AND o.examen_config != '{}'::jsonb
               AND COALESCE(qc.n_questions, 0) >= 50
            THEN 'con_landing'
          WHEN COALESCE(qc.n_questions, 0) >= 50
            THEN 'con_tests'
          WHEN COALESCE(tc.n_topics, 0) >= 5
            THEN 'con_temario'
          WHEN o.plazas_libres IS NOT NULL
               OR o.exam_date IS NOT NULL
               OR o.boe_reference IS NOT NULL
               OR o.convocatoria_fecha IS NOT NULL
            THEN 'monitorizada'
          ELSE 'catalogada'
        END AS calculated_level
      FROM oposiciones o
      LEFT JOIN topics_count tc
             ON tc.position_type = REPLACE(o.slug, '-', '_')
      LEFT JOIN questions_count qc
             ON qc.position_type = REPLACE(o.slug, '-', '_')
      WHERE o.coverage_level != 'full'
    `);

    const list = rows as unknown as Array<{
      id: string;
      slug: string;
      current_level: string;
      calculated_level: string;
    }>;

    const RANK: Record<string, number> = {
      catalogada: 1,
      monitorizada: 2,
      con_temario: 3,
      con_tests: 4,
      con_landing: 5,
      full: 6,
    };

    const bySalto: Record<string, number> = {};
    const toPromote = list.filter(r => {
      const fromRank = RANK[r.current_level] ?? 1;
      const toRank = RANK[r.calculated_level] ?? 1;
      return toRank > fromRank;
    });

    this.logger.log(
      `Evaluadas ${list.length} oposiciones, ${toPromote.length} candidatas a promoción.`,
    );

    // Aplicar promociones en transacción
    if (toPromote.length > 0) {
      await this.db.transaction(async tx => {
        for (const r of toPromote) {
          const saltoKey = `${r.current_level}→${r.calculated_level}`;
          bySalto[saltoKey] = (bySalto[saltoKey] ?? 0) + 1;

          // UPDATE oposicion
          await tx.execute(sql`
            UPDATE oposiciones
            SET coverage_level = ${r.calculated_level}
            WHERE id = ${r.id}::uuid
          `);

          // INSERT en coverage_history
          await tx.execute(sql`
            INSERT INTO coverage_history (
              oposicion_id, from_level, to_level, reason, changed_by, metadata
            ) VALUES (
              ${r.id}::uuid,
              ${r.current_level},
              ${r.calculated_level},
              'auto_promote_criteria_met',
              'cron_auto_promote',
              ${sql.raw(`'${JSON.stringify({ slug: r.slug }).replace(/'/g, "''")}'`)}::jsonb
            )
          `);
        }
      });
    }

    // Invalidar cache catálogo si hubo promociones
    let cacheInvalidated = false;
    if (toPromote.length > 0) {
      try {
        await this.cache.invalidate(COVERAGE_KEY);
        cacheInvalidated = true;
      } catch (e) {
        this.logger.warn(
          `No se pudo invalidar cache ${COVERAGE_KEY}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }

    const durationMs = Date.now() - startedAt;
    this.logger.log(
      `auto-promote-coverage: ${toPromote.length} promociones aplicadas en ${durationMs}ms`,
    );
    if (toPromote.length > 0) {
      for (const [k, n] of Object.entries(bySalto)) {
        this.logger.log(`  · ${k}: ${n}`);
      }
    }

    return {
      evaluated: list.length,
      promoted: toPromote.length,
      bySalto,
      cacheInvalidated,
      durationMs,
    };
  }
}
