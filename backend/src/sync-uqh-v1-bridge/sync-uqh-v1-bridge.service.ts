import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

// ⚠️  PUENTE TEMPORAL — se elimina en Fase 4 del plan UQH (DROP TABLE v1 + RENAME v2).
//
// Contexto: el cutover outbox (commit df76c84c, 2026-05-30 08:28 UTC) desactivó
// los triggers `trigger_update_user_question_history_*` en `test_questions`. El
// handler Fargate `UserQuestionHistoryV2Handler` escribe SOLO a `user_question_history_v2`.
// `user_question_history` (v1) quedó congelada — y 4 lectores de producción
// (random-test, chat IA stats, chat IA peores artículos, QuestionEvolution)
// siguen leyendo v1. Mientras se migran a v2 (Fase 3), este cron mantiene v1 al día.
//
// Eliminar este módulo + entrada en app.module.ts cuando los 4 lectores
// estén migrados y se haga el DROP de v1.
const CUTOVER_TS = '2026-05-30T08:25:43Z';

export interface SyncStats {
  rowsAffected: number;
  durationMs: number;
  startedFromTs: string | null;
}

@Injectable()
export class SyncUqhV1BridgeService {
  private readonly logger = new Logger(SyncUqhV1BridgeService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Sincroniza v1 ← v2 desde MAX(v1.last_attempt_at) hasta NOW().
   *
   * Self-healing: si v1 tiene gap (downtime previo), arrancamos desde el
   * último last_attempt_at conocido en v1. Si v1 está al día, solo procesa
   * filas nuevas. Idempotente vía ON CONFLICT (user_id, question_id).
   *
   * Filtra filas huérfanas (user_id sin auth.users o question_id sin questions):
   * el handler Fargate de v2 no respeta cascades como hacían los triggers SQL,
   * así que v2 puede acumular órfanos que romperían la FK de v1.
   */
  async run(): Promise<SyncStats> {
    const startTime = Date.now();

    const startedRows = await this.db.execute(sql`
      SELECT COALESCE(
        (SELECT MAX(last_attempt_at) FROM public.user_question_history),
        ${CUTOVER_TS}::timestamptz
      ) AS started_from
    `);
    const startedFromTs =
      (startedRows as unknown as Array<{ started_from: Date | string | null }>)[0]
        ?.started_from?.toString() ?? null;

    const result = await this.db.execute(sql`
      INSERT INTO public.user_question_history (
        user_id, question_id,
        total_attempts, correct_attempts,
        success_rate,
        personal_difficulty,
        first_attempt_at, last_attempt_at,
        trend, trend_calculated_at,
        created_at, updated_at
      )
      SELECT
        v2.user_id, v2.question_id,
        v2.total_attempts, v2.correct_attempts,
        v2.success_rate,
        v2.personal_difficulty::difficulty_level,
        v2.first_attempt_at, v2.last_attempt_at,
        v2.trend, v2.trend_calculated_at,
        v2.created_at, v2.updated_at
      FROM public.user_question_history_v2 v2
      WHERE v2.last_attempt_at > COALESCE(
              (SELECT MAX(last_attempt_at) FROM public.user_question_history),
              ${CUTOVER_TS}::timestamptz
            )
        AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v2.user_id)
        AND EXISTS (SELECT 1 FROM public.questions q WHERE q.id = v2.question_id)
      ON CONFLICT (user_id, question_id) DO UPDATE SET
        total_attempts      = EXCLUDED.total_attempts,
        correct_attempts    = EXCLUDED.correct_attempts,
        success_rate        = EXCLUDED.success_rate,
        last_attempt_at     = EXCLUDED.last_attempt_at,
        trend               = EXCLUDED.trend,
        trend_calculated_at = EXCLUDED.trend_calculated_at,
        updated_at          = EXCLUDED.updated_at
    `);

    const rowsAffected =
      (result as unknown as { rowCount?: number; count?: number }).rowCount ??
      (result as unknown as { count?: number }).count ??
      0;
    const durationMs = Date.now() - startTime;

    this.logger.log(
      `sync-uqh-v1-bridge: ${rowsAffected} filas, ${durationMs}ms (desde ${startedFromTs})`,
    );

    return { rowsAffected, durationMs, startedFromTs };
  }
}
