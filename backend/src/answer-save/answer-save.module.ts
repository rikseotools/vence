import { Module } from '@nestjs/common';
import { AnswerSaveService } from './answer-save.service';

/**
 * Módulo AnswerSave — endpoint POST /api/v2/answer-and-save.
 *
 * Orquesta:
 *  - AntifraudService (device check)
 *  - DailyLimitService (premium + free limits)
 *  - TestAnswersService (INSERT)
 *  - TemaResolverService (resolve topic_number cuando tema=0)
 *  - CacheService (validation cache 1h)
 *  - JwtGuard (auth)
 *
 * Ver docs/architecture/bloque3-answer-save-plan.md §2.6.
 *
 * Fase 1: esqueleto. Fase 4: implementación + Controller. Fase 6: deploy + canary.
 */
@Module({
  providers: [AnswerSaveService],
  exports: [AnswerSaveService],
})
export class AnswerSaveModule {}
