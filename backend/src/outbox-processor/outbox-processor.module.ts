// Módulo outbox-processor.
//
// Worker async que procesa eventos de la tabla `test_questions_outbox`
// generados por el trigger `tg_test_questions_emit_outbox` (migración
// `supabase/migrations/20260528_test_questions_outbox.sql`).
//
// Roadmap completo: docs/roadmap/sprint-outbox-test-questions.md
// Fase 1.2 (este módulo): infra worker (polling + retry + DLQ + métricas).
// Fases 1.3+: añadir handlers reales para cada tabla materializada.

import { Module } from '@nestjs/common';
import { LawQuestionFirstAttemptsHandler } from './handlers/law-question-first-attempts.handler';
import { QuestionFirstAttemptsHandler } from './handlers/question-first-attempts.handler';
import { UserArticleStatsHandler } from './handlers/user-article-stats.handler';
import { UserDailyStatsHandler } from './handlers/user-daily-stats.handler';
import { UserDifficultyStatsHandler } from './handlers/user-difficulty-stats.handler';
import { UserHourlyStatsHandler } from './handlers/user-hourly-stats.handler';
import { UserQuestionHistoryV2Handler } from './handlers/user-question-history-v2.handler';
import { UserStatsSummaryHandler } from './handlers/user-stats-summary.handler';
import { UserStatsTotalTimeHandler } from './handlers/user-stats-total-time.handler';
import { OutboxProcessorCron } from './outbox-processor.cron';
import { OutboxProcessorService } from './outbox-processor.service';

@Module({
  providers: [
    // Handlers (Fase 1.3 + 1.4) — todos gated por SHADOW_HANDLERS_ENABLED env var.
    // Replican los 20 triggers SQL analíticos de test_questions en shadow tables.
    UserArticleStatsHandler,
    UserDailyStatsHandler,
    UserHourlyStatsHandler,
    UserDifficultyStatsHandler,
    UserStatsSummaryHandler,
    UserStatsTotalTimeHandler,
    UserQuestionHistoryV2Handler,
    LawQuestionFirstAttemptsHandler,
    QuestionFirstAttemptsHandler,
    OutboxProcessorService,
    OutboxProcessorCron,
  ],
  exports: [OutboxProcessorService, OutboxProcessorCron],
})
export class OutboxProcessorModule {}
