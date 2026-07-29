// lib/security/harvestSignals.js
//
// Núcleo PURO de clasificación de COSECHA de preguntas (scraping del banco).
//
// EL PUNTO CIEGO QUE CIERRA (auditoría 27/07/2026)
// ------------------------------------------------
// Todo lo que medía consumo se apoyaba en `daily_question_usage.questions_answered`,
// es decir en respuestas GUARDADAS. Pero cosechar un banco de preguntas no requiere
// responder: se cargan y se pasa a la siguiente. Consecuencias medidas en prod:
//
//   · El usuario anferbar987 tuvo el contador diario en **2** el 16/05/2026
//     mientras se le servían **5.495** preguntas.
//   · El detector `curl_scraping` de fraud-sweep, construido sobre ese mismo
//     contador, NO ha disparado ni una vez en toda la vida de la tabla.
//
// Con `daily_questions_served` (rollup duradero de SERVIDAS) la firma se vuelve
// medible: **servidas >> respondidas**. Un opositor real responde casi todo lo que
// se le sirve; un cosechador no responde casi nada.
//
// POR QUÉ ES CommonJS: lo consumen a la vez el sweep (`scripts/fraud-sweep.cjs`,
// CommonJS) y el panel admin (TypeScript). Mismo criterio en los dos lados o
// vuelven a divergir. Mismo patrón que `lib/laws/scopeTitleBoundary.js` y
// `lib/convocatoria/seguimientoUrlSalud.cjs`.

/**
 * Umbrales por defecto. Calibrados con datos reales de julio de 2026:
 * un usuario activo normal ronda las 100-200 preguntas/día y responde
 * la inmensa mayoría de lo que se le sirve.
 */
const DEFAULTS = {
  /** Mínimo de servidas en la ventana para que merezca la pena mirar.
   *  Por debajo, cualquier ratio es ruido estadístico. */
  minServed: 300,
  /** Ratio respondidas/servidas por debajo del cual se considera cosecha.
   *  0,2 = responde menos de 1 de cada 5. El caso anferbar987 dio 0,0004. */
  maxAnswerRatio: 0.2,
  /**
   * Servidas a partir de las cuales una cosecha YA detectada (ratio malo) se
   * considera crítica en vez de alta.
   *
   * ⚠️ AGRAVANTE, NUNCA DISPARADOR. Hubo una versión de este módulo en la que el
   * volumen por sí solo generaba señal (`harvest_volume`), y estaba MAL: los datos
   * reales de julio de 2026 dicen que el usuario más intenso de la plataforma
   * respondió 4.897 preguntas en 30 días —a un 2 % de este umbral— y las servidas
   * siempre son más que las respondidas. Habría marcado como sospechosos justo a
   * los opositores más enganchados, que son los que pagan.
   *
   * El fondo del asunto: quien responde el 97 % de lo que se le sirve NO está
   * cosechando, está estudiando. El volumen sin un ratio malo no prueba nada, y
   * subir el número no arregla el razonamiento. La señal es el RATIO.
   */
  egregiousServed: 5000,
  /**
   * Días DISTINTOS con actividad que hacen falta para opinar sobre un volumen
   * no egregio. Por debajo, el ratio no distingue cosecha de "entré, probé y no
   * volví".
   *
   * CALIBRADO CON LA DISTRIBUCIÓN REAL (29/07/2026), no con razonamiento. De los
   * **29 usuarios** que en 30 días caían bajo el ratio 0,2 con ≥100 servidas:
   *   · 26 estaban en la banda 100-499 servidas, con **1,1 días** de media;
   *   · 19 de los 29 se habían registrado hacía **menos de una semana**;
   *   · y los 3 de volumen alto, mirados uno a uno, eran **`smoke@vence.es`
   *     (nuestra propia cuenta de canarios E2E: 2.600 servidas, 137 respondidas,
   *     2 días)** y dos usuarias free dadas de alta 1 y 2 días antes — una de
   *     ellas ESE MISMO DÍA.
   * O sea: **ninguno de los 29 estaba cosechando.** Las 4 señales que el detector
   * ha producido en su vida (2 el 28/07 por el tope free, 2 el 29/07 por altas
   * nuevas) fueron falsos positivos.
   *
   * Por qué la amplitud y no un `minServed` más alto: el problema no es que 300
   * sea poco, es que **un día no es un patrón**. Cosechar un banco exige VOLVER;
   * probar y abandonar se agota en una sesión. Subir el volumen dejaría fuera al
   * cosechador modesto y seguiría marcando al novato que pide 10 tests de 100.
   */
  minActiveDays: 3,
}

