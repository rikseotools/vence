import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { CacheService } from '../cache/cache.service';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import {
  articles,
  laws,
  psychometricQuestions,
  questions,
  tests,
  userProfiles,
} from '../db/schema';
import { TemaResolverService } from '../tema-resolver/tema-resolver.service';
import { TestAnswersService } from '../test-answers/test-answers.service';
import type {
  QuestionMetadata,
  SaveAnswerRequest,
} from '../test-answers/test-answers.types';
import {
  normalizePositionType,
  type AnswerSaveRequest,
  type AnswerSaveResponse,
} from './answer-save.types';

export interface QuestionValidation {
  correctOption: number | null;
  explanation: string | null;
  articleNumber: string | null;
  lawShortName: string | null;
  lawName: string | null;
}

/**
 * Servicio AnswerSave — Fase 4 (orquestador completo).
 *
 * Port literal de `validateAndSaveAnswer` de
 * lib/api/v2/answer-and-save/queries.ts. Orquesta:
 *  - getQuestionValidation (cache Upstash + JOIN articles+laws)
 *  - TemaResolverService.resolveTemaByQuestionIdFast (en paralelo)
 *  - TestAnswersService.insertTestAnswer (INSERT + 23505)
 *  - UPDATE tests.score (no crítico)
 *
 * También expone `markActiveStudentIfFirst` para llamar desde background
 * tras devolver response al cliente (via BackgroundService).
 */
@Injectable()
export class AnswerSaveService {
  private readonly logger = new Logger(AnswerSaveService.name);

