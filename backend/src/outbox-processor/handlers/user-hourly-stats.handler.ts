// Handler: user_hourly_stats (Fase 1.4 outbox sprint — handler #3).
// Replica update_user_hourly_stats. Agrega por HORA en zona Europe/Madrid.

import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/database.module';
import type { OutboxEvent, TestQuestionPayload } from '../outbox-processor.schema';
import { tableWithSuffix } from './shadow-suffix';

@Injectable()
export class UserHourlyStatsHandler {
  private readonly enabled = process.env.SHADOW_HANDLERS_ENABLED === 'true';
  private readonly tableName = tableWithSuffix('user_hourly_stats');
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async handle(event: OutboxEvent): Promise<void> {
    if (!this.enabled) return;

    const { q_delta, c_delta, payload } = this.computeDeltas(event);
    if (q_delta === 0 && c_delta === 0) return;

    const userId = payload.user_id;
    if (!userId) return;
    if (!payload.created_at) return;

    const userExists = await this.db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id = ${userId}::uuid) AS exists
    `);
    if (!(userExists as unknown as Array<{ exists: boolean }>)[0]?.exists) return;

    const tbl = sql.raw(this.tableName);
    await this.db.execute(sql`
      INSERT INTO public.${tbl} (user_id, hour, total_questions, correct_answers)
      VALUES (
        ${userId}::uuid,
        EXTRACT(HOUR FROM (${payload.created_at}::timestamptz AT TIME ZONE 'Europe/Madrid'))::smallint,
        GREATEST(0, ${q_delta}),
        GREATEST(0, ${c_delta})
      )
      ON CONFLICT (user_id, hour) DO UPDATE SET
        total_questions = GREATEST(0, ${tbl}.total_questions + ${q_delta}),
        correct_answers = GREATEST(0, ${tbl}.correct_answers + ${c_delta}),
        updated_at = NOW()
    `);
  }

  private computeDeltas(event: OutboxEvent): {
    q_delta: number;
    c_delta: number;
    payload: TestQuestionPayload;
  } {
    const payload = event.event_type === 'DELETE' && event.old_payload ? event.old_payload : event.payload;
    if (event.event_type === 'INSERT') {
      return { q_delta: 1, c_delta: payload.is_correct === true ? 1 : 0, payload };
    }
    if (event.event_type === 'DELETE') {
      return { q_delta: -1, c_delta: payload.is_correct === true ? -1 : 0, payload };
    }
    const oldC = event.old_payload?.is_correct ?? null;
    const newC = event.payload.is_correct ?? null;
    if (oldC === newC) return { q_delta: 0, c_delta: 0, payload };
    let c_delta = 0;
    if (newC === true && oldC !== true) c_delta = 1;
    else if (oldC === true && newC !== true) c_delta = -1;
    return { q_delta: 0, c_delta, payload };
  }
}
