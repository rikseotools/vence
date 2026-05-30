// Handler: user_stats_summary (Fase 1.4 outbox sprint — handler #6).
// Replica las 3 funciones SQL:
//   - update_user_stats_summary (INSERT)
//   - update_user_stats_summary_on_update (UPDATE of is_correct, was_blank)
//   - update_user_stats_summary_on_delete (DELETE)
//
// Particularidad: agrupa por user_id (sin partición por día/semana, una row
// por user). Trackea questions_this_week con reset al cambiar de semana.

import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/database.module';
import type { OutboxEvent, TestQuestionPayload } from '../outbox-processor.schema';
import { tableWithSuffix } from './shadow-suffix';

interface UserStatsSummaryPayload extends TestQuestionPayload {
  was_blank?: boolean | null;
}

@Injectable()
export class UserStatsSummaryHandler {
  private readonly enabled = process.env.SHADOW_HANDLERS_ENABLED === 'true';
  private readonly tableName = tableWithSuffix('user_stats_summary');
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async handle(event: OutboxEvent): Promise<void> {
    if (!this.enabled) return;

    if (event.event_type === 'INSERT') return this.handleInsert(event);
    if (event.event_type === 'UPDATE') return this.handleUpdate(event);
    if (event.event_type === 'DELETE') return this.handleDelete(event);
  }

  private async handleInsert(event: OutboxEvent): Promise<void> {
    const payload = event.payload as UserStatsSummaryPayload;
    const userId = payload.user_id;
    if (!userId) return;

    const isCorrect = payload.is_correct === true;
    const wasBlank = payload.was_blank === true;

    const userExists = await this.db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id = ${userId}::uuid) AS exists
    `);
    if (!(userExists as unknown as Array<{ exists: boolean }>)[0]?.exists) return;

    // week_start = date_trunc('week', now())::date  (mismo SQL)
    const tbl = sql.raw(this.tableName);
    await this.db.execute(sql`
      WITH wk AS (SELECT date_trunc('week', now())::date AS d)
      INSERT INTO public.${tbl}
        (user_id, total_questions, correct_answers, blank_answers, questions_this_week, week_start)
      SELECT ${userId}::uuid, 1, ${isCorrect ? 1 : 0}, ${wasBlank ? 1 : 0}, 1, wk.d FROM wk
      ON CONFLICT (user_id) DO UPDATE SET
        total_questions = ${tbl}.total_questions + 1,
        correct_answers = ${tbl}.correct_answers + ${isCorrect ? 1 : 0},
        blank_answers = ${tbl}.blank_answers + ${wasBlank ? 1 : 0},
        questions_this_week = CASE
          WHEN ${tbl}.week_start = (SELECT d FROM wk)
          THEN ${tbl}.questions_this_week + 1
          ELSE 1
        END,
        week_start = (SELECT d FROM wk),
        updated_at = NOW()
    `);
  }

  private async handleUpdate(event: OutboxEvent): Promise<void> {
    const newP = event.payload as UserStatsSummaryPayload;
    const oldP = (event.old_payload ?? {}) as UserStatsSummaryPayload;

    if (newP.is_correct === oldP.is_correct && newP.was_blank === oldP.was_blank) return;

    const userId = newP.user_id;
    if (!userId) return;

    let correctDelta = 0;
    if (newP.is_correct === true && oldP.is_correct !== true) correctDelta = 1;
    else if (oldP.is_correct === true && newP.is_correct !== true) correctDelta = -1;

    let blankDelta = 0;
    if (newP.was_blank === true && oldP.was_blank !== true) blankDelta = 1;
    else if (oldP.was_blank === true && newP.was_blank !== true) blankDelta = -1;

    if (correctDelta === 0 && blankDelta === 0) return;

    const tbl = sql.raw(this.tableName);
    await this.db.execute(sql`
      UPDATE public.${tbl}
      SET correct_answers = GREATEST(0, correct_answers + ${correctDelta}),
          blank_answers = GREATEST(0, blank_answers + ${blankDelta}),
          updated_at = NOW()
      WHERE user_id = ${userId}::uuid
    `);
  }

  private async handleDelete(event: OutboxEvent): Promise<void> {
    const oldP = (event.old_payload ?? event.payload) as UserStatsSummaryPayload;
    const userId = oldP.user_id;
    if (!userId) return;

    const isCorrect = oldP.is_correct === true ? 1 : 0;
    const wasBlank = oldP.was_blank === true ? 1 : 0;
    const createdAt = oldP.created_at;

    const tbl = sql.raw(this.tableName);
    await this.db.execute(sql`
      WITH wk AS (SELECT date_trunc('week', now())::date AS current_week)
      UPDATE public.${tbl} s
      SET total_questions = GREATEST(0, s.total_questions - 1),
          correct_answers = GREATEST(0, s.correct_answers - ${isCorrect}),
          blank_answers = GREATEST(0, s.blank_answers - ${wasBlank}),
          questions_this_week = CASE
            WHEN ${createdAt ?? null}::timestamptz IS NOT NULL
                 AND date_trunc('week', ${createdAt ?? null}::timestamptz)::date = (SELECT current_week FROM wk)
            THEN GREATEST(0, s.questions_this_week - 1)
            ELSE s.questions_this_week
          END,
          updated_at = NOW()
      WHERE s.user_id = ${userId}::uuid
    `);
  }
}
