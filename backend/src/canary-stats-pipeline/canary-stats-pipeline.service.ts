import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { signCanaryToken } from '../canary-shared/canary-token';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

/**
 * Canary del PIPELINE de stats materializadas (outbox → handlers → tablas).
 *
 * Cierra el punto ciego de las reglas de alerta `RULE_MATERIALIZED_STATS_STALE`
 * y `RULE_STATS_PARIDAD_DIVERGENCE`: ésas dependen de TRÁFICO REAL (no disparan
 * en valle nocturno con poco volumen). Este canary inyecta una respuesta
 * sintética cada 5 min y verifica que propaga end-to-end, INDEPENDIENTE del
 * tráfico → cobertura 24/7 + determinista.
 *
 * Origen: incidente 2026-06-03 (cutover outbox a medias congeló 5 tablas 14h).
 *
 * Flujo:
 *   1. Estado previo del smoke user para la SMOKE_QUESTION: nº respuestas
 *      reales (test_questions) + total_attempts en uqh_v2 + max(question_order).
 *   2. POST /api/v2/answer-and-save con questionIndex = maxOrder+1 → inserta UNA
 *      respuesta fresca (delta conocido) → dispara emit → outbox → handler.
 *   3. Poll uqh_v2 hasta que total_attempts >= realCount+1 (propagó) o timeout.
 *   4. ok si propagó, failed (step='propagation') si la materialización no
 *      reflejó la respuesta → el pipeline está roto/parado.
 *
 * Reusa el smoke user y la SMOKE_QUESTION estable de canary-answer-save.
 * "Ensucia" el smoke user (288 inserts/día, insignificante, filtrable).
 */
@Injectable()
export class CanaryStatsPipelineService {
  private readonly logger = new Logger(CanaryStatsPipelineService.name);

  private readonly TARGET_URL =
    process.env.SMOKE_TARGET_URL ?? 'https://www.vence.es';
  private readonly TOKEN_TTL_SECONDS = 3600;
  private readonly PROPAGATION_TIMEOUT_MS = 12_000;
  private readonly POLL_INTERVAL_MS = 1_500;

  private readonly SMOKE_SESSION_ID = '00000000-0000-4000-8000-000000000001';
  private readonly SMOKE_QUESTION = {
    id: 'b419f803-274a-4c44-8df8-1192c57ff614',
    text: '¿Cuál es la opción correcta según el artículo 99 de la Constitución Española de 1978?',
    options: [
      'Si transcurrido el plazo de dos meses, a partir de la primera votación de investidura, ningún candidato hubiere obtenido la confianza del Congreso, el Rey disolverá ambas Cámaras y convocará nuevas elecciones con el refrendo del Presidente del Congreso.',
      'Si transcurrido el plazo de tres meses, a partir de la primera votación de investidura, ningún candidato hubiere obtenido la confianza del Congreso, el Rey disolverá ambas Cámaras y convocará nuevas elecciones con el refrendo del Presidente del Congreso.',
      'Si transcurrido el plazo de dos meses, a partir de la primera votación de investidura, ningún candidato hubiere obtenido la confianza del Congreso, el Rey disolverá ambas Cámaras y convocará nuevas elecciones con el refrendo del Presidente del Gobierno.',
      'Si transcurrido el plazo de tres meses a partir de la primera votación de investidura, ningún candidato hubiere obtenido la confianza del Congreso, el Rey disolverá ambas Cámaras.',
    ],
    articleId: '2c15266e-8c06-456a-a062-a5a5a0f15579',
  };

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(): Promise<CanaryStatsPipelineResult> {
    const startedAt = Date.now();
    const userId = process.env.SMOKE_USER_ID;
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;

    if (!userId || !jwtSecret) {
      this.logger.warn('SMOKE_USER_ID o SUPABASE_JWT_SECRET no configurados — canary inactivo.');
      return { skipped: true, reason: 'credentials_not_configured', durationMs: Date.now() - startedAt };
    }

    // ─── 1. Estado previo ───
    const before = await this.readState(userId);

    // ─── 2. Firmar JWT smoke ───
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
      return { ok: false, step: 'sign_token', errorMessage: `Firma JWT falló: ${err instanceof Error ? err.message : String(err)}`, durationMs: Date.now() - startedAt };
    }

