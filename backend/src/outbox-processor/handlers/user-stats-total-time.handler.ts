// Handler: user_stats_total_time (Fase 1.4 outbox sprint — handler #5).
// Replica update_user_stats_total_time. SOLO incrementa total_time_seconds
// en user_stats_summary (no inserta, solo UPDATE — la row tiene que existir
// vía otro trigger, normalmente user-stats-summary.handler).
//
// IMPORTANTE: SHADOW MODE escribe en user_stats_summary_shadow (no en la
// tabla real). Cuando se cutover, este handler depende de que el handler
// user-stats-summary haya creado la row para el user.

import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/database.module';
import type { OutboxEvent } from '../outbox-processor.schema';
import { tableWithSuffix } from './shadow-suffix';

@Injectable()
export class UserStatsTotalTimeHandler {
  private readonly enabled = process.env.SHADOW_HANDLERS_ENABLED === 'true';
  // Escribe a user_stats_summary (no _total_time — esa tabla no existe).
  private readonly tableName = tableWithSuffix('user_stats_summary');
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async handle(event: OutboxEvent): Promise<void> {
    if (!this.enabled) return;

    const delta = this.computeDelta(event);
    if (delta === 0) return;

    const userId = event.event_type === 'DELETE'
      ? event.old_payload?.user_id
      : event.payload.user_id;
    if (!userId) return;

    const userExists = await this.db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id = ${userId}::uuid) AS exists
    `);
    if (!(userExists as unknown as Array<{ exists: boolean }>)[0]?.exists) return;

    // UPDATE only (no upsert — la row la crea user-stats-summary.handler).
    // Si no existe, no hace nada (consistente con SQL original).
    const tbl = sql.raw(this.tableName);
    await this.db.execute(sql`
      UPDATE public.${tbl}
      SET total_time_seconds = GREATEST(0, total_time_seconds + ${delta}),
          updated_at = NOW()
      WHERE user_id = ${userId}::uuid
    `);
  }

  private computeDelta(event: OutboxEvent): number {
    if (event.event_type === 'INSERT') {
      return event.payload.time_spent_seconds ?? 0;
    }
    if (event.event_type === 'DELETE') {
      return -(event.old_payload?.time_spent_seconds ?? 0);
    }
    // UPDATE
    const oldT = event.old_payload?.time_spent_seconds ?? 0;
    const newT = event.payload.time_spent_seconds ?? 0;
    return newT - oldT;
  }
}
