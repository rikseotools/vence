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
import { UserArticleStatsHandler } from './handlers/user-article-stats.handler';
import { OutboxProcessorCron } from './outbox-processor.cron';
import { OutboxProcessorService } from './outbox-processor.service';

@Module({
  providers: [
    // Handlers (Fase 1.3+)
    UserArticleStatsHandler,
    // Fase 1.4 — añadir:
    // UserDailyStatsHandler,
    // UserHourlyStatsHandler,
    // UserDifficultyStatsHandler,
    // UserStatsSummaryHandler,
    // UserStatsTotalTimeHandler,
    // UserQuestionHistoryV2Handler,
    // LawQuestionDifficultyHandler,
    // QuestionFirstAttemptsHandler,
    OutboxProcessorService,
    OutboxProcessorCron,
  ],
  exports: [OutboxProcessorService],
})
export class OutboxProcessorModule {}
