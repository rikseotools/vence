// Handler: user_article_stats (Fase 1.3 outbox sprint).
//
// Replica exactamente la lógica de la función SQL `update_user_article_stats`
// (trigger AFTER INSERT/UPDATE OF is_correct/DELETE en test_questions).
//
// SHADOW MODE: este handler escribe en `user_article_stats_shadow` (no en
// la tabla real). El trigger SQL original sigue activo escribiendo en
// `user_article_stats`. Después de 24h, una query diff compara ambas tablas
// para verificar paridad bit-a-bit. Si OK → DROP TRIGGER + RENAME TABLE.
//
// Activación: env var `SHADOW_HANDLERS_ENABLED=true`. Por defecto OFF para
// que el deploy sea no-op hasta que se cree la tabla shadow.
//
// Idempotencia: UPSERT con `GREATEST(0, ...)`, mismo patrón que el trigger.
// Si el worker re-procesa un evento (retry), no se duplica el conteo porque
// el outbox marca processed_at solo en éxito.
//
// Ver docs/roadmap/sprint-outbox-test-questions.md §1.3

import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/database.module';
import type { OutboxEvent, TestQuestionPayload } from '../outbox-processor.schema';

@Injectable()
export class UserArticleStatsHandler {
  private readonly logger = new Logger(UserArticleStatsHandler.name);
  private readonly enabled = process.env.SHADOW_HANDLERS_ENABLED === 'true';

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Punto de entrada llamado por OutboxProcessorService.dispatch(). */
  async handle(event: OutboxEvent): Promise<void> {
    if (!this.enabled) return; // No-op si shadow mode no activado

    // Calcular deltas idénticos a la función SQL `update_user_article_stats`.
    const { q_delta, c_delta, payload } = this.computeDeltas(event);
    if (q_delta === 0 && c_delta === 0) return;
    if (!payload.article_number) return; // Skip si article_number NULL
    const userId = payload.user_id ?? null;
    if (!userId) return; // Worker no resuelve user_id desde tests (eso es trabajo del trigger viejo)

    // Guard: user_profiles debe existir (memoria delete-user)
    const userExists = await this.db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id = ${userId}::uuid) AS exists
    `);
    if (!(userExists as unknown as Array<{ exists: boolean }>)[0]?.exists) return;

    // Escribir en SHADOW TABLE (no en la tabla real)
    await this.db.execute(sql`
      INSERT INTO public.user_article_stats_shadow
        (user_id, article_id, article_number, law_name, tema_number, total_questions, correct_answers)
      VALUES
        (${userId}::uuid,
         ${payload.article_id ?? null}::uuid,
         ${payload.article_number ?? null},
         ${(payload as { law_name?: string }).law_name ?? null},
         ${(payload as { tema_number?: number }).tema_number ?? null},
         GREATEST(0, ${q_delta}),
         GREATEST(0, ${c_delta}))
      ON CONFLICT (user_id, article_id, article_number, law_name, tema_number) DO UPDATE SET
        total_questions = GREATEST(0, user_article_stats_shadow.total_questions + ${q_delta}),
        correct_answers = GREATEST(0, user_article_stats_shadow.correct_answers + ${c_delta}),
        updated_at = NOW()
    `);
  }

  /** Réplica exacta de la lógica de cálculo de deltas de la función SQL. */
  private computeDeltas(event: OutboxEvent): {
    q_delta: number;
    c_delta: number;
    payload: TestQuestionPayload;
  } {
    const payload = event.event_type === 'DELETE' && event.old_payload
      ? event.old_payload
      : event.payload;

    if (event.event_type === 'INSERT') {
      return {
        q_delta: 1,
        c_delta: payload.is_correct === true ? 1 : 0,
        payload,
      };
    }
    if (event.event_type === 'DELETE') {
      return {
        q_delta: -1,
        c_delta: payload.is_correct === true ? -1 : 0,
        payload,
      };
    }
    // UPDATE: solo si is_correct cambia
    const oldCorrect = event.old_payload?.is_correct ?? null;
    const newCorrect = event.payload.is_correct ?? null;
    if (oldCorrect === newCorrect) {
      return { q_delta: 0, c_delta: 0, payload };
    }
    let c_delta = 0;
    if (newCorrect === true && oldCorrect !== true) c_delta = 1;
    else if (oldCorrect === true && newCorrect !== true) c_delta = -1;
    return { q_delta: 0, c_delta, payload };
  }
}