/**
 * Clasifica el comportamiento de UN sujeto en la ventana analizada.
 *
 * @param {object} input
 * @param {number} input.served      Preguntas servidas (daily_questions_served).
 * @param {number} input.answered    Preguntas respondidas REALMENTE (contadas en `test_questions`, NO en
   *   `daily_question_usage`: ese contador solo se incrementa por el camino del
   *   límite diario y los PREMIUM lo esquivan → daría 0 para ellos y todo premium
   *   activo saldría como cosechador).
 * @param {number} [input.pageViews] Eventos page_view en la ventana. Un navegador
 *   real genera muchos; un script, ninguno. Opcional: si no se sabe, no penaliza.
 * @param {boolean} [input.hasDevice] ¿Tiene dispositivo registrado? Sin huella y
 *   sin navegador = cliente sin navegador (curl/python).
 * @param {boolean} [input.answerCapped] ¿Topó su límite diario? Si sí, el ratio no
 *   es interpretable: el tope se lo impusimos nosotros (ver nota abajo).
 * @returns {{kind: string, severity: string, ratio: number, reasons: string[]}|null}
 *   null si no hay señal.
 */
function classifyHarvest(input, opts) {
  const o = Object.assign({}, DEFAULTS, opts || {})
  const served = num(input && input.served)
  const answered = num(input && input.answered)

  // Sin volumen suficiente no se opina. Evita que un usuario con 3 servidas y 0
  // respondidas (ratio 0) genere una señal por un ratio calculado sobre nada.
  if (served < o.minServed) return null

  // Si TOPÓ su límite diario, el ratio bajo lo causamos NOSOTROS, no él: con 25/día
  // un free que arme un test de 100 tiene ratio <= 0,25 por construcción. Caso real
  // (28/07): dos altas nuevas marcadas con 300/27 y 304/34, ambas con el contador
  // en 25. Contrapartida asumida: un cosechador free que conteste hasta su tope
  // queda exento — se prefiere eso a acusar a usuarios legítimos.
  if (input && input.answerCapped === true) return null

  // AMPLITUD TEMPORAL. Un volumen que se agota en una o dos sesiones es el perfil
  // del que entra, prueba y no vuelve — medido: los 29 sujetos bajo el ratio en 30
  // días tenían 1-2 días de actividad, y entre ellos estaba nuestra propia cuenta
  // de smoke tests. Cosechar exige volver, así que por debajo de `minActiveDays`
  // no se opina... salvo que el volumen sea egregio: 5.000 servidas en dos días no
  // las explica ningún novato, y ahí la amplitud no debe servir de coartada (el
  // caso `anferbar987`, 5.495 servidas, sigue marcando aunque fuera en un día).
  // Si no se sabe (`activeDays` ausente), no penaliza — igual que `pageViews`.
  const activeDays = num(input && input.activeDays)
  if (activeDays > 0 && activeDays < o.minActiveDays && served < o.egregiousServed) {
    return null
  }

  const ratio = served > 0 ? answered / served : 0
  const reasons = []

  const sinNavegador =
    input && input.hasDevice === false && num(input.pageViews) === 0

  if (ratio < o.maxAnswerRatio) {
    reasons.push(`ratio_respuesta_${ratio.toFixed(3)}`)
    reasons.push(`servidas_${served}_respondidas_${answered}`)
    if (sinNavegador) reasons.push('sin_dispositivo_ni_navegador')
    // Sin navegador Y sin responder = script puro; con navegador puede ser
    // automatización sobre navegador real (Playwright) o un patrón de uso raro.
    const severity = sinNavegador || served >= o.egregiousServed ? 'critical' : 'high'
    return { kind: sinNavegador ? 'curl_scraping' : 'harvest_no_answer', severity, ratio, reasons }
  }

  // Ratio sano = está estudiando, por mucho volumen que tenga. No se opina.
  // (Ver la nota de `egregiousServed`: aquí HUBO un `harvest_volume` que marcaba
  // por volumen suelto y habría señalado a los usuarios de pago más activos.)
  return null
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

module.exports = { classifyHarvest, DEFAULTS }
