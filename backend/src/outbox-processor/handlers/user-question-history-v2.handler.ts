// Handler: user_question_history_v2 (Fase 1.4 outbox sprint — handler #7).
// Replica funciones SQL:
//   - update_user_question_history_v2_on_insert
//   - update_user_question_history_v2_on_update
//
// Skip si is_correct NULL o question_id NULL (psychometric o invalid).
// Pre-condición: questions.id debe existir (FK guard via subquery).

import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/database.module';
import type { OutboxEvent } from '../outbox-processor.schema';
import { tableWithSuffix } from './shadow-suffix';

@Injectable()
export class UserQuestionHistoryV2Handler {
  private readonly enabled = process.env.SHADOW_HANDLERS_ENABLED === 'true';
  private readonly tableName = tableWithSuffix('user_question_history_v2');
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async handle(event: OutboxEvent): Promise<void> {
    if (!this.enabled) return;
    if (event.event_type === 'INSERT') return this.handleInsert(event);
    if (event.event_type === 'UPDATE') return this.handleUpdate(event);
    // DELETE: el SQL original NO tiene trigger AFTER DELETE para v2, así que no-op
  }

  private async handleInsert(event: OutboxEvent): Promise<void> {
    const p = event.payload;
    if (p.is_correct === null || p.is_correct === undefined) return;
    if (!p.question_id) return;

    const userId = p.user_id;
    if (!userId) return;

    const userExists = await this.db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id = ${userId}::uuid) AS exists
    `);
    if (!(userExists as unknown as Array<{ exists: boolean }>)[0]?.exists) return;

    // FK guard: la pregunta debe existir
    const qExists = await this.db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS(SELECT 1 FROM public.questions WHERE id = ${p.question_id}::uuid) AS exists
    `);
    if (!(qExists as unknown as Array<{ exists: boolean }>)[0]?.exists) return;

    const correctDelta = p.is_correct === true ? 1 : 0;

    const tbl = sql.raw(this.tableName);
    await this.db.execute(sql`
      INSERT INTO public.${tbl} (
        user_id, question_id,
        total_attempts, correct_attempts,
        success_rate,
        first_attempt_at, last_attempt_at, trend
      )
      VALUES (
        ${userId}::uuid, ${p.question_id}::uuid,
        1, ${correctDelta},
        ROUND(${correctDelta}::numeric, 2)::DECIMAL(3,2),
        ${p.created_at ?? null}::timestamptz, ${p.created_at ?? null}::timestamptz, 'stable'
      )
      ON CONFLICT (user_id, question_id) DO UPDATE SET
        total_attempts = ${tbl}.total_attempts + 1,
        correct_attempts = ${tbl}.correct_attempts + ${correctDelta},
        success_rate = ROUND(
          (${tbl}.correct_attempts + ${correctDelta})::numeric
          / (${tbl}.total_attempts + 1),
          2
        )::DECIMAL(3,2),
        last_attempt_at = ${p.created_at ?? null}::timestamptz,
        updated_at = NOW()
    `);
  }

  private async handleUpdate(event: OutboxEvent): Promise<void> {
    const newP = event.payload;
    const oldP = event.old_payload ?? newP;

    if (newP.is_correct === oldP.is_correct) return;
    if (!newP.question_id) return;

    const userId = newP.user_id;
    if (!userId) return;

    let correctDelta = 0;
    if (newP.is_correct === true && oldP.is_correct !== true) correctDelta = 1;
    else if (oldP.is_correct === true && newP.is_correct !== true) correctDelta = -1;
    if (correctDelta === 0) return;

    // NO incrementa total_attempts. Solo ajusta correctos.
    const tbl = sql.raw(this.tableName);
    await this.db.execute(sql`
      UPDATE public.${tbl}
      SET correct_attempts = GREATEST(0, correct_attempts + ${correctDelta}),
          success_rate = ROUND(
            CASE WHEN total_attempts = 0 THEN 0
                 ELSE GREATEST(0, correct_attempts + ${correctDelta})::numeric / total_attempts END,
            2
          )::DECIMAL(3,2),
          last_attempt_at = ${newP.updated_at ?? newP.created_at ?? null}::timestamptz,
          updated_at = NOW()
      WHERE user_id = ${userId}::uuid AND question_id = ${newP.question_id}::uuid
    `);
  }
}
