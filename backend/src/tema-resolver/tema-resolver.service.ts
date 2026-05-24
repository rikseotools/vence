import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

/**
 * Servicio TemaResolver — Fase 1 (esqueleto).
 *
 * Implementación REAL en Fase 3:
 *  - resolveTemaByQuestionIdFast: 1 query CTE con JOIN questions → articles
 *    → topic_scope → topics, devuelve topic_number o null.
 *  - Cache in-memory por cacheKey(questionId, positionType).
 */
@Injectable()
export class TemaResolverService {
  private readonly logger = new Logger(TemaResolverService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Resuelve el tema de una pregunta legislativa rápidamente.
   * Fase 1: stub que devuelve null.
   * Fase 3: implementación SQL CTE real.
   */
  async resolveTemaByQuestionIdFast(
    _questionId: string,
    _positionType: string,
  ): Promise<number | null> {
    return null;
  }
}