  private static readonly VALIDATION_CACHE_TTL_S = 60 * 60;
  private static readonly VALIDATION_CACHE_KEY_PREFIX = 'question-validation-v1';

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly cache: CacheService,
    private readonly temaResolver: TemaResolverService,
    private readonly testAnswers: TestAnswersService,
  ) {}

  // ─── Validation cache (Fase 3) ─────────────────────────────

  async getQuestionValidation(questionId: string): Promise<QuestionValidation | null> {
    const cacheKey = `${AnswerSaveService.VALIDATION_CACHE_KEY_PREFIX}:${questionId}`;
    const cached = await this.cache.getCached<QuestionValidation>(cacheKey);
    if (cached !== null) return cached;

    const result = await this.fetchValidationFromDb(questionId);
    if (result) {
      this.cache.setCached(cacheKey, result, AnswerSaveService.VALIDATION_CACHE_TTL_S);
    }
    return result;
  }

  private async fetchValidationFromDb(
    questionId: string,
  ): Promise<QuestionValidation | null> {
    const legislativeRows = await this.db
      .select({
        correctOption: questions.correctOption,
        explanation: questions.explanation,
        articleNumber: articles.articleNumber,
        lawShortName: laws.shortName,
        lawName: laws.name,
      })
      .from(questions)
      .leftJoin(articles, eq(questions.primaryArticleId, articles.id))
      .leftJoin(laws, eq(articles.lawId, laws.id))
      .where(eq(questions.id, questionId))
      .limit(1);

    if (legislativeRows[0]) return legislativeRows[0];

    const psyRows = await this.db
      .select({
        correctOption: psychometricQuestions.correctOption,
        explanation: psychometricQuestions.explanation,
      })
      .from(psychometricQuestions)
      .where(eq(psychometricQuestions.id, questionId))
      .limit(1);

    if (psyRows[0]) {
      return {
        correctOption: psyRows[0].correctOption,
        explanation: psyRows[0].explanation,
        articleNumber: null,
        lawShortName: null,
        lawName: null,
      };
    }

    return null;
  }

  async invalidateValidationCache(questionId: string): Promise<void> {
    const cacheKey = `${AnswerSaveService.VALIDATION_CACHE_KEY_PREFIX}:${questionId}`;
    await this.cache.invalidate(cacheKey);
  }

  // ─── Orquestador POST principal (Fase 4) ───────────────────

  /**
   * Valida una respuesta + guarda en test_questions + actualiza score
   * del test. Port literal de validateAndSaveAnswer de Vercel.
   *
   * Flow:
   *   1. PARALELO: validation cache (correct_option + metadata) +
   *      resolver de tema (solo si tema=0 y es legislativa).
   *   2. Si correctOption=null → return {success:false, saveAction:'save_failed'}
   *      (el Controller mapea a 404).
   *   3. Calcular isCorrect (con guard wasBlank) + newScore.
   *   4. INSERT en test_questions vía TestAnswersService.
   *   5. Si OK → UPDATE tests.score (no crítico — log warn si falla).
   *   6. Return AnswerSaveResponse con todos los campos.
   */
  async validateAndSaveAnswer(
    req: AnswerSaveRequest,
    userId: string,
  ): Promise<AnswerSaveResponse> {
    const positionType = normalizePositionType(req.oposicionId);
    const shouldResolveTema = this.shouldResolveTema(req);

    // 1. PARALELO: validation + resolveTema
    const [validation, preResolvedTema] = await Promise.all([
      this.getQuestionValidation(req.questionId),
      shouldResolveTema
        ? this.temaResolver.resolveTemaByQuestionIdFast(
            req.questionId,
            positionType,
          )
        : Promise.resolve<number | null>(null),
    ]);

    const currentScore = req.currentScore ?? 0;

    // 2. Sin correctOption → 404
    if (!validation || validation.correctOption === null) {
      return {
        success: false,
        isCorrect: false,
        correctAnswer: 0,
        explanation: null,
        newScore: currentScore,
        saveAction: 'save_failed',
      };
    }

    const correctOption = validation.correctOption;
    const isBlank = req.isBlank === true;
    const isCorrect = !isBlank && req.userAnswer === correctOption;
    const newScore = isCorrect ? currentScore + 1 : currentScore;

    // Si el resolver encontró tema, lo usamos. Si no, queda req.tema (puede ser 0).
    const effectiveTema =
      preResolvedTema !== null && preResolvedTema > 0
        ? preResolvedTema
        : (req.tema ?? 0);

    // 3. INSERT en test_questions vía TestAnswersService
    const saveRequest = this.toSaveAnswerRequest(req, correctOption, isCorrect);
    const saveResult = await this.testAnswers.insertTestAnswer(
      saveRequest,
      userId,
      { resolvedTema: effectiveTema },
    );

    // 4. Si OK → UPDATE tests.score (no crítico)
    if (saveResult.success) {
      try {
        await this.db
          .update(tests)
          .set({ score: String(newScore) })
          .where(eq(tests.id, req.sessionId));
      } catch (err) {
        this.logger.warn(
          `Error actualizando score del test ${req.sessionId} — la respuesta SÍ se guardó:`,
          err,
        );
      }
    }

    const saveAction = saveResult.success
      ? (saveResult.action as 'saved_new' | 'already_saved')
      : 'save_failed';

    if (!saveResult.success) {
      this.logger.error(
        `save_failed questionId=${req.questionId} sessionId=${req.sessionId}: ${saveResult.error}`,
      );
    }

    return {
      success: saveResult.success,
      isCorrect,
      correctAnswer: correctOption,
      explanation: validation.explanation,
      articleNumber: validation.articleNumber,
      lawShortName: validation.lawShortName,
      lawName: validation.lawName,
      newScore,
      saveAction,
      questionDbId: saveResult.question_id ?? null,
    };
  }

  /**
   * Marca user_profiles.is_active_student=true (con first_test_completed_at
   * = NOW()) si todavía era false. Idempotente. Llamar desde background
   * (no bloquea la response).
   *
   * Try/catch: no crítico. Si falla, el siguiente answer-and-save vuelve
   * a intentarlo.
   */
  async markActiveStudentIfFirst(userId: string): Promise<void> {
    try {
      const rows = await this.db
        .select({ isActiveStudent: userProfiles.isActiveStudent })
        .from(userProfiles)
        .where(eq(userProfiles.id, userId))
        .limit(1);

      if (rows[0] && !rows[0].isActiveStudent) {
        await this.db
          .update(userProfiles)
          .set({
            isActiveStudent: true,
            firstTestCompletedAt: new Date().toISOString(),
          })
          .where(eq(userProfiles.id, userId));
        this.logger.log(`Usuario marcado como ACTIVO: ${userId.slice(0, 8)}`);
      }
    } catch (err) {
      this.logger.warn('Error marcando is_active_student:', err);
    }
  }

  // ─── Helpers privados ──────────────────────────────────────

  /**
   * Decide si lanzar el fast-path del resolver de tema. Mismo criterio
   * que el frontend (Vercel):
   *   - cliente mandó tema=0 (test personalizado, etc.)
   *   - pregunta NO psicotécnica
   *   - questionId parece UUID (no ID sintético tipo "tema-1-art-X-...")
   */
  private shouldResolveTema(req: AnswerSaveRequest): boolean {
    if ((req.tema ?? 0) !== 0) return false;
    if (req.questionType === 'psychometric') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      req.questionId,
    );
  }

  /**
   * Convierte AnswerSaveRequest (shape del endpoint) a SaveAnswerRequest
   * (shape que entiende TestAnswersService). Centraliza la conversión.
   */
  private toSaveAnswerRequest(
    req: AnswerSaveRequest,
    correctOption: number,
    isCorrect: boolean,
  ): SaveAnswerRequest {
    const isBlank = req.isBlank === true;
    return {
      sessionId: req.sessionId,
      questionData: {
        id: req.questionId,
        question: req.questionText,
        options: req.options,
        tema: req.tema,
        questionType: req.questionType ?? 'legislative',
        article: req.article,
        // El Controller ya valida que difficulty está en VALID_DIFFICULTIES
        // con Zod (Fase 5), por lo que el cast aquí es seguro. El tipo
        // amplio (string) en AnswerSaveMetadata es por ergonomía del
        // contrato externo del endpoint.
        metadata: req.metadata as QuestionMetadata | null | undefined,
        explanation: req.explanation,
      },
      answerData: {
        questionIndex: req.questionIndex,
        // Blancas: -1 para que insertTestAnswer lo interprete como "sin
        // selección" y lo traduzca al marcador BLANK en BD.
        selectedAnswer: isBlank ? -1 : (req.userAnswer as number),
        correctAnswer: correctOption,
        isCorrect,
        timeSpent: req.timeSpent ?? 0,
        wasBlank: isBlank,
      },
      tema: req.tema,
      confidenceLevel: req.confidenceLevel ?? 'unknown',
      interactionCount: req.interactionCount ?? 1,
      questionStartTime: req.questionStartTime ?? 0,
      firstInteractionTime: req.firstInteractionTime ?? 0,
      interactionEvents: req.interactionEvents,
      mouseEvents: req.mouseEvents,
      scrollEvents: req.scrollEvents,
      deviceInfo: req.deviceInfo,
      oposicionId: req.oposicionId,
    };
  }
}
