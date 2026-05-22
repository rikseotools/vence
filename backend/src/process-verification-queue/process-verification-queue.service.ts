import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import {
  articles,
  questions,
  topicScope,
  verificationQueue,
} from './process-verification-queue.schema';

/** Número de preguntas que se envían a `/api/topic-review/verify` por llamada. */
const BATCH_SIZE = 5;

/**
 * Tiempo máximo de ejecución por invocación (ms).
 *
 * En el backend no hay un timeout externo de 60 s como en Vercel, pero se
 * preserva el límite original (50 s) para mantener la misma semántica: un
 * cron en curso puede continuar en la siguiente ejecución si el tema es muy
 * grande. Esto evita bloquear el event loop del proceso durante demasiado tiempo.
 */
const MAX_EXECUTION_TIME_MS = 50_000;

export interface RunResult {
  taskId: string | null;
  topicId: string | null;
  batchesProcessed: number;
  processedThisRun: number;
  processedTotal: number;
  total: number;
  successful: number;
  failed: number;
  isComplete: boolean;
  billingError: boolean;
  executionTimeMs: number;
  message?: string;
}

/** Fila de la tabla `verification_queue` tal como la devuelve Drizzle. */
type QueueTask = typeof verificationQueue.$inferSelect;

/** Respuesta esperada del endpoint `/api/topic-review/verify`. */
interface VerifyApiResponse {
  success: boolean;
  errorType?: string;
  error?: string;
  results?: unknown[];
  errors?: unknown[];
}

/**
 * Worker que procesa la cola de verificaciones de preguntas.
 *
 * Lógica portada desde `app/api/cron/process-verification-queue/route.js`.
 * En cada ejecución:
 *  1. Toma la tarea `processing` más antigua o, si no hay ninguna, pasa la
 *     primera tarea `pending` a `processing`.
 *  2. Llama al endpoint Next.js `/api/topic-review/verify` en batches de
 *     `BATCH_SIZE` preguntas hasta agotar las pendientes o el timeout.
 *  3. Actualiza el progreso en `verification_queue` tras cada batch.
 *  4. Si la API devuelve un error de billing, marca la tarea como `failed`
 *     y aborta.
 */
@Injectable()
export class ProcessVerificationQueueService {
  private readonly logger = new Logger(ProcessVerificationQueueService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
  ) {}

  async run(): Promise<RunResult> {
    const startTime = Date.now();

    // 1. Tomar tarea en curso o la siguiente pendiente
    let task = await this.getProcessingTask();

    if (!task) {
      task = await this.claimPendingTask();
    }

    if (!task) {
      this.logger.log('No hay verificaciones pendientes');
      return {
        taskId: null,
        topicId: null,
        batchesProcessed: 0,
        processedThisRun: 0,
        processedTotal: 0,
        total: 0,
        successful: 0,
        failed: 0,
        isComplete: true,
        billingError: false,
        executionTimeMs: Date.now() - startTime,
        message: 'No hay verificaciones pendientes',
      };
    }

    const baseUrl =
      this.config.get<string>('APP_BASE_URL') ?? 'https://www.vence.es';

    let totalProcessedThisRun = 0;
    let totalSuccessfulThisRun = 0;
    let totalFailedThisRun = 0;
    let batchesProcessed = 0;
    let isComplete = false;
    let billingError = false;

    // 2. Procesar batches en loop hasta completar o timeout
    while (!isComplete && !billingError) {
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_EXECUTION_TIME_MS) {
        this.logger.log(
          `⏰ Timeout alcanzado después de ${batchesProcessed} batches (${elapsed}ms)`,
        );
        break;
      }

      const pendingIds = await this.getPendingQuestionIds(task);

      if (pendingIds.length === 0) {
        isComplete = true;
        break;
      }

      const batch = pendingIds.slice(0, BATCH_SIZE);
      this.logger.log(
        `📦 Procesando batch ${batchesProcessed + 1}: ${batch.length} preguntas`,
      );

      const verifyResult = await this.callVerifyApi(baseUrl, batch, task);

      // Detectar error de billing/créditos
      if (!verifyResult.success && verifyResult.errorType === 'billing') {
        this.logger.error(`🛑 Error de billing: ${verifyResult.error}`);
        billingError = true;

        await this.db
          .update(verificationQueue)
          .set({
            status: 'failed',
            errorMessage: verifyResult.error ?? 'billing error',
            completedAt: new Date().toISOString(),
          })
          .where(eq(verificationQueue.id, task.id));

        break;
      }

      // Error genérico (red, timeout, 5xx): NO contar el batch como procesado
      // ni marcar la tarea completada. Se deja en 'processing' para que el
      // próximo run reintente — el original abortaba el run ante un error así.
      if (!verifyResult.success) {
        this.logger.error(
          `Batch falló (${verifyResult.error ?? 'error desconocido'}) — tarea ${task.id} queda en 'processing' para reintentar`,
        );
        break;
      }

      const batchSuccessful = verifyResult.results?.length ?? 0;
      const batchFailed = verifyResult.errors?.length ?? 0;

      totalProcessedThisRun += batch.length;
      totalSuccessfulThisRun += batchSuccessful;
      totalFailedThisRun += batchFailed;
      batchesProcessed++;

      const newProcessed =
        (task.processedQuestions ?? 0) + totalProcessedThisRun;
      const newSuccessful =
        (task.successfulVerifications ?? 0) + totalSuccessfulThisRun;
      const newFailed =
        (task.failedVerifications ?? 0) + totalFailedThisRun;

      isComplete = pendingIds.length <= batch.length;

      await this.db
        .update(verificationQueue)
        .set({
          processedQuestions: newProcessed,
          successfulVerifications: newSuccessful,
          failedVerifications: newFailed,
          status: isComplete ? 'completed' : 'processing',
          completedAt: isComplete ? new Date().toISOString() : null,
        })
        .where(eq(verificationQueue.id, task.id));

      if (!isComplete) {
        await new Promise<void>((resolve) => setTimeout(resolve, 500));
      }
    }

