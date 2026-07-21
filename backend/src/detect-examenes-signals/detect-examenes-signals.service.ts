import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { OepSignalsQueriesService } from '../oep-signals/oep-signals-queries.service';
import {
  buildExamenSignals,
  type ExamenNotaCandidate,
} from './build-examen-signals';

export interface ExamenesSignalsStats {
  candidates: number;
  emitted: number;
  inserted: number;
}

/**
 * Sensor `nota_examen`: superficie las fechas de examen que el cron
 * `detect-notas-convocatoria` YA extrae a `convocatoria_notas.llm_extraction.fecha_examen`
 * pero que hasta ahora no leía nadie (0 triadas de 1.862 notas).
 *
 * Lee las notas de ALTA confianza con fecha de examen, se queda solo con las que son
 * una fecha de día único inequívoca, NO están ya capturadas (exam_date/hito
 * `ejercicio_1`) y son de una oposición viva, y emite una señal OEP `nota_examen`
 * para triaje humano en `/admin/oep-signals`. NUNCA auto-aplica: el detector es
 * ruidoso (mis-atribuye procesos hermanos de la misma página, extrae fechas de docs
 * viejos), así que la fecha la confirma y aplica una persona.
 *
 * Idempotente por `dedupeKey` (`nota_examen:opoId:fecha`): correr a diario no duplica.
 */
@Injectable()
export class DetectExamenesSignalsService {
  private readonly logger = new Logger(DetectExamenesSignalsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly queries: OepSignalsQueriesService,
  ) {}

  /**
   * Suelo de año: descarta fechas de ejercicios de años pasados (docs viejos mal
   * extraídos, p.ej. "15/05/2010"). El año en curso menos uno da margen a exámenes
   * de finales del año anterior que sigan siendo relevantes.
   */
  private minYear(): number {
    return new Date().getUTCFullYear() - 1;
  }

  async run(): Promise<ExamenesSignalsStats> {
    const startedAt = Date.now();
    this.logger.log('Buscando fechas de examen sin capturar en convocatoria_notas...');

    const rows = (await this.db.execute(sql`
      SELECT
        cn.id                              AS "notaId",
        cn.oposicion_id                    AS "oposicionId",
        o.slug                             AS "slug",
        cn.url                             AS "url",
        cn.llm_extraction->>'fecha_examen' AS "fechaRaw",
        cn.llm_extraction->'citas'         AS "citas",
        cv.exam_date::text                 AS "examDateActual",
        (
          SELECT max(h2.fecha)::text
          FROM convocatoria_hitos h2
          WHERE h2.oposicion_id = o.id
            AND h2.tipo IN ('oep_aprobada', 'convocatoria_publicada', 'bases_publicadas')
        )                                  AS "cicloInicio"
      FROM convocatoria_notas cn
      JOIN oposiciones o
        ON o.id = cn.oposicion_id AND o.is_active = true
      LEFT JOIN convocatorias cv
        ON cv.oposicion_id = o.id AND cv.is_current = true AND cv.archived_at IS NULL
      WHERE cn.confianza = 'alta'
        AND cn.llm_extraction->>'fecha_examen' IS NOT NULL
        AND cn.llm_extraction->>'fecha_examen' <> 'null'
        AND NOT EXISTS (
          SELECT 1 FROM convocatoria_hitos h
          WHERE h.oposicion_id = o.id AND h.tipo = 'ejercicio_1'
        )
    `)) as unknown as ExamenNotaCandidate[];

    const signals = buildExamenSignals(rows, { minYear: this.minYear() });

    let inserted = 0;
    for (const signal of signals) {
      const { inserted: didInsert } = await this.queries.insertSignal(signal);
      if (didInsert) {
        inserted++;
        this.logger.warn(
          `${signal.rawExtraction?.slug ?? signal.oposicionId}: fecha de examen ` +
            `${signal.detectedFechaExamen} → señal nota_examen`,
        );
      }
    }

    const stats: ExamenesSignalsStats = {
      candidates: rows.length,
      emitted: signals.length,
      inserted,
    };
    this.logger.log(
      `Completado en ${((Date.now() - startedAt) / 1000).toFixed(1)}s: ${JSON.stringify(stats)}`,
    );
    return stats;
  }
}
