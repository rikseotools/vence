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
}

/**
 * Clasifica el comportamiento de UN sujeto en la ventana analizada.
 *
 * @param {object} input
 * @param {number} input.served      Preguntas servidas (daily_questions_served).
 * @param {number} input.answered    Preguntas respondidas (daily_question_usage).
 * @param {number} [input.pageViews] Eventos page_view en la ventana. Un navegador
 *   real genera muchos; un script, ninguno. Opcional: si no se sabe, no penaliza.
 * @param {boolean} [input.hasDevice] ¿Tiene dispositivo registrado? Sin huella y
 *   sin navegador = cliente sin navegador (curl/python).
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
