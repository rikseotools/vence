import { Injectable, Logger } from '@nestjs/common';
import jwt from 'jsonwebtoken';

/**
 * Canary del GATE anti-scraping (Cloudflare Turnstile en /api/questions/filtered).
 *
 * Qué verifica (la regresión REAL del gate): que un usuario normal autenticado,
 * MUY por debajo del umbral diario de preguntas servidas, puede cargar preguntas
 * SIN que el gate le exija un reto humano. Si una futura regresión hiciera que la
 * policy (contador Redis) o `verifyHumanChallenge` retara a todo el mundo, este
 * canary lo cazaría: el endpoint devolvería 403 challengeRequired a un usuario
 * que no debería ser retado.
 *
 * NO verifica la rama "token válido → 200": en prod usamos la secret key real de
 * Turnstile, así que sin un navegador resolviendo un reto Managed no se puede
 * fabricar un token válido (Turnstile está diseñado para resistir automatización).
 * Esa cobertura, si se quisiera, sería un E2E Playwright con browser real.
 *
 * Identidad: reutiliza el usuario smoke (SMOKE_USER_ID + SUPABASE_JWT_SECRET),
 * el mismo de canary-smoke-auth. Es premium y NO carga 500 preguntas/día, así que
 * el gate nunca debe retarle. Pide numQuestions=1 para no engordar su contador.
 *
 * Cadencia: NO tiene @Cron (no corre cada 5min). Se dispara POST-DEPLOY desde el
 * workflow frontend-deploy (único momento en que el gate puede cambiar) vía el
 * endpoint CRON_SECRET. Origen: caso scraping Ana Fernández 02/06/2026.
 */
@Injectable()
export class CanaryQuestionsGateService {
  private readonly logger = new Logger(CanaryQuestionsGateService.name);

  private readonly TARGET_URL =
    process.env.SMOKE_TARGET_URL ?? 'https://www.vence.es';
  private readonly MAX_TOTAL_DURATION_MS = 12_000;
  private readonly TOKEN_TTL_SECONDS = 300;

