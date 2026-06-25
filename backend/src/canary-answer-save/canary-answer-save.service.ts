import { Injectable, Logger } from '@nestjs/common';
import { signCanaryToken } from '../canary-shared/canary-token';

/**
 * Canary `/api/v2/answer-and-save` — Nivel 3 (3er canary autenticado).
 *
 * Cubre el endpoint MÁS caliente de la app: cada respuesta de cada user en
 * cada test pasa por aquí. Si se rompe (Drizzle transactional save, RLS,
 * antifraud cache, daily-limit query, schema validation, JwtGuard, …) la
 * app queda inutilizable instantáneamente.
 *
 * Approach: mismo patrón que `canary-smoke-auth` — JWT firmado local con
 * `SUPABASE_JWT_SECRET`, agnóstico al proveedor de auth. POST con cuerpo
 * completo simulando un user real respondiendo una pregunta conocida.
 *
 * Decisión "ensucia BD del smoke user" (opción A, 27/05/2026):
 *   - El smoke user existe PARA ser usado por canarios → ensuciarlo es OK.
 *   - 288 inserts/día en test_questions del smoke user son insignificantes
 *     vs miles de users reales. Filtrar en agregados es 1 línea SQL el
 *     día que moleste (WHERE user_id != '127063e1...').
 *   - Cubre TRANSACTIONAL INSERT real → detecta regresión Drizzle/RLS/FK
 *     que la opción "skip insert" perdería.
 *
 * Pregunta hardcodeada (b419f803...): art 99 CE, easy, > 6 meses de
 * antigüedad. Si se retira en el futuro:
 *   - 404/422 del endpoint → emit `canary_answer_save_question_invalid`
 *     SEVERITY WARN (no critical). NO dispara RULE.
 *   - Diagnóstico evidente en logs → actualizar SMOKE_QUESTION_ID aquí.
 */
@Injectable()
export class CanaryAnswerSaveService {
  private readonly logger = new Logger(CanaryAnswerSaveService.name);

  private readonly TARGET_URL =
    process.env.SMOKE_TARGET_URL ?? 'https://www.vence.es';
  private readonly MAX_DURATION_MS = 15_000; // 15s — answer-save puede ser lento bajo carga
  private readonly TOKEN_TTL_SECONDS = 3600;

  // Session smoke estable (creada manualmente 27/05/2026 en tabla `tests`).
  // El primer tick INSERT row en test_questions con PK (session_id, question_id,
  // question_index); los siguientes 287 ticks/día devuelven 23505 (unique
  // constraint) → `already_saved` → success:true → 200. Contamina UNA fila.
  private readonly SMOKE_SESSION_ID = '00000000-0000-4000-8000-000000000001';

  // Pregunta estable hardcoded: art 99 CE, easy, creada 2024. Si se retira:
  // diagnóstico en logs → actualizar este UUID aquí.
  private readonly SMOKE_QUESTION = {
    id: 'b419f803-274a-4c44-8df8-1192c57ff614',
    text: '¿Cuál es la opción correcta según el artículo 99 de la Constitución Española de 1978?',
    options: [
      // Opciones reales de esa pregunta (necesarias para el body).
      // El handler las usa solo para guardar en test_questions; la lógica
      // de "es correcta" se valida server-side comparando userAnswer con
      // questions.correct_option (NO con esto).
      'Si transcurrido el plazo de dos meses, a partir de la primera votación de investidura, ningún candidato hubiere obtenido la confianza del Congreso, el Rey disolverá ambas Cámaras y convocará nuevas elecciones con el refrendo del Presidente del Congreso.',
      'Si transcurrido el plazo de tres meses, a partir de la primera votación de investidura, ningún candidato hubiere obtenido la confianza del Congreso, el Rey disolverá ambas Cámaras y convocará nuevas elecciones con el refrendo del Presidente del Congreso.',
      'Si transcurrido el plazo de dos meses, a partir de la primera votación de investidura, ningún candidato hubiere obtenido la confianza del Congreso, el Rey disolverá ambas Cámaras y convocará nuevas elecciones con el refrendo del Presidente del Gobierno.',
      'Si transcurrido el plazo de tres meses a partir de la primera votación de investidura, ningún candidato hubiere obtenido la confianza del Congreso, el Rey disolverá ambas Cámaras.',
    ],
    difficulty: 'easy' as const,
    articleId: '2c15266e-8c06-456a-a062-a5a5a0f15579',
  };

