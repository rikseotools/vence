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

    // Veredicto del gate para NUESTRA identidad, que decide si la sonda de abajo puede ir SIN
    // exención (T-280). `null` = no se pudo saber.
    let sujetoSaturado: boolean | null = null;
    let gateServidas: number | undefined;
    let gateUmbral: number | undefined;

    // ─── Paso 0: el gate debe estar ENCENDIDO ───────────────────────────
    // Verificación POSITIVA: un gate apagado parece idéntico a uno funcionando
    // desde el camino feliz (cargar va bien igual). Por eso preguntamos el estado
    // efectivo. Bug 03/06: site key no horneada → enabled=false sin que nada avisara.
    try {
      // Se pide de paso el veredicto para nuestro sujeto: una sola petición, sin servir preguntas
      // y sin gastar cuota. Ver el comentario largo del endpoint (T-280).
      const statusRes = await fetch(
        `${this.TARGET_URL}/api/security/captcha/status?subject=${encodeURIComponent(userId)}`,
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
          gate?: { served?: number; threshold?: number; wouldChallenge?: boolean }
        }
        if (st.gate && typeof st.gate.wouldChallenge === 'boolean') {
          sujetoSaturado = st.gate.wouldChallenge
          gateServidas = st.gate.served
          gateUmbral = st.gate.threshold
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

    // ⚠️ AQUÍ ESTABA EL AGUJERO (T-280, arreglado 30/07/2026): esta petición mandaba SIEMPRE la
    // cabecera de exención, así que el Paso 3 —«el gate NO debe retar a un usuario normal»— medía
    // a alguien EXENTO y pasaba siempre, incluso si el gate hubiera empezado a retar a todo el
    // mundo, que es el fallo que más duele (usuarios reales sin poder cargar preguntas).
    //
    // No basta con quitar la exención: está medido que el usuario smoke acumula volumen de otras
    // sondas (2.220 servidas el 27/07, 380 el 29/07, umbral 500), así que un día cargado daría
    // rojo sin avería. Por eso se pregunta primero (Paso 0) y solo se va SIN exención cuando
    // nuestro propio contador está por debajo del umbral. Si está saturado, la sonda sigue
    // haciéndose exenta —el resto de comprobaciones valen igual— y la aserción del gate se marca
    // como NO comprobada, que es lo honesto: mejor un «hoy no lo sé» que un verde inventado.
    const sondaReal = sujetoSaturado === false;
    const gateAssertion: CanaryGateAssertion = sondaReal
      ? 'real'
      : sujetoSaturado === true
        ? 'omitida_sujeto_saturado'
        : 'omitida_veredicto_no_disponible';
    const secretoCanary = process.env.CANARY_SECRET ?? process.env.CRON_SECRET ?? '';
    // T-381 (07/08/2026): la sonda REAL sigue sin la cabecera que exime del reto (es justo lo
    // que prueba: que el gate no le retaría), pero eso la dejaba contándose en
    // `daily_questions_served` como tráfico de un opositor de verdad (numQuestions=1 por
    // sonda, sin respuesta jamás — la firma exacta de cosecha, medida por
    // `npm run canary:served-rollup`). La cabecera de MÉTRICAS demuestra que es este canario
    // sin demostrar (ni fingir) que no haga falta retarlo — ver lib/api/syntheticTrust.ts.
    const exencion: Record<string, string> = sondaReal
      ? { 'x-vence-canary-metrics-secret': secretoCanary }
      : { 'x-vence-canary-secret': secretoCanary };

    let res: Response;
    try {
      res = await fetch(`${this.TARGET_URL}/api/questions/filtered`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'Vence-Canary-Gate/1.0',
          // `x-vence-canary` NO exime de nada (solo evita ensuciar el log de errores de usuario);
          // la exención es la cabecera con secreto de abajo, y solo va cuando toca.
          'x-vence-canary': '1',
          ...exencion,
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
          `(servidas ${gateServidas ?? '?'} de ${gateUmbral ?? '?'}). ` +
          'Posible regresión en la policy o el contador Redis.',
        gateAssertion,
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

    // `gateAssertion` viaja en el resultado a propósito: sin él, un verde de este canary no dice
    // si la comprobación que importa se hizo o se omitió por saturación. Un verde que no distingue
    // esas dos cosas es justo lo que esta tarea vino a arreglar.
    return { ok: true, questionsServed: n, durationMs, gateAssertion, gateServidas, gateUmbral };
  }
}

/** ¿Se comprobó de verdad que el gate no reta a un usuario normal, o no se pudo? */
export type CanaryGateAssertion =
  | 'real'
  | 'omitida_sujeto_saturado'
  | 'omitida_veredicto_no_disponible';

export type CanaryGateResult =
  | {
      ok: true;
      questionsServed: number;
      durationMs: number;
      gateAssertion: CanaryGateAssertion;
      gateServidas?: number;
      gateUmbral?: number;
    }
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
      gateAssertion?: CanaryGateAssertion;
      durationMs: number;
    };
