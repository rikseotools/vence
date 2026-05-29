// Handler: law_question_first_attempts (Fase 1.4 outbox sprint — handler #8).
// Replica trigger_update_law_question_difficulty.
//
// Comportamiento: INSERT ON CONFLICT DO NOTHING en law_question_first_attempts.
// Solo se ejecuta para preguntas legislativas (psychometric_question_id NULL).
//
// SHADOW MODE: escribe en law_question_first_attempts_shadow.

import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/database.module';
import type { OutboxEvent } from '../outbox-processor.schema';

@Injectable()
export class LawQuestionFirstAttemptsHandler {
  private readonly enabled = process.env.SHADOW_HANDLERS_ENABLED === 'true';
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async handle(event: OutboxEvent): Promise<void> {
    if (!this.enabled) return;
    // Solo INSERT (los UPDATE/DELETE del SQL original NO disparan)
    if (event.event_type !== 'INSERT') return;

    const p = event.payload;
    // Skip si psychometric o question_id null
    if (p.psychometric_question_id) return;
    if (!p.question_id) return;

    const userId = p.user_id;
    if (!userId) return;

    await this.db.execute(sql`
      INSERT INTO public.law_question_first_attempts_shadow (
        user_id, question_id, is_correct, time_taken_seconds, confidence_level, interaction_data
      )
      VALUES (
        ${userId}::uuid,
        ${p.question_id}::uuid,
        ${p.is_correct ?? null},
        ${p.time_spent_seconds ?? null},
        ${(p as { confidence_level?: number | null }).confidence_level ?? null},
        ${(p as { user_behavior_data?: unknown }).user_behavior_data
            ? sql`${JSON.stringify((p as { user_behavior_data?: unknown }).user_behavior_data)}::jsonb`
            : null}
      )
      ON CONFLICT (user_id, question_id) DO NOTHING
    `);
  }
}