  async run(): Promise<CanaryAnswerSaveResult> {
    const startedAt = Date.now();

    const userId = process.env.SMOKE_USER_ID;
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;

    if (!userId || !jwtSecret) {
      this.logger.warn(
        'SMOKE_USER_ID o SUPABASE_JWT_SECRET no configurados — canary inactivo.',
      );
      return {
        skipped: true,
        reason: 'credentials_not_configured',
        durationMs: Date.now() - startedAt,
      };
    }

    // ─── 1. Firmar JWT smoke ───
    let token: string;
    try {
      const signed = signCanaryToken(userId, {
        ttlSeconds: this.TOKEN_TTL_SECONDS,
        email: 'smoke@vence.es',
        secret: jwtSecret,
      });
      if (!signed) throw new Error('SUPABASE_JWT_SECRET no configurado');
      token = signed;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        step: 'sign_token',
        errorMessage: `Firma JWT falló: ${msg}`,
        durationMs: Date.now() - startedAt,
      };
    }

    // ─── 2. Construir body completo ───
    const body = {
      questionId: this.SMOKE_QUESTION.id,
      // userAnswer puede ser cualquier valor 0-3. El canary valida que el
      // endpoint procesa y guarda, NO que el user acierte. Usamos 0 (A) que
      // es la respuesta correcta para esta pregunta — irrelevante funcionalmente.
      userAnswer: 0,
      isBlank: false,
      sessionId: this.SMOKE_SESSION_ID,
      questionIndex: 0,
      questionText: this.SMOKE_QUESTION.text,
      options: this.SMOKE_QUESTION.options,
      tema: 0,
      questionType: 'legislative',
      article: {
        id: this.SMOKE_QUESTION.articleId,
        number: '99',
        law_short_name: 'CE',
      },
      metadata: {
        difficulty: this.SMOKE_QUESTION.difficulty,
        tags: ['canary'], // marca explícita para futuros filtros
      },
      timeSpent: 5000,
      confidenceLevel: 'sure',
      interactionCount: 1,
      questionStartTime: Date.now() - 5000,
      firstInteractionTime: Date.now() - 3000,
      interactionEvents: [],
      mouseEvents: [],
      scrollEvents: [],
      deviceInfo: {
        userAgent: 'Vence-Canary-AnswerSave/1.0',
        screenResolution: '1920x1080',
        deviceType: 'desktop',
        browserLanguage: 'es',
        timezone: 'Europe/Madrid',
      },
      oposicionId: 'auxiliar_administrativo_estado',
      currentScore: 0,
    };

    // ─── 3. POST endpoint ───
    let httpStatus = 0;
    let responseBody: { success?: boolean; error?: string } & Record<string, unknown> = {};
    try {
      const res = await fetch(`${this.TARGET_URL}/api/v2/answer-and-save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'Vence-Canary-AnswerSave/1.0',
          'x-vence-canary': '1',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });

      httpStatus = res.status;
      const text = await res.text().catch(() => '');
      try {
        responseBody = text ? JSON.parse(text) : {};
      } catch {
        responseBody = { _raw: text.slice(0, 300) };
      }

      // 404/422 con error de pregunta → la pregunta canary fue retirada/modificada.
      // No es regresión de la app, es deuda del canary. Severity warn, NO critical.
      if (
        (httpStatus === 404 || httpStatus === 422) &&
        typeof responseBody.error === 'string' &&
        /quest|pregunt/i.test(responseBody.error)
      ) {
        return {
          questionInvalid: true,
          httpStatus,
          errorMessage: responseBody.error,
          durationMs: Date.now() - startedAt,
        };
      }

      if (!res.ok) {
        return {
          ok: false,
          step: 'http',
          httpStatus,
          errorMessage: `HTTP ${httpStatus}: ${(responseBody.error ?? JSON.stringify(responseBody)).slice(0, 200)}`,
          durationMs: Date.now() - startedAt,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        step: 'http',
        errorMessage: `Excepción POST: ${msg}`,
        durationMs: Date.now() - startedAt,
      };
    }

    // ─── 4. Validar response ───
    if (responseBody.success !== true) {
      return {
        ok: false,
        step: 'validate_response',
        httpStatus,
        errorMessage: `Response sin success=true: ${JSON.stringify(responseBody).slice(0, 200)}`,
        durationMs: Date.now() - startedAt,
      };
    }

    // ─── 5. Validar latencia ───
    const durationMs = Date.now() - startedAt;
    if (durationMs > this.MAX_DURATION_MS) {
      return {
        ok: false,
        step: 'validate_latency',
        errorMessage: `Latencia ${durationMs}ms > umbral ${this.MAX_DURATION_MS}ms`,
        durationMs,
      };
    }

    return {
      ok: true,
      durationMs,
      httpStatus,
      isCorrect: typeof responseBody.isCorrect === 'boolean' ? responseBody.isCorrect : null,
    };
  }
}

export type CanaryAnswerSaveResult =
  | { ok: true; durationMs: number; httpStatus: number; isCorrect: boolean | null }
  | { skipped: true; reason: string; durationMs: number }
  | { questionInvalid: true; httpStatus: number; errorMessage: string; durationMs: number }
  | {
      ok: false;
      step: 'sign_token' | 'http' | 'validate_response' | 'validate_latency';
      httpStatus?: number;
      errorMessage: string;
      durationMs: number;
    };