  async run(): Promise<CanaryGateResult> {
    const startedAt = Date.now();

    const userId = process.env.SMOKE_USER_ID;
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;

    if (!userId || !jwtSecret) {
      this.logger.warn(
        'SMOKE_USER_ID o SUPABASE_JWT_SECRET no configurados — canary gate inactivo.',
      );
      return {
        skipped: true,
        reason: 'credentials_not_configured',
        durationMs: Date.now() - startedAt,
      };
    }

    // ─── Paso 0: el gate debe estar ENCENDIDO ───────────────────────────
    // Verificación POSITIVA: un gate apagado parece idéntico a uno funcionando
    // desde el camino feliz (cargar va bien igual). Por eso preguntamos el estado
    // efectivo. Bug 03/06: site key no horneada → enabled=false sin que nada avisara.
    try {
      const statusRes = await fetch(
        `${this.TARGET_URL}/api/security/captcha/status`,
        {
          headers: {
            Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}`,
            'User-Agent': 'Vence-Canary-Gate/1.0',
            'x-vence-canary': '1',
          },
          signal: AbortSignal.timeout(5000),
        },
      )
      if (statusRes.ok) {
        const st = (await statusRes.json()) as {
          enabled?: boolean
          siteKeyPresent?: boolean
          secretPresent?: boolean
          flagOn?: boolean
        }
        if (st.enabled !== true) {
          return {
            ok: false,
            step: 'gate_disabled',
            errorMessage:
              `Gate anti-scraping APAGADO en prod (enabled=${st.enabled}): ` +
              `siteKeyPresent=${st.siteKeyPresent}, secretPresent=${st.secretPresent}, ` +
              `flagOn=${st.flagOn}. El control NO está protegiendo el banco.`,
            durationMs: Date.now() - startedAt,
          }
        }
      }
      // Si el status no responde OK, no fallamos por eso aquí (otras sondas lo
      // cubren); seguimos al test de carga real.
    } catch {
      /* status check best-effort; no bloquear por su indisponibilidad */
    }

    // ─── Paso 1: firmar JWT smoke (idéntico a canary-smoke-auth) ───
    let token: string;
    try {
      const now = Math.floor(Date.now() / 1000);
      token = jwt.sign(
        {
          sub: userId,
          aud: 'authenticated',
          role: 'authenticated',
          email: 'smoke@vence.es',
          iat: now,
          exp: now + this.TOKEN_TTL_SECONDS,
        },
        jwtSecret,
        { algorithm: 'HS256' },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        step: 'sign_token',
        errorMessage: `Firma JWT falló: ${msg}`,
        durationMs: Date.now() - startedAt,
      };
    }

    // ─── Paso 2: POST /api/questions/filtered como usuario normal ───
    // Body mínimo válido (calcado de ExamAleatorioClient). numQuestions=1 para
    // no incrementar el contador de servidas del usuario smoke.
    const body = {
      topicNumber: 0,
      positionType: 'auxiliar_administrativo_estado',
      multipleTopics: [1],
      numQuestions: 1,
      selectedLaws: [],
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      onlyOfficialQuestions: false,
      difficultyMode: 'random',
      focusEssentialArticles: false,
      proportionalByTopic: false,
    };

    let res: Response;
    try {
      res = await fetch(`${this.TARGET_URL}/api/questions/filtered`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'Vence-Canary-Gate/1.0',
          'x-vence-canary': '1',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        step: 'request',
        errorMessage: `Excepción en la petición: ${msg}`,
        durationMs: Date.now() - startedAt,
      };
    }

    // ─── Paso 3: el gate NO debe retar a un usuario normal ───
    // 403 con el marcador = el gate exigió reto a quien no debía: REGRESIÓN.
    if (res.status === 403 && res.headers.get('x-challenge-required') === '1') {
      return {
        ok: false,
        step: 'gate_false_positive',
        httpStatus: 403,
        errorMessage:
          'El gate anti-scraping exigió verificación humana a un usuario normal ' +
          '(por debajo del umbral). Posible regresión en la policy o el contador Redis.',
        durationMs: Date.now() - startedAt,
      };
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '<no body>');
      return {
        ok: false,
        step: 'request',
        httpStatus: res.status,
        errorMessage: `HTTP ${res.status}: ${text.slice(0, 200)}`,
        durationMs: Date.now() - startedAt,
      };
    }

    // ─── Paso 4: respuesta sana con preguntas ───
    let data: { success?: boolean; questions?: unknown[] };
    try {
      data = await res.json();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        step: 'parse',
        errorMessage: `Respuesta no-JSON: ${msg}`,
        durationMs: Date.now() - startedAt,
      };
    }

    const n = Array.isArray(data.questions) ? data.questions.length : 0;
    if (data.success !== true || n < 1) {
      return {
        ok: false,
        step: 'validate_body',
        errorMessage: `Esperado success=true con preguntas; recibido success=${data.success}, n=${n}`,
        durationMs: Date.now() - startedAt,
      };
    }

    // ─── Paso 5: latencia ───
    const durationMs = Date.now() - startedAt;
    if (durationMs > this.MAX_TOTAL_DURATION_MS) {
      return {
        ok: false,
        step: 'validate_latency',
        errorMessage: `Latencia ${durationMs}ms > umbral ${this.MAX_TOTAL_DURATION_MS}ms`,
        questionsServed: n,
        durationMs,
      };
    }

    return { ok: true, questionsServed: n, durationMs };
  }
}

export type CanaryGateResult =
  | { ok: true; questionsServed: number; durationMs: number }
  | { skipped: true; reason: string; durationMs: number }
  | {
      ok: false;
      step:
        | 'gate_disabled'
        | 'sign_token'
        | 'request'
        | 'gate_false_positive'
        | 'parse'
        | 'validate_body'
        | 'validate_latency';
      httpStatus?: number;
      errorMessage: string;
      questionsServed?: number;
      durationMs: number;
    };