    // ─── 3. POST con índice fresco (delta conocido) ───
    const freshIndex = before.maxOrder + 1;
    const body = {
      questionId: this.SMOKE_QUESTION.id,
      userAnswer: 0,
      isBlank: false,
      sessionId: this.SMOKE_SESSION_ID,
      questionIndex: freshIndex,
      questionText: this.SMOKE_QUESTION.text,
      options: this.SMOKE_QUESTION.options,
      tema: 0,
      questionType: 'legislative',
      article: { id: this.SMOKE_QUESTION.articleId, number: '99', law_short_name: 'CE' },
      metadata: { difficulty: 'easy', tags: ['canary', 'stats-pipeline'] },
      timeSpent: 5000,
      confidenceLevel: 'sure',
      interactionCount: 1,
      questionStartTime: Date.now() - 5000,
      firstInteractionTime: Date.now() - 3000,
      interactionEvents: [],
      mouseEvents: [],
      scrollEvents: [],
      deviceInfo: { userAgent: 'Vence-Canary-StatsPipeline/1.0', screenResolution: '1920x1080', deviceType: 'desktop', browserLanguage: 'es', timezone: 'Europe/Madrid' },
      oposicionId: 'auxiliar_administrativo_estado',
      currentScore: 0,
    };

    let httpStatus = 0;
    let responseBody: { success?: boolean; error?: string } & Record<string, unknown> = {};
    try {
      const res = await fetch(`${this.TARGET_URL}/api/v2/answer-and-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'User-Agent': 'Vence-Canary-StatsPipeline/1.0', 'x-vence-canary': '1' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      httpStatus = res.status;
      const text = await res.text().catch(() => '');
      try { responseBody = text ? JSON.parse(text) : {}; } catch { responseBody = { _raw: text.slice(0, 300) }; }

      // Pregunta canary retirada → deuda del canary, no regresión (warn, no critical).
      if ((httpStatus === 404 || httpStatus === 422) && typeof responseBody.error === 'string' && /quest|pregunt/i.test(responseBody.error)) {
        return { questionInvalid: true, httpStatus, errorMessage: responseBody.error, durationMs: Date.now() - startedAt };
      }
      if (!res.ok || responseBody.success !== true) {
        return { ok: false, step: 'answer_save', httpStatus, errorMessage: `answer-and-save HTTP ${httpStatus}: ${(responseBody.error ?? JSON.stringify(responseBody)).slice(0, 200)}`, durationMs: Date.now() - startedAt };
      }
    } catch (err) {
      return { ok: false, step: 'answer_save', errorMessage: `Excepción POST: ${err instanceof Error ? err.message : String(err)}`, durationMs: Date.now() - startedAt };
    }

    // ─── 4. Poll uqh_v2 hasta que refleje el delta (propagación del pipeline) ───
    const target = before.realCount + 1;
    const pollStart = Date.now();
    let lastUqh = before.uqh;
    let propagated = false;
    while (Date.now() - pollStart < this.PROPAGATION_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, this.POLL_INTERVAL_MS));
      lastUqh = await this.readUqh(userId);
      if (lastUqh >= target) { propagated = true; break; }
    }

    const durationMs = Date.now() - startedAt;
    if (!propagated) {
      return {
        ok: false,
        step: 'propagation',
        errorMessage: `uqh_v2 NO propagó: esperado >=${target}, visto ${lastUqh} tras ${this.PROPAGATION_TIMEOUT_MS}ms. Pipeline outbox→handler roto/parado.`,
        durationMs,
      };
    }
    return { ok: true, durationMs, propagationMs: Date.now() - pollStart, uqh: lastUqh };
  }

  private async readState(userId: string): Promise<{ realCount: number; maxOrder: number; uqh: number }> {
    const rows = (await this.db.execute(sql`
      SELECT COUNT(*)::int AS real_count, COALESCE(MAX(question_order), 0)::int AS max_order
      FROM test_questions
      WHERE user_id = ${userId}::uuid AND question_id = ${this.SMOKE_QUESTION.id}::uuid
    `)) as unknown as Array<{ real_count: number; max_order: number }>;
    const uqh = await this.readUqh(userId);
    return { realCount: rows[0]?.real_count ?? 0, maxOrder: rows[0]?.max_order ?? 0, uqh };
  }

  private async readUqh(userId: string): Promise<number> {
    const rows = (await this.db.execute(sql`
      SELECT COALESCE(total_attempts, 0)::int AS t
      FROM user_question_history_v2
      WHERE user_id = ${userId}::uuid AND question_id = ${this.SMOKE_QUESTION.id}::uuid
    `)) as unknown as Array<{ t: number }>;
    return rows[0]?.t ?? 0;
  }
}

export type CanaryStatsPipelineResult =
  | { ok: true; durationMs: number; propagationMs: number; uqh: number }
  | { skipped: true; reason: string; durationMs: number }
  | { questionInvalid: true; httpStatus: number; errorMessage: string; durationMs: number }
  | {
      ok: false;
      step: 'sign_token' | 'answer_save' | 'propagation';
      httpStatus?: number;
      errorMessage: string;
      durationMs: number;
    };
