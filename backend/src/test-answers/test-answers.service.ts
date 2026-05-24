import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

export type SaveAnswerAction = 'saved_new' | 'already_saved' | 'save_failed' | 'error';

export interface SaveAnswerResponse {
  success: boolean;
  question_id?: string | null;
  action: SaveAnswerAction;
  error?: string;
}

/**
 * Servicio TestAnswers — Fase 1 (esqueleto).
 *
 * Implementación REAL en Fase 2 (lógica pura buildTestAnswerRow + helpers)
 * y Fase 3 (insertTestAnswer con INSERT idempotente).
 *
 * Funciones a implementar (port de lib/api/test-answers/queries.ts):
 *  - insertTestAnswer (entry point — INSERT row en test_questions)
 *  - buildTestAnswerRow (función pura — construye el row a insertar)
 *  - Helpers puros: mapAnswerToLetter, generateContentHash,
 *    buildQuestionContext, buildBehaviorData, buildLearningAnalytics
 */
@Injectable()
export class TestAnswersService {
  private readonly logger = new Logger(TestAnswersService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Helper puro estático — mapea selectedAnswer numérico a letra A-D.
   * - 0..3 → 'A'..'D' (respuesta normal)
   * - -1 con wasBlank=true → 'BLANK' (usuario dejó la pregunta en blanco)
   * - -1 sin wasBlank → letra incorrecta (legacy safety-net)
   */
  static mapAnswerToLetter(
    selected: number,
    correct: number,
    wasBlank = false,
  ): string {
    if (selected >= 0 && selected <= 3) {
      return String.fromCharCode(65 + selected);
    }
    if (wasBlank) return 'BLANK';
    return String.fromCharCode(65 + ((correct + 1) % 4));
  }
}