    // Recargar para obtener los valores finales persistidos en BD
    const [finalTask] = await this.db
      .select()
      .from(verificationQueue)
      .where(eq(verificationQueue.id, task.id))
      .limit(1);

    const executionTimeMs = Date.now() - startTime;
    this.logger.log(
      `Tarea ${task.id}: ${batchesProcessed} batches procesados en ${executionTimeMs}ms` +
        ` — completa=${isComplete}, billingError=${billingError}`,
    );

    return {
      taskId: task.id,
      topicId: task.topicId ?? null,
      batchesProcessed,
      processedThisRun: totalProcessedThisRun,
      processedTotal: finalTask?.processedQuestions ?? 0,
      total: finalTask?.totalQuestions ?? task.totalQuestions ?? 0,
      successful: finalTask?.successfulVerifications ?? 0,
      failed: finalTask?.failedVerifications ?? 0,
      isComplete,
      billingError,
      executionTimeMs,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------------------

  /** Devuelve la tarea más antigua con status='processing', o null. */
  private async getProcessingTask(): Promise<QueueTask | null> {
    const rows = await this.db
      .select()
      .from(verificationQueue)
      .where(eq(verificationQueue.status, 'processing'))
      .orderBy(verificationQueue.startedAt)
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * Toma la tarea `pending` más antigua y la pasa a `processing` con un
   * UPDATE atómico (evita race conditions si hubiera más de un worker).
   */
  private async claimPendingTask(): Promise<QueueTask | null> {
    // Primero encontramos la candidata
    const [pending] = await this.db
      .select()
      .from(verificationQueue)
      .where(eq(verificationQueue.status, 'pending'))
      .orderBy(verificationQueue.createdAt)
      .limit(1);

    if (!pending) return null;

    // UPDATE condicional: solo transiciona si sigue en 'pending'
    const updated = await this.db
      .update(verificationQueue)
      .set({
        status: 'processing',
        startedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(verificationQueue.id, pending.id),
          eq(verificationQueue.status, 'pending'),
        ),
      )
      .returning();

    return updated[0] ?? null;
  }

  /**
   * Obtiene los IDs de preguntas aún pendientes de verificar para la tarea.
   *
   * Si la tarea tiene `question_ids` explícitos, filtra los que siguen activos
   * con `topic_review_status` null o 'pending'.
   * En caso contrario, deriva las preguntas a partir del `topic_id`.
   */
  private async getPendingQuestionIds(task: QueueTask): Promise<string[]> {
    if (task.questionIds && task.questionIds.length > 0) {
      const rows = await this.db
        .select({ id: questions.id })
        .from(questions)
        .where(
          and(
            inArray(questions.id, task.questionIds as string[]),
            eq(questions.isActive, true),
            or(
              isNull(questions.topicReviewStatus),
              eq(questions.topicReviewStatus, 'pending'),
            ),
          ),
        );

      return rows.map((r) => r.id);
    }

    if (!task.topicId) return [];

    // Obtener scopes del tema
    const scopes = await this.db
      .select({
        lawId: topicScope.lawId,
        articleNumbers: topicScope.articleNumbers,
      })
      .from(topicScope)
      .where(eq(topicScope.topicId, task.topicId));

    // Recopilar article IDs a partir de law_id + article_numbers
    const articleIds: string[] = [];

    for (const scope of scopes) {
      if (!scope.lawId || !scope.articleNumbers?.length) continue;

      const articleRows = await this.db
        .select({ id: articles.id })
        .from(articles)
        .where(
          and(
            eq(articles.lawId, scope.lawId),
            inArray(articles.articleNumber, scope.articleNumbers as string[]),
          ),
        );

      articleIds.push(...articleRows.map((a) => a.id));
    }

    if (articleIds.length === 0) return [];

    // Obtener preguntas en lotes para no superar el límite de parámetros
    const allPendingIds: string[] = [];
    const ARTICLE_BATCH = 50;

    for (let i = 0; i < articleIds.length; i += ARTICLE_BATCH) {
      const batchIds = articleIds.slice(i, i + ARTICLE_BATCH);
      const rows = await this.db
        .select({ id: questions.id })
        .from(questions)
        .where(
          and(
            inArray(questions.primaryArticleId, batchIds),
            eq(questions.isActive, true),
            or(
              isNull(questions.topicReviewStatus),
              eq(questions.topicReviewStatus, 'pending'),
            ),
          ),
        );

      allPendingIds.push(...rows.map((r) => r.id));
    }

    return allPendingIds;
  }

  /**
   * Llama al endpoint Next.js `/api/topic-review/verify` con un batch de IDs.
   * El cron original de Vercel no envía cabecera de autorización — se replica igual.
   */
  private async callVerifyApi(
    baseUrl: string,
    questionIds: string[],
    task: QueueTask,
  ): Promise<VerifyApiResponse> {
    try {
      const response = await fetch(`${baseUrl}/api/topic-review/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionIds,
          provider: task.aiProvider,
          model: task.aiModel,
        }),
      });

      return (await response.json()) as VerifyApiResponse;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error llamando a /api/topic-review/verify: ${message}`);
      // Devolver fallo: el loop de run() lo detecta (!success) y deja la
      // tarea en 'processing' para reintentar en el próximo run.
      return { success: false, error: message, errors: [{ error: message }] };
    }
  }
}
