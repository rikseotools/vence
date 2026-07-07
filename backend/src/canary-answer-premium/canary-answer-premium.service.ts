import { Injectable, Logger } from '@nestjs/common';
import { signCanaryToken } from '../canary-shared/canary-token';

/**
 * Canary `answer-premium` — un usuario PREMIUM NUNCA debe recibir un 403 de límite
 * diario en NINGÚN endpoint de respuesta.
 *
 * NACIÓ del incidente 07/07/2026: `/api/answer/psychometric` (y `/api/exam/answer`)
 * quedaron desplegados con código stale que bloqueaba a premium con "Has alcanzado
 * el límite diario". El smoke de deploy (home/asset/auth) NO lo cazó porque no
 * ejercía los endpoints de respuesta con identidad premium, y la observabilidad
 * atribuía el 403 a `body.userId` (no al token) → falsa alarma imposible de alertar.
 * Este canary cierra ese hueco: ejerce cada endpoint con un token premium real y
 * asevera que el gate de límite lo exime.
 *
 * Método: firma un JWT HS256 (mismo patrón agnóstico que `canary-answer-save`) para
 * `SMOKE_PREMIUM_USER_ID` (plan_type premium) y hace POST con payload de formato
 * VÁLIDO pero datos INEXISTENTES → pasa la validación Zod → llega al gate de límite
 * → si premium está bloqueado responde 403 (REGRESIÓN), si no responde 404/gate-ok
 * (cero polución: no guarda nada). GOTCHA: un payload con formato inválido falla Zod
 * ANTES del gate (400) → no probaría el límite (falso verde) → los payloads deben
 * pasar el esquema de cada endpoint.
 */
@Injectable()
export class CanaryAnswerPremiumService {
  private readonly logger = new Logger(CanaryAnswerPremiumService.name);

  private readonly TARGET_URL =
    process.env.SMOKE_TARGET_URL ?? 'https://www.vence.es';
  private readonly TOKEN_TTL_SECONDS = 300;
  private readonly FAKE_UUID = '00000000-0000-4000-8000-0000000000ca';

  // Payloads mínimos que pasan cada esquema Zod → llegan al gate de límite.
  private endpoints() {
    return [
      { path: '/api/answer/psychometric', body: { questionId: this.FAKE_UUID, userAnswer: 0 } },
      { path: '/api/exam/answer', body: { testId: this.FAKE_UUID, questionOrder: 1, userAnswer: 'a' } },
      {
        path: '/api/v2/answer-and-save',
        body: {
          questionId: this.FAKE_UUID,
          userAnswer: 0,
          sessionId: this.FAKE_UUID,
          questionIndex: 0,
          questionText: 'canary',
          options: ['a', 'b'],
        },
      },
    ];
  }

  private isLimitBlock(status: number, text: string): boolean {
    return (
      status === 403 &&
      /límite diario|mucha demanda|dispositivo ha alcanzado/i.test(text ?? '')
    );
  }

  async run(): Promise<CanaryAnswerPremiumResult> {
    const startedAt = Date.now();
    // Reutiliza el SMOKE_USER_ID existente (smoke@vence.es, premium, ya cableado en
    // el task def). Override con SMOKE_PREMIUM_USER_ID si se quiere otro premium.
    const userId =
      process.env.SMOKE_PREMIUM_USER_ID ?? process.env.SMOKE_USER_ID;
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;

    if (!userId || !jwtSecret) {
      this.logger.warn(
        'SMOKE_PREMIUM_USER_ID o SUPABASE_JWT_SECRET no configurados — canary inactivo.',
      );
      return {
        skipped: true,
        reason: 'credentials_not_configured',
        durationMs: Date.now() - startedAt,
      };
    }

    const token = signCanaryToken(userId, {
      ttlSeconds: this.TOKEN_TTL_SECONDS,
      email: 'canary-premium@vence.es',
      secret: jwtSecret,
    });
    if (!token) {
      return { ok: false, errorMessage: 'Firma JWT falló', durationMs: Date.now() - startedAt };
    }
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'Vence-Canary-AnswerPremium/1.0',
      'x-vence-canary': '1',
    };

    // 0. Sanity: el servidor debe ver al smoke user como premium.
    try {
      const r = await fetch(`${this.TARGET_URL}/api/daily-limit`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      const j = (await r.json().catch(() => ({}))) as { isPremium?: boolean };
      if (j.isPremium !== true) {
        return {
          ok: false,
          errorMessage: `daily-limit no reconoce premium (isPremium=${j.isPremium}). ¿SMOKE_PREMIUM_USER_ID es premium?`,
          durationMs: Date.now() - startedAt,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, errorMessage: `daily-limit: ${msg}`, durationMs: Date.now() - startedAt };
    }

    // 1. Ningún endpoint de respuesta debe bloquear a premium por límite.
    const blocked: string[] = [];
    for (const ep of this.endpoints()) {
      try {
        const r = await fetch(`${this.TARGET_URL}${ep.path}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(ep.body),
          signal: AbortSignal.timeout(10_000),
        });
        const text = await r.text().catch(() => '');
        if (this.isLimitBlock(r.status, text)) {
          blocked.push(`${ep.path} (403: ${text.slice(0, 120)})`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, errorMessage: `${ep.path}: ${msg}`, durationMs: Date.now() - startedAt };
      }
    }

    const durationMs = Date.now() - startedAt;
    if (blocked.length) {
      return {
        ok: false,
        blockedEndpoints: blocked,
        errorMessage: `Premium bloqueado en: ${blocked.join('; ')}`,
        durationMs,
      };
    }
    return { ok: true, durationMs };
  }
}

export type CanaryAnswerPremiumResult =
  | { ok: true; durationMs: number }
  | { skipped: true; reason: string; durationMs: number }
  | { ok: false; errorMessage: string; blockedEndpoints?: string[]; durationMs: number };
