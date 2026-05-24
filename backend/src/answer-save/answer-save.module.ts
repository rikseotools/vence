import { Module } from '@nestjs/common';
import { TemaResolverModule } from '../tema-resolver/tema-resolver.module';
import { TestAnswersModule } from '../test-answers/test-answers.module';
import { AnswerSaveController } from './answer-save.controller';
import { AnswerSaveService } from './answer-save.service';

/**
 * Módulo AnswerSave — endpoint POST /api/v2/answer-and-save.
 *
 * Orquesta:
 *  - AntifraudService (device check) — Global, no necesita import
 *  - DailyLimitService (premium + free limits) — Global, no necesita import
 *  - TestAnswersService (INSERT)
 *  - TemaResolverService (resolve topic_number cuando tema=0)
 *  - CacheService (validation cache 1h) — Global
 *  - JwtGuard (auth) — Global vía AuthModule
 *  - BackgroundService (fire-and-forget tras response) — Global
 *
 * Ver docs/architecture/bloque3-answer-save-plan.md §2.6.
 *
 * Fase 5 completada: Controller POST con JwtGuard + Zod + quick-fail.
 */
@Module({
  imports: [TestAnswersModule, TemaResolverModule],
  controllers: [AnswerSaveController],
  providers: [AnswerSaveService],
  exports: [AnswerSaveService],
})
export class AnswerSaveModule {}
