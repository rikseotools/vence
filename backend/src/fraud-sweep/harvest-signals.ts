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
  /**
   * ¿El usuario TOPÓ su límite diario en la ventana? Si sí, el ratio NO es
   * interpretable y no se opina.
   *
   * Descubierto triando las 2 primeras señales reales (28/07/2026): dos altas
   * nuevas salieron marcadas con 300/27 y 304/34. Ninguna cosechaba — las dos
   * tenían el contador diario en 25, el TOPE del plan free. Armaron tests de ~100
   * preguntas y solo se les permitió contestar 25. Con ese tope, cualquier free
   * que monte un test grande tiene un ratio <= 0,25 POR CONSTRUCCIÓN, pegadito al
   * umbral de 0,2: falso positivo estructural, y la causa la ponemos nosotros.
   *
   * Es el mismo defecto de forma que el de premium del 27/07 (allí el contador no
   * se incrementaba; aquí lo topa el límite): la maquinaria del límite diario
   * distorsiona el denominador.
   *
   * ⚠️ Contrapartida asumida: un cosechador con cuenta free que conteste hasta su
   * tope quedaría exento. Se acepta a cambio de no acusar a usuarios legítimos —
   * un detector que da falsas alarmas se deja de mirar, que es justo el estado del
   * que venimos (ver T-185). Anotado en T-179 para revisarlo con distribución real.
   */
  answerCapped?: boolean;
  /**
   * Días DISTINTOS con actividad en la ventana. Ver `minActiveDays` en
   * `HARVEST_DEFAULTS`: por debajo del mínimo, el ratio no distingue una cosecha
   * de un "entré, probé y no volví". Ausente = no penaliza.
   */
  activeDays?: number;
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
  minActiveDays?: number;
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
  /**
   * Días DISTINTOS con actividad exigidos para opinar sobre un volumen no
   * egregio. CALIBRADO CON LA DISTRIBUCIÓN REAL (29/07/2026): de los 29 usuarios
   * que en 30 días caían bajo el ratio con >=100 servidas, 26 estaban en la banda
   * 100-499 con 1,1 dias de media, 19 se habian registrado hacia menos de una
   * semana, y los 3 de volumen alto eran `smoke@vence.es` —nuestra propia cuenta
   * de canarios E2E— y dos altas de 1 y 2 dias antes. Ninguno cosechaba.
   *
   * El problema no era que 300 fuese poco: es que UN DIA NO ES UN PATRON.
   * Cosechar exige volver; probar y abandonar se agota en una sesion.
   */
  minActiveDays: 3,
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

  // Topó su límite diario → el ratio bajo lo causamos nosotros. Ver `answerCapped`.
  if (input?.answerCapped === true) return null;

  // AMPLITUD TEMPORAL — ver `minActiveDays`. Por debajo del minimo no se opina,
  // SALVO volumen egregio: 5.000 servidas no las explica ningun novato, y ahi la
  // amplitud no puede servir de coartada (el caso `anferbar987`, 5.495 servidas,
  // sigue marcando aunque fuera en un solo dia).
  const activeDays = num(input?.activeDays);
  if (activeDays > 0 && activeDays < o.minActiveDays && served < o.egregiousServed) {
    return null;
  }

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
