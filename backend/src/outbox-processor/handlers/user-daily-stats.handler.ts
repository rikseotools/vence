// Handler: user_daily_stats (Fase 1.4 outbox sprint — handler #2).
//
// Replica función SQL update_user_daily_stats (trigger AFTER INSERT/UPDATE
// OF is_correct,time_spent_seconds/DELETE en test_questions).
//
// SHADOW MODE: escribe en user_daily_stats_shadow. Mismo patrón que
// user-article-stats.handler.ts. Activación gated por SHADOW_HANDLERS_ENABLED.
//
// Particularidad: agrega por DÍA en zona horaria Europe/Madrid (no UTC).

import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/database.module';
import type { OutboxEvent, TestQuestionPayload } from '../outbox-processor.schema';

@Injectable()
export class UserDailyStatsHandler {
  private readonly logger = new Logger(UserDailyStatsHandler.name);
  private readonly enabled = process.env.SHADOW_HANDLERS_ENABLED === 'true';

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async handle(event: OutboxEvent): Promise<void> {
    if (!this.enabled) return;

    const { q_delta, c_delta, t_delta, payload } = this.computeDeltas(event);
    if (q_delta === 0 && c_delta === 0 && t_delta === 0) return;

    const userId = payload.user_id;
    if (!userId) return;
    if (!payload.created_at) return; // necesitamos timestamp para calcular el día

    // Guard: user_profiles debe existir
    const userExists = await this.db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id = ${userId}::uuid) AS exists
    `);
    if (!(userExists as unknown as Array<{ exists: boolean }>)[0]?.exists) return;

    // Agregación por día en zona horaria Europe/Madrid (igual que SQL original).
    await this.db.execute(sql`
      INSERT INTO public.user_daily_stats_shadow
        (user_id, day, total_questions, correct_answers, total_time_seconds)
      VALUES
        (${userId}::uuid,
         (${payload.created_at}::timestamptz AT TIME ZONE 'Europe/Madrid')::date,
         GREATEST(0, ${q_delta}),
         GREATEST(0, ${c_delta}),
         GREATEST(0, ${t_delta}))
      ON CONFLICT (user_id, day) DO UPDATE SET
        total_questions = GREATEST(0, user_daily_stats_shadow.total_questions + ${q_delta}),
        correct_answers = GREATEST(0, user_daily_stats_shadow.correct_answers + ${c_delta}),
        total_time_seconds = GREATEST(0, user_daily_stats_shadow.total_time_seconds + ${t_delta}),
        updated_at = NOW()
    `);
  }

  private computeDeltas(event: OutboxEvent): {
    q_delta: number;
    c_delta: number;
    t_delta: number;
    payload: TestQuestionPayload;
  } {
    const payload = event.event_type === 'DELETE' && event.old_payload
      ? event.old_payload
      : event.payload;

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
    // UPDATE: solo si cambia is_correct o time_spent_seconds
    const oldCorrect = event.old_payload?.is_correct ?? null;
    const newCorrect = event.payload.is_correct ?? null;
    const oldTime = event.old_payload?.time_spent_seconds ?? 0;
    const newTime = event.payload.time_spent_seconds ?? 0;
    if (oldCorrect === newCorrect && oldTime === newTime) {
      return { q_delta: 0, c_delta: 0, t_delta: 0, payload };
    }
    let c_delta = 0;
    if (newCorrect === true && oldCorrect !== true) c_delta = 1;
    else if (oldCorrect === true && newCorrect !== true) c_delta = -1;
    return { q_delta: 0, c_delta, t_delta: newTime - oldTime, payload };
  }
}
