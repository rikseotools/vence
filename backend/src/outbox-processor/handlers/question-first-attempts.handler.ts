// Handler: question_first_attempts (Fase 1.4 outbox sprint — handler #9).
// Replica track_question_first_attempt.
//
// INSERT ON CONFLICT DO NOTHING en question_first_attempts. Solo dispara
// para preguntas legislativas (psychometric_question_id NULL).
//
// SHADOW MODE: escribe en question_first_attempts_shadow.
//
// IMPORTANTE: el trigger SQL original tiene CASCADA — al insertar a
// question_first_attempts dispara apply_first_attempt_to_question_stats_trigger
// que recalcula global_difficulty. En SHADOW mode, ese trigger en cascada
// NO se ejecuta (porque escribimos en shadow). Tras cutover, hay que mover
// también el trigger en cascada a worker o aceptar que recompute via cron.

import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/database.module';
import type { OutboxEvent } from '../outbox-processor.schema';
import { tableWithSuffix } from './shadow-suffix';

@Injectable()
export class QuestionFirstAttemptsHandler {
  private readonly enabled = process.env.SHADOW_HANDLERS_ENABLED === 'true';
  private readonly tableName = tableWithSuffix('question_first_attempts');
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async handle(event: OutboxEvent): Promise<void> {
    if (!this.enabled) return;
    if (event.event_type !== 'INSERT') return;

    const p = event.payload;
    if (p.psychometric_question_id) return;
    if (!p.question_id) return;

    const userId = p.user_id;
    if (!userId) return;

    const tbl = sql.raw(this.tableName);
    await this.db.execute(sql`
      INSERT INTO public.${tbl} (
        user_id, question_id, is_correct, time_spent_seconds, confidence_level, created_at
      )
      VALUES (
        ${userId}::uuid,
        ${p.question_id}::uuid,
        ${p.is_correct ?? null},
        ${p.time_spent_seconds ?? null},
        ${(p as { confidence_level?: number | null }).confidence_level ?? null},
        NOW()
      )
      ON CONFLICT (user_id, question_id) DO NOTHING
    `);
  }
}
