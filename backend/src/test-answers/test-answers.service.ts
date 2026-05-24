import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import {
  normalizeDifficulty,
  type DeviceInfo,
  type SaveAnswerRequest,
  type SaveAnswerResponse,
} from './test-answers.types';

/**
 * Resultado de buildTestAnswerRow — el row listo para INSERT en
 * test_questions + el questionId computado (puede ser sintético si no
 * venía en el request).
 */
export interface BuiltTestAnswerRow {
  questionId: string;
  row: Record<string, unknown>;
}

/**
 * Servicio TestAnswers — Fase 2 (lógica pura completa).
 *
 * Port literal de `lib/api/test-answers/queries.ts` del frontend Vercel,
 * sin las llamadas a BD. La inserción (insertTestAnswer) se implementa
 * en Fase 3 invocando los helpers de esta clase.
 *
 * Los helpers son **puros estáticos** — testeables sin instanciar el
 * service ni tocar BD. Solo `computeTema` toca BD (delegado al
 * TemaResolverService en Fase 3+).
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

  /**
   * Helper puro estático — hash determinista del contenido de la pregunta
   * para generar IDs sintéticos cuando el caller no envía un id real.
   * Mismo algoritmo que el frontend (port literal).
   */
  static generateContentHash(questionText: string, options: string[]): string {
    const fullText = questionText + (options || []).join('');
    let hash = 0;
    for (let i = 0; i < fullText.length; i++) {
      hash = ((hash << 5) - hash + fullText.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Helper puro estático — construye el campo JSONB full_question_context.
   * Encapsula la pregunta+opciones+explanation+article para auditoría
   * futura (ej. cuando el contenido de la pregunta cambia y queremos
   * saber qué vio el usuario cuando respondió).
   */
  static buildQuestionContext(
    req: SaveAnswerRequest,
    questionId: string,
    articleId: string | null,
  ): Record<string, unknown> {
    return {
      options: req.questionData.options || [],
      explanation: req.questionData.explanation || '',
      article_full: req.questionData.article || {},
      difficulty_meta: req.questionData.metadata || {},
      generated_ids: {
        question_id: questionId,
        article_id: articleId,
        generation_method: req.questionData.metadata?.id ? 'metadata' : 'generated',
      },
    };
  }

  /**
   * Helper puro estático — construye el campo JSONB user_behavior_data.
   * Métricas de comportamiento del usuario (eventos UI, cambios de respuesta).
   */
  static buildBehaviorData(req: SaveAnswerRequest): Record<string, unknown> {
    return {
      interaction_events: (req.interactionEvents || []).slice(-10),
      mouse_activity: (req.mouseEvents || []).length,
      scroll_activity: (req.scrollEvents || []).length,
      confidence_evolution: req.confidenceLevel || 'unknown',
      answer_changes: Math.max(0, (req.interactionCount || 1) - 1),
    };
  }

  /**
   * Helper puro estático — construye el campo JSONB learning_analytics.
   * Métricas derivadas (patrón de respuesta, eficiencia de tiempo, match
   * confidence/accuracy, hesitation, interaction pattern).
   */
  static buildLearningAnalytics(req: SaveAnswerRequest): Record<string, unknown> {
    const timeSpent = req.answerData.timeSpent || 0;
    const hesitationTime = req.firstInteractionTime
      ? Math.max(0, req.firstInteractionTime - (req.questionStartTime || 0))
      : 0;
    const confidence = req.confidenceLevel || 'unknown';
    const interactionCount = req.interactionCount || 1;

    return {
      response_pattern: req.answerData.isCorrect ? 'correct' : 'incorrect',
      time_efficiency:
        timeSpent <= 30 ? 'fast' : timeSpent <= 60 ? 'normal' : 'slow',
      confidence_accuracy_match:
        (confidence === 'very_sure' || confidence === 'sure') ===
        req.answerData.isCorrect,
      hesitation_pattern:
        hesitationTime > 10 ? 'high' : hesitationTime > 5 ? 'medium' : 'low',
      interaction_pattern:
        interactionCount > 2
          ? 'hesitant'
          : interactionCount === 1
            ? 'decisive'
            : 'normal',
    };
  }

  /**
   * Construye el row para INSERT en test_questions. Función pura excepto
   * por la resolución de tema (Fase 3 inyectará TemaResolverService).
   *
   * Hoy: si `req.tema > 0` lo usa tal cual; si es 0, NO toca BD (devuelve
   * 0). Fase 3 inyectará el resolver de tema para el caso tema=0.
   *
   * Returns:
   *  - questionId: el id de pregunta (puede ser sintético si no venía)
   *  - row: objeto listo para `db.insert(testQuestions).values(row)`
   */
  buildTestAnswerRow(
    req: SaveAnswerRequest,
    userId: string,
    options: { resolvedTema?: number } = {},
  ): BuiltTestAnswerRow {
    const isPsychometric = req.questionData.questionType === 'psychometric';

    // Fase 2: usar el tema que mande el caller o el resolved-tema si lo
    // pasaron pre-resuelto. Fase 3: si tema=0 y no hay resolvedTema,
    // invocar TemaResolverService (async, fuera del scope de helpers puros).
    const rawTema = req.questionData.tema ?? req.tema ?? 0;
    const explicitTema =
      typeof rawTema === 'number' ? rawTema : parseInt(String(rawTema)) || 0;
    const calculatedTema =
      explicitTema > 0
        ? explicitTema
        : options.resolvedTema && options.resolvedTema > 0
          ? options.resolvedTema
          : 0;

    // Determinar question_id: priorizar id real > metadata.id > sintético.
    const questionId =
      req.questionData.id ||
      req.questionData.metadata?.id ||
      `tema-${calculatedTema}-art-${req.questionData.article?.number || 'unknown'}-${req.questionData.article?.law_short_name || 'unknown'}-${TestAnswersService.generateContentHash(req.questionData.question, req.questionData.options)}`;

    const articleId = req.questionData.article?.id || null;

    const hesitationTime = req.firstInteractionTime
      ? Math.max(0, req.firstInteractionTime - (req.questionStartTime || 0))
      : 0;

    const device: Partial<DeviceInfo> = req.deviceInfo || {};

    return {
      questionId,
      row: {
        testId: req.sessionId,
        userId,
        questionOrder: (req.answerData.questionIndex || 0) + 1,
        questionText: req.questionData.question || 'Pregunta sin texto',
        userAnswer: TestAnswersService.mapAnswerToLetter(
          req.answerData.selectedAnswer,
          req.answerData.correctAnswer,
          req.answerData.wasBlank === true,
        ),
        correctAnswer: String.fromCharCode(65 + (req.answerData.correctAnswer || 0)),
        isCorrect: req.answerData.isCorrect || false,
        wasBlank: req.answerData.wasBlank === true,

        // IDs según tipo de pregunta
        questionId: isPsychometric ? null : questionId,
        psychometricQuestionId: isPsychometric ? questionId : null,
        articleId,
        articleNumber: req.questionData.article?.number || 'unknown',
        lawName: req.questionData.article?.law_short_name || 'unknown',
        temaNumber: calculatedTema,
        questionType: isPsychometric ? 'psychometric' : 'legislative',

        // Tiempo y confianza
        confidenceLevel: req.confidenceLevel || 'unknown',
        timeSpentSeconds: Math.round(req.answerData.timeSpent || 0),
        timeToFirstInteraction: Math.round(hesitationTime),
        timeHesitation: Math.round(
          Math.max(0, (req.answerData.timeSpent || 0) - hesitationTime),
        ),
        interactionCount: req.interactionCount || 1,

        // Metadata
        difficulty: normalizeDifficulty(req.questionData.metadata?.difficulty),
        tags: req.questionData.metadata?.tags || [],

        // Learning placeholders (relleno en post-procesado o triggers BD)
        previousAttemptsThisArticle: 0,
        historicalAccuracyThisArticle: '0',

        // Device
        userAgent: device.userAgent || 'unknown',
        screenResolution: device.screenResolution || 'unknown',
        deviceType: device.deviceType || 'unknown',
        browserLanguage: device.browserLanguage || 'es',
        timezone: device.timezone || 'Europe/Madrid',

        // JSONB
        fullQuestionContext: TestAnswersService.buildQuestionContext(
          req,
          questionId,
          articleId,
        ),
        userBehaviorData: TestAnswersService.buildBehaviorData(req),
        learningAnalytics: TestAnswersService.buildLearningAnalytics(req),
      },
    };
  }

  /**
   * Insert real en test_questions — Fase 3.
   * Fase 2: stub que devuelve placeholder para que la firma esté lista.
   */
  async insertTestAnswer(
    _req: SaveAnswerRequest,
    _userId: string,
  ): Promise<SaveAnswerResponse> {
    // TODO Fase 3: implementación real con buildTestAnswerRow + INSERT.
    return { success: false, action: 'save_failed', error: 'not_implemented' };
  }
}
