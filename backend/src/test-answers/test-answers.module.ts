import { Module } from '@nestjs/common';
import { TestAnswersService } from './test-answers.service';

/**
 * Módulo TestAnswers: inserción de respuestas en `test_questions`.
 *
 * Port de `lib/api/test-answers/queries.ts` del frontend. El INSERT es
 * idempotente vía catch del Postgres error code 23505 (constraint único
 * `test_id` + `question_order`).
 *
 * La tabla `test_questions` tiene 8 triggers en BD que se disparan tras
 * INSERT (analytics, materializadas, etc.) — el código del backend NO
 * los toca, son de SQL puro.
 *
 * Ver docs/architecture/bloque3-answer-save-plan.md §2.4.
 */
@Module({
  providers: [TestAnswersService],
  exports: [TestAnswersService],
})
export class TestAnswersModule {}
