/**
 * MIRROR del núcleo de clasificación de COSECHA de preguntas.
 *
 * ⚠️ ESTO ES UN ESPEJO, NO LA FUENTE. El original vive en
 * `lib/security/harvestSignals.js` (raíz del repo) y lo consumen el panel admin y
 * el gemelo CLI `scripts/fraud-sweep.cjs`. El backend NestJS compila con
 * `rootDir: src`, así que NO puede importar de la raíz — la misma limitación que
 * ya obligó a replicar el clasificador de errores de LLM en `observability/llm-usage.ts`.
 *
 * LA PARIDAD LA GARANTIZA UN TEST, no la buena voluntad:
 * `__tests__/backend/fraudSweepHarvestParity.test.ts` pasa la MISMA tabla de casos
 * por los dos y exige veredictos idénticos. Si tocas uno sin tocar el otro, CI lo
 * canta. Un espejo desincronizado es peor que no tenerlo: el mismo usuario se
 * clasificaría distinto según quién mire.
 *
 * POR QUÉ EXISTE EL DETECTOR (auditoría 27/07/2026): el D4 anterior medía el
 * volumen con `daily_question_usage` (respuestas GUARDADAS) y por eso era ciego al
 * modo real de scraping — cosechar no requiere responder. Medido en prod: el
 * usuario `anferbar987` tuvo ese contador en 2 el 16/05 mientras se le servían
 * 5.495 preguntas, y el detector no disparó ni una vez en toda su vida.
 */

export interface HarvestInput {
  /** Preguntas SERVIDAS en la ventana (daily_questions_served). */
  served: number;
  /**
   * Preguntas RESPONDIDAS realmente, contadas en `test_questions`.
   * NO desde `daily_question_usage`: ese contador solo se incrementa por el camino
   * del límite diario y los PREMIUM lo esquivan (77 premium con 5.598 respuestas y
   * contador 0 el 27/07) → usarlo marcaba como cosechador a todo premium activo.
   */
  answered: number;
  /** page_view en la ventana. Un navegador real genera muchos; un script, ninguno. */
  pageViews?: number;
  /** ¿Tiene dispositivo registrado? */
  hasDevice?: boolean;
}

export interface HarvestVerdict {
  kind: string;
  severity: string;
  ratio: number;
  reasons: string[];
}

export interface HarvestOpts {
  minServed?: number;
  maxAnswerRatio?: number;
  egregiousServed?: number;
}

/** Mismos valores que `DEFAULTS` del original. El test de paridad los compara. */
export const HARVEST_DEFAULTS = {
  minServed: 300,
  maxAnswerRatio: 0.2,
  /**
   * AGRAVANTE, NUNCA DISPARADOR. Hubo un `harvest_volume` que marcaba por volumen
   * suelto y se quitó el mismo día: el usuario real más intenso respondió 4.897
   * preguntas en 30 días, a un 2 % de este umbral. Quien responde el 97 % de lo
   * que se le sirve no está cosechando, está estudiando. La señal es el RATIO.
   */
  egregiousServed: 5000,
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Clasifica a UN sujeto. Puro y total: nunca lanza, nunca lee entorno. */
export function classifyHarvest(
  input: HarvestInput | null | undefined,
  opts?: HarvestOpts,
): HarvestVerdict | null {
  const o = { ...HARVEST_DEFAULTS, ...(opts || {}) };
  const served = num(input?.served);
  const answered = num(input?.answered);

  // Sin volumen suficiente no se opina: evita marcar al usuario que cargó un test
  // y lleva dos preguntas contestadas (ratio bajo del todo legítimo).
  if (served < o.minServed) return null;

  const ratio = served > 0 ? answered / served : 0;
  const reasons: string[] = [];

  const sinNavegador =
    input?.hasDevice === false && num(input?.pageViews) === 0;

  if (ratio < o.maxAnswerRatio) {
    reasons.push(`ratio_respuesta_${ratio.toFixed(3)}`);
    reasons.push(`servidas_${served}_respondidas_${answered}`);
    if (sinNavegador) reasons.push('sin_dispositivo_ni_navegador');
    const severity =
      sinNavegador || served >= o.egregiousServed ? 'critical' : 'high';
    return {
      kind: sinNavegador ? 'curl_scraping' : 'harvest_no_answer',
      severity,
      ratio,
      reasons,
    };
  }

  // Ratio sano = está estudiando, por mucho volumen que tenga.
  return null;
}
