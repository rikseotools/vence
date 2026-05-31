import { Injectable, Logger } from '@nestjs/common';

/**
 * Canary `/api/topics/[numero]` — Nivel 3 sintético.
 *
 * Cubre el endpoint que sirve la página de tema/contenido al usuario. Es
 * público (no requiere JWT) y combina:
 *   - Redis stale-while-error
 *   - Drizzle queries sobre `topics`, `topic_scope`, `laws`, `questions`,
 *     `articles` (refactor Fase D-bis Iter 1.5 con materialized views si
 *     `TOPIC_MV_ENABLED=true`).
 *   - `withDbTimeout` de 12s con fallback a 503 retryable.
 *
 * Qué detecta que tests CI no detectan:
 *   - Caída del path Next.js completo (middlewares, Redis externo, BD).
 *   - Drift de feature flag `TOPIC_MV_ENABLED` (camino MV inactivo cuando
 *     debería estar activo, o viceversa). El canary no afirma el modo —
 *     solo que el endpoint responde OK independiente del camino.
 *   - Materialized view `topic_law_question_summary` ausente, corrupta o
 *     con `total_questions=0` por bug en el refresh (caso real fix #1
 *     31/05/2026 — COUNT(*) sumaba filas NULL del LEFT JOIN).
 *   - Shape regression: si el endpoint pierde `articlesByLaw` o
 *     `difficultyStats`, el frontend rompe pero los tests CI no lo ven.
 *
 * Aplica la REGLA DE ORO ANTI-DUPLICACIÓN (docs/roadmap/canary-y-simulaciones.md
 * §259-313): hay `__tests__/api/topic-data/topicData.test.ts` para schemas
 * y `mvQueries.test.ts` para los aggregates, pero ningún test corre el
 * endpoint en producción real con Redis + BD + flag.
 *
 * Smoke target estable:
 *   - oposicion: `auxiliar-administrativo-estado` (alta cardinalidad).
 *   - topicNumber: 5 (tema típico con varias leyes — máxima diferencia
 *     entre camino antiguo N×SELECT y camino MV 2-paralelo).
 *   - sin userId (no necesitamos contaminar progreso per-user — el path
 *     `getUserProgressForTopicV2` queda fuera del canary).
 */
@Injectable()
export class CanaryTopicDataService {
  private readonly logger = new Logger(CanaryTopicDataService.name);

  private readonly TARGET_URL =
    process.env.SMOKE_TARGET_URL ?? 'https://www.vence.es';
  /**
   * Tope de latencia. Generoso a 8s para cubrir:
   *   - Cold path antiguo (4-7s p95 antes de Iter 1.5).
   *   - Latencia red Fargate → CloudFront → ECS frontend → BD.
   *   - Tras MV activado debería ser ~300ms p95; un canary que falla a 8s
   *     significa regresión severa.
   */
  private readonly MAX_DURATION_MS = 8_000;

  private readonly SMOKE_TOPIC_NUMBER = 5;
  private readonly SMOKE_OPOSICION = 'auxiliar-administrativo-estado';

  async run(): Promise<CanaryTopicDataResult> {
    const startedAt = Date.now();
    const url = `${this.TARGET_URL}/api/topics/${this.SMOKE_TOPIC_NUMBER}?oposicion=${this.SMOKE_OPOSICION}`;

    let httpStatus = 0;
    let responseBody: {
      success?: boolean;
      totalQuestions?: number;
      officialQuestionsCount?: number;
      articlesByLaw?: Array<{ lawShortName: string; articlesWithQuestions: number }>;
      difficultyStats?: Record<string, number>;
      error?: string;
    } = {};

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Vence-Canary-TopicData/1.0',
          'x-vence-canary': '1',
        },
        signal: AbortSignal.timeout(10_000),
      });

      httpStatus = res.status;
      const text = await res.text().catch(() => '');
      try {
        responseBody = text ? JSON.parse(text) : {};
      } catch {
        return {
          ok: false,
          step: 'parse',
          httpStatus,
          errorMessage: `Body no es JSON parseable: ${text.slice(0, 200)}`,
          durationMs: Date.now() - startedAt,
        };
      }

      // 503 saturado momentáneamente es retryable; el cron de alertas
      // RULE_HTTP_5XX_SPIKE ya lo cuenta a nivel global. Aquí lo registramos
      // como fallo específico del path topic-data — útil para diagnóstico.
      if (!res.ok) {
        return {
          ok: false,
          step: 'http',
          httpStatus,
          errorMessage: `HTTP ${httpStatus}: ${(responseBody.error ?? text.slice(0, 200)).toString()}`,
          durationMs: Date.now() - startedAt,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        step: 'http',
        errorMessage: `Excepción GET: ${msg}`,
        durationMs: Date.now() - startedAt,
      };
    }

    // ─── Shape assertions ───
    if (responseBody.success !== true) {
      return {
        ok: false,
        step: 'shape',
        httpStatus,
        errorMessage: `Response sin success=true: ${JSON.stringify(responseBody).slice(0, 200)}`,
        durationMs: Date.now() - startedAt,
      };
    }
    const totalQuestions = Number(responseBody.totalQuestions ?? 0);
    if (!Number.isFinite(totalQuestions) || totalQuestions <= 0) {
      return {
        ok: false,
        step: 'shape_empty',
        httpStatus,
        errorMessage: `totalQuestions=${responseBody.totalQuestions} (esperado > 0)`,
        durationMs: Date.now() - startedAt,
      };
    }
    const articleCount = Array.isArray(responseBody.articlesByLaw)
      ? responseBody.articlesByLaw.length
      : 0;
    if (articleCount === 0) {
      return {
        ok: false,
        step: 'shape_no_articles',
        httpStatus,
        errorMessage: `articlesByLaw vacío para tema ${this.SMOKE_TOPIC_NUMBER}`,
        durationMs: Date.now() - startedAt,
      };
    }

    const durationMs = Date.now() - startedAt;
    if (durationMs > this.MAX_DURATION_MS) {
      return {
        ok: false,
        step: 'validate_latency',
        httpStatus,
        errorMessage: `Latencia ${durationMs}ms > umbral ${this.MAX_DURATION_MS}ms`,
        durationMs,
      };
    }

    return {
      ok: true,
      durationMs,
      httpStatus,
      totalQuestions,
      articleCount,
      officialQuestionsCount: Number(responseBody.officialQuestionsCount ?? 0),
    };
  }
}

export type CanaryTopicDataResult =
  | {
      ok: true;
      durationMs: number;
      httpStatus: number;
      totalQuestions: number;
      articleCount: number;
      officialQuestionsCount: number;
    }
  | {
      ok: false;
      step:
        | 'http'
        | 'parse'
        | 'shape'
        | 'shape_empty'
        | 'shape_no_articles'
        | 'validate_latency';
      httpStatus?: number;
      errorMessage: string;
      durationMs: number;
    };
