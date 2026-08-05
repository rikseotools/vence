import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { testQuestions } from '../db/schema';
import {
  normalizeDifficulty,
  type DeviceInfo,
  type SaveAnswerRequest,
  type SaveAnswerResponse,
} from './test-answers.types';
import { articles, laws } from '../db/schema';
import { eq } from 'drizzle-orm';
import {
  decidirLawNamePersistida,
  esLeyResuelta,
  EVENTO_LAW_NAME_SIN_RESOLVER,
  type DecisionLawName,
} from './law-name-resuelta';
import { ObservabilityService } from '../observability/observability.service';

/**
 * Resultado de buildTestAnswerRow — el row listo para INSERT en
 * test_questions + el questionId computado (puede ser sintético si no
 * venía en el request).
 */
export interface BuiltTestAnswerRow {
  questionId: string;
  row: Record<string, unknown>;
  /**
   * T-559 — qué se decidió sobre `law_name` y si el hueco hay que emitirlo.
   * Sale del helper puro para que quien tiene observabilidad (insertTestAnswer)
   * lo emita: un `null` que podía haberse rellenado no se guarda en silencio.
   */
  decisionLaw: DecisionLawName;
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

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    // Opcional a propósito: los tests unitarios instancian el service sin él, y la
    // observabilidad nunca puede ser motivo de que no se guarde una respuesta.
    private readonly observability?: ObservabilityService,
  ) {}

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
    options: { resolvedTema?: number; lawResueltaDesdeArticulo?: string | null } = {},
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

    // T-559 — decisión ÚNICA de qué ley se persiste (núcleo `law-name-resuelta.ts`,
    // copia paritaria del de Next). Este helper es puro, así que la resolución contra
    // BD llega ya hecha en `options.lawResueltaDesdeArticulo`.
    const decisionLaw = decidirLawNamePersistida({
      delCliente: req.questionData.article?.law_short_name ?? null,
      resueltaDesdeArticulo: options.lawResueltaDesdeArticulo ?? null,
      tieneArticulo: !!articleId,
      esPsicotecnica: isPsychometric,
    });

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
        // 🔀 Permutación servida (T-235). NULL cuando no hubo barajado: es el caso
        // normal y el histórico lo interpreta como orden natural.
        optionOrder: req.answerData.optionOrder ?? null,

        // IDs según tipo de pregunta
        questionId: isPsychometric ? null : questionId,
        psychometricQuestionId: isPsychometric ? questionId : null,
        articleId,
        articleNumber: req.questionData.article?.number || 'unknown',
        // T-559: qué ley se persiste lo decide el núcleo compartido, NO un `|| 'unknown'`.
        // Ese relleno guardaba una ley inventada que aguas abajo se publicaba como real
        // (notificación «Artículos Problemáticos: unknown» → /teoria/unknown → 404).
        // `lawResueltaDesdeArticulo` lo precalcula `insertTestAnswer`, que es quien tiene BD.
        lawName: decisionLaw.lawName,
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
      decisionLaw,
    };
  }

  /**
   * Resuelve el short_name de la ley desde el `article_id` (fuente de verdad).
   * Gemelo de `resolveLawShortNameFromArticle` del frontend.
   *
   * Se llama SOLO cuando el cliente no trajo una ley usable — ni ausente ni un relleno
   * tipo 'unknown' (T-559). Devuelve null si no se puede resolver; quién decide qué se
   * persiste con ese null es `decidirLawNamePersistida`, no este helper.
   */
  private async resolveLawShortNameFromArticle(
    articleId: string | null,
  ): Promise<string | null> {
    if (!articleId) return null;
    try {
      const rows = await this.db
        .select({ shortName: laws.shortName })
        .from(articles)
        .innerJoin(laws, eq(articles.lawId, laws.id))
        .where(eq(articles.id, articleId))
        .limit(1);
      return rows[0]?.shortName ?? null;
    } catch (err) {
      // Fallo del lookup: devolvemos null y el núcleo lo clasificará como
      // `irresoluble_con_articulo` → se EMITE. No se traga en silencio.
      this.logger.warn(`resolveLawShortNameFromArticle falló para ${articleId}: ${String(err)}`);
      return null;
    }
  }

  /**
   * INSERT en test_questions con manejo idempotente del constraint
   * único `(test_id, question_order)`. Si la fila ya existía → 23505 →
   * `action='already_saved'` (NO es error, es comportamiento esperado
   * cuando el cliente reintenta tras timeout de red, por ejemplo).
   *
   * El `row` se construye vía `buildTestAnswerRow` (helper puro). El
   * `resolvedTema` opcional viene del orquestador (AnswerSaveService)
   * que ya ejecutó `TemaResolverService.resolveTemaByQuestionIdFast`
   * en paralelo con la validación de la pregunta.
   */
  async insertTestAnswer(
    req: SaveAnswerRequest,
    userId: string,
    options: { resolvedTema?: number } = {},
  ): Promise<SaveAnswerResponse> {
    try {
      // T-559 — la ley se RESUELVE antes de construir la fila. Solo se paga el lookup
      // cuando el cliente no trajo una ley usable: su relleno ('unknown') no cuenta
      // como ley, que es justo lo que persistió 15.109 filas con una ley inventada.
      const lawDelCliente = req.questionData.article?.law_short_name ?? null;
      const lawResueltaDesdeArticulo = esLeyResuelta(lawDelCliente)
        ? null
        : await this.resolveLawShortNameFromArticle(
            req.questionData.article?.id || null,
          );

      const { questionId, row, decisionLaw } = this.buildTestAnswerRow(req, userId, {
        ...options,
        lawResueltaDesdeArticulo,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.db.insert(testQuestions).values(row as any);

      // Regla dura: un `null` que PODÍA haberse rellenado no se guarda en silencio.
      // Antes esto no dejaba rastro y el defecto vivió seis meses hasta que lo
      // reportó una usuaria. Fire-and-forget: no puede tumbar el guardado.
      if (decisionLaw.emitir) {
        void this.observability
          ?.emit({
            source: 'fargate',
            severity: 'warn',
            eventType: EVENTO_LAW_NAME_SIN_RESOLVER,
            endpoint: '/api/v2/answer-and-save',
            userId,
            metadata: {
              motivo: decisionLaw.motivo,
              articleId: req.questionData.article?.id ?? null,
              questionId,
              escritor: 'backend',
              lawDelCliente,
            },
          })
          .catch(() => undefined);
      }

      return {
        success: true,
        question_id: questionId,
        action: 'saved_new',
      };
    } catch (err) {
      // El código 23505 puede estar en err.code (postgres directo) o
      // err.cause.code (wrapping de Drizzle). Cubrimos ambos.
      const pgCode =
        (err as { code?: string }).code ??
        (err as { cause?: { code?: string } }).cause?.code;

      if (pgCode === '23505') {
        // Constraint único = ya estaba guardada (idempotencia OK).
        return {
          success: true,
          question_id: req.questionData.id ?? null,
          action: 'already_saved',
        };
      }

      this.logger.error('insertTestAnswer error:', err);
      return {
        success: false,
        action: 'save_failed',
        error: err instanceof Error ? err.message : 'Error desconocido',
      };
    }
  }
}
