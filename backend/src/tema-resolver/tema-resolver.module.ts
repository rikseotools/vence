import { Module } from '@nestjs/common';
import { TemaResolverService } from './tema-resolver.service';

/**
 * Módulo TemaResolver: resuelve el `topic_number` para una pregunta dada
 * mediante su `primary_article_id` + `topic_scope` (los artículos cubiertos
 * por cada tema de una oposición).
 *
 * Port SOLO del fast path (`resolveTemaByQuestionIdFast`) — 1 query SQL
 * con CTE + JOIN. NO portamos el resto de funciones del módulo Vercel
 * (resolveTemasBatch, resolveTemaByArticle, etc. son para flujos
 * batch/admin que no afectan a answer-and-save).
 *
 * Ver docs/architecture/bloque3-answer-save-plan.md §2.5.
 */
@Module({
  providers: [TemaResolverService],
  exports: [TemaResolverService],
})
export class TemaResolverModule {}
