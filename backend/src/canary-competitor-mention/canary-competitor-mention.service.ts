import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

/**
 * Canary de MENCIONES A COMPETIDOR en preguntas VISIBLES.
 *
 * Incidente 10/07/2026: 1.901 preguntas (804 activas) filtraban el nombre de
 * plataformas competidoras (Aulaplus / OpositaTest) en `explanation`, importadas
 * de bancos externos con notas editoriales ("modificada por Aulaplus...").
 *
 * El fix de raíz es el GATE ANTI-COMPETIDOR en `transition_question_state` (una
 * pregunta con mención NO puede promocionarse a visible, ni por admin). Este canary
 * es la RED de seguridad para el hueco que el gate no cubre: EDITAR la explicación
 * de una pregunta YA visible con un UPDATE directo (sin transición). Si eso vuelve a
 * introducir una mención en contenido visible, lo detecta y alerta — en vez de
 * esperar a que un usuario vea el nombre del competidor.
 *
 * Usa la función SQL `public.contains_banned_competitor(text)` (fuente única de la
 * lista negra, compartida con el gate). Cero side-effects: solo cuenta (SELECT).
 */
@Injectable()
export class CanaryCompetitorMentionService {
  private readonly logger = new Logger(CanaryCompetitorMentionService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(): Promise<CanaryCompetitorMentionResult> {
    const startedAt = Date.now();
    try {
      const rows = (await this.db.execute(sql`
        SELECT COUNT(*)::int AS active_hits,
               COALESCE(
                 (ARRAY_AGG(id::text) FILTER (WHERE true))[1:5],
                 ARRAY[]::text[]
               ) AS sample_ids
        FROM public.questions
        WHERE is_active = true
          AND public.contains_banned_competitor(
                concat_ws(' ', question_text, option_a, option_b, option_c, option_d, explanation))
      `)) as unknown as Array<{ active_hits: number; sample_ids: string[] }>;
      const activeHits = rows[0]?.active_hits ?? 0;
      const sampleIds = rows[0]?.sample_ids ?? [];
      const base = { activeHits, sampleIds, durationMs: Date.now() - startedAt };
      return activeHits === 0 ? { ok: true, ...base } : { ok: false, ...base };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startedAt,
      };
    }
  }
}

export type CanaryCompetitorMentionResult =
  | { ok: true; activeHits: number; sampleIds: string[]; durationMs: number }
  | { ok: false; activeHits: number; sampleIds: string[]; durationMs: number }
  | { ok: false; error: string; durationMs: number };
