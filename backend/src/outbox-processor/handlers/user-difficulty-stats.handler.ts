// Handler: user_difficulty_stats (Fase 1.4 outbox sprint — handler #4).
// Replica update_user_difficulty_stats. Agrega por DIFICULTAD (easy/medium/hard/extreme).
// Skip si difficulty NULL o no está en el enum.

import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/database.module';
import type { OutboxEvent, TestQuestionPayload } from '../outbox-processor.schema';
import { tableWithSuffix } from './shadow-suffix';

const VALID_DIFFICULTIES = ['easy', 'medium', 'hard', 'extreme'] as const;

@Injectable()
export class UserDifficultyStatsHandler {
  private readonly enabled = process.env.SHADOW_HANDLERS_ENABLED === 'true';
  private readonly tableName = tableWithSuffix('user_difficulty_stats');
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async handle(event: OutboxEvent): Promise<void> {
    if (!this.enabled) return;

    const { q_delta, c_delta, t_delta, payload } = this.computeDeltas(event);
    if (q_delta === 0 && c_delta === 0 && t_delta === 0) return;
    if (!payload.difficulty) return;
    if (!VALID_DIFFICULTIES.includes(payload.difficulty as typeof VALID_DIFFICULTIES[number])) return;

    const userId = payload.user_id;
    if (!userId) return;

    const userExists = await this.db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id = ${userId}::uuid) AS exists
    `);
    if (!(userExists as unknown as Array<{ exists: boolean }>)[0]?.exists) return;

    const tbl = sql.raw(this.tableName);
    await this.db.execute(sql`
      INSERT INTO public.${tbl}
        (user_id, difficulty, total_questions, correct_answers, total_time_seconds)
      VALUES (
        ${userId}::uuid,
        ${payload.difficulty},
        GREATEST(0, ${q_delta}),
        GREATEST(0, ${c_delta}),
        GREATEST(0, ${t_delta})
      )
      ON CONFLICT (user_id, difficulty) DO UPDATE SET
        total_questions = GREATEST(0, ${tbl}.total_questions + ${q_delta}),
        correct_answers = GREATEST(0, ${tbl}.correct_answers + ${c_delta}),
        total_time_seconds = GREATEST(0, ${tbl}.total_time_seconds + ${t_delta}),
        updated_at = NOW()
    `);
  }

  private computeDeltas(event: OutboxEvent): {
    q_delta: number;
    c_delta: number;
    t_delta: number;
    payload: TestQuestionPayload;
  } {
    const payload = event.event_type === 'DELETE' && event.old_payload ? event.old_payload : event.payload;
    if (event.event_type === 'INSERT') {
      return {
        q_delta: 1,
        c_delta: payload.is_correct === true ? 1 : 0,
        t_delta: payload.time_spent_seconds ?? 0,
        payload,
      };
    }
    if (event.event_type === 'DELETE') {
      return {
        q_delta: -1,
        c_delta: payload.is_correct === true ? -1 : 0,
        t_delta: -(payload.time_spent_seconds ?? 0),
        payload,
      };
    }
    const oldC = event.old_payload?.is_correct ?? null;
    const newC = event.payload.is_correct ?? null;
    if (oldC === newC) return { q_delta: 0, c_delta: 0, t_delta: 0, payload };
    let c_delta = 0;
    if (newC === true && oldC !== true) c_delta = 1;
    else if (oldC === true && newC !== true) c_delta = -1;
    return { q_delta: 0, c_delta, t_delta: 0, payload };
  }
}
