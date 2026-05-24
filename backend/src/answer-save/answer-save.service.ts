import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { CacheService } from '../cache/cache.service';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { articles, laws, psychometricQuestions, questions } from '../db/schema';

/**
 * Resultado de validación de una pregunta: respuesta correcta + metadata
 * adicional (explanation, article, law) que el cliente necesita mostrar
 * tras responder.
 */
export interface QuestionValidation {
  correctOption: number | null;
  explanation: string | null;
  articleNumber: string | null;
  lawShortName: string | null;
  lawName: string | null;
}

/**
 * Servicio AnswerSave — Fase 3 (validation cache implementada).
 *
 * Fase 4 añadirá validateAndSaveAnswer (orquestador completo) y
 * markActiveStudentIfFirst (background).
 */
@Injectable()
export class AnswerSaveService {
  private readonly logger = new Logger(AnswerSaveService.name);

  /** TTL del cache de validation (1h — pregunta cambia raramente). */
  private static readonly VALIDATION_CACHE_TTL_S = 60 * 60;

  /** Key prefix idéntico al de Vercel para coherencia cross-runtime. */
  private static readonly VALIDATION_CACHE_KEY_PREFIX = 'question-validation-v1';

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly cache: CacheService,
  ) {}

  /**
   * Lee la validación de una pregunta (correct_option + explanation +
   * artículo + ley). Cache-first.
   *
   * Estrategia:
   *  1. Cache hit (TTL 1h) → devuelve sin tocar BD.
   *  2. Miss → SELECT questions con JOIN articles+laws.
   *  3. Si no encontrado → fallback SELECT psychometric_questions.
   *  4. Cache fire-and-forget.
   *
   * Hit ratio altísimo (verificado empíricamente en Vercel: ~95%): una
   * pregunta popular se valida miles de veces (N users × M tests).
   *
   * Cache key idéntica al de Vercel — invalidación cross-runtime
   * coherente automática vía Upstash compartido.
   *
   * Si admin edita una pregunta (correct_option, explanation), debe
   * invalidar: `revalidateTag('questions')` desde Vercel (esto NO se
   * propaga al backend Nest hoy — `revalidateTag` es Next.js-only). Para
   * que el backend reciba la invalidación, el endpoint admin debe
   * adicionalmente llamar `cache.invalidate('question-validation-v1:{id}')`.
   *
   * Devuelve null si la pregunta no existe en ninguna tabla.
   */
  async getQuestionValidation(questionId: string): Promise<QuestionValidation | null> {
    const cacheKey = `${AnswerSaveService.VALIDATION_CACHE_KEY_PREFIX}:${questionId}`;
    const cached = await this.cache.getCached<QuestionValidation>(cacheKey);
    if (cached !== null) return cached;

    // Miss: leer de BD.
    const result = await this.fetchValidationFromDb(questionId);
    if (result) {
      // Fire-and-forget — no bloquea respuesta si Upstash tarda.
      this.cache.setCached(cacheKey, result, AnswerSaveService.VALIDATION_CACHE_TTL_S);
    }
    return result;
  }

  /**
   * Lectura BD directa: probar `questions` con JOIN, fallback
   * `psychometric_questions`. Sin cache — usar getQuestionValidation()
   * desde callers para beneficiarse del cache.
   */
  private async fetchValidationFromDb(
    questionId: string,
  ): Promise<QuestionValidation | null> {
    // 1) Tabla questions con JOIN articles + laws (preguntas legislativas).
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

    // 2) Fallback: psychometric_questions (sin metadata de artículo/ley).
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

  /**
   * Invalida el cache de validation de una pregunta concreta. Llamar
   * cuando el admin edita (correct_option, explanation). Para invalidar
   * TODAS las preguntas, hay que iterar las keys (cuidado con coste).
   */
  async invalidateValidationCache(questionId: string): Promise<void> {
    const cacheKey = `${AnswerSaveService.VALIDATION_CACHE_KEY_PREFIX}:${questionId}`;
    await this.cache.invalidate(cacheKey);
  }
}
