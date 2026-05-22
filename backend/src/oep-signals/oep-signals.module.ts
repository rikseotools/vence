import { Module } from '@nestjs/common';
import { OepSignalsLlmService } from './oep-signals-llm.service';
import { OepSignalsQueriesService } from './oep-signals-queries.service';

/**
 * Módulo que exporta los dos servicios de la capa oep-signals:
 * - `OepSignalsQueriesService`: acceso a BD (queries/mutations)
 * - `OepSignalsLlmService`: extractores LLM (Haiku) para los tres sensores
 *
 * Los módulos cron importan `OepSignalsModule` para acceder a ambos servicios.
 * `AnthropicModule` es `@Global()`, así que `AnthropicService` ya está disponible
 * sin necesidad de importarlo explícitamente aquí.
 */
@Module({
  providers: [OepSignalsQueriesService, OepSignalsLlmService],
  exports: [OepSignalsQueriesService, OepSignalsLlmService],
})
export class OepSignalsModule {}
