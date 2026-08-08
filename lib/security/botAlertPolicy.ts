// lib/security/botAlertPolicy.ts
//
// Decide si una detección de bot MERECE una alerta, y con qué severidad.
//
// EL PROBLEMA QUE RESUELVE (T-185, medido el 28/07/2026 sobre las ~400 alertas
// acumuladas): el detector creaba una `fraud_alert` por CADA detección, con la
// confianza que fuera. Resultado:
//
//   · 261 alertas con la evidencia EXACTA `["no_plugins","botd:headless_chrome"]`,
//     que el propio código documenta como falso positivo desde el 15/04 (por eso
//     subieron el umbral de HIGH a 90) — y aun así se seguía creando la alerta.
//   · 255 de ~400 con score < 90, o sea POR DEBAJO del nivel en el que el sistema
//     está dispuesto a actuar. Creábamos alertas con una confianza en la que no
//     confiamos, y luego nadie las miraba.
//   · 5 de 5 revisadas a fondo (27 y 28/07) resultaron falsos positivos.
//
// El coste no es tener alertas de más: es que **500 alertas rancias hacen que el
// panel se deje de mirar**, y ahí es donde aparecen las señales buenas. Se ha
// pagado ya — el barrido antifraude estuvo 7 noches muerto emitiendo error cada
// noche sin que nadie actuara.
//
// PRINCIPIO: alertar solo con la confianza con la que actuaríamos. Lo que queda
// por debajo no se pierde — se emite como evento de observabilidad para ver
// tendencia, pero no ensucia la cola de revisión humana.
//
// SEGUNDA VUELTA (T-303, medido el 06/08/2026): subir el umbral a 90 no bastó. Las
// cinco alertas dismissed de este ficha (29-30/07, 5 usuarias reales con 25-199
// respuestas) suman EXACTAMENTE 90 con solo 3 señales: `no_plugins` (0 puntos desde
// el 15/04) + `zero_dimensions` (+30) + `botd:headless_chrome` (+60) — justo el
// umbral, así que subirlo más las habría dejado fuera pero también habría dejado
// pasar automatización real con el mismo total. El patrón (Chrome/Android,
// `outerWidth`/`outerHeight` en 0) encaja con los navegadores EMBEBIDOS de Android
// (el WebView que abre Instagram/Facebook/Gmail al pinchar un enlace): comparten
// con un headless real la falta de chrome UI y ciertas APIs, y es EXACTAMENTE por
// donde entra la publicidad — down-priorizar esta señal existe para acertar en el
// tráfico bueno.
//
// SOSPECHO que esa es la causa de fondo (encaja con el patrón técnico y con que
// venga siempre por publicidad/redes), pero NO lo he podido demostrar con datos:
// `fraud_alerts` tiene RLS activo y CERO políticas para `vence_lector` (mismo
// mecanismo ya diagnosticado en T-573/T-574), así que el `evidence`/`userAgent` de
// cada alerta real es ilegible para un trabajador de la flota — devuelve 0 filas
// SIN error, indistinguible de "no hay alertas". Confirmarlo del todo requeriría la
// migración de política que T-573 ya dejó pendiente (fuera del alcance de esto: esa
// tabla probablemente se queda bloqueada a propósito, `details.ip` es PII).
//
// LO QUE SÍ SE PUDO MEDIR, y es la base del arreglo: `scraping_force_challenge_set`
// (que dispara con el MISMO score>=90) SÍ es legible, y da una muestra MÁS ANCHA que
// las 5 del ficha — 10 usuarias distintas a score exacto 90 entre el 12/07 y el
// 06/08/2026, TODAS sin una sola fila en `test_questions` (0 respuestas guardadas,
// nunca). Pero al menos UNA de esas diez (`f7716a15…`, 11 días de actividad, 08/2026)
// tiene el patrón contrario y mucho más grave: `daily_questions_served` sube a ~800
// preguntas SERVIDAS en esos 11 días y `daily_question_usage` está VACÍO — la firma
// exacta de `harvest_no_answer` (cosecha real, con navegador, sin responder nunca).
// O sea: la muestra ampliada NO confirma "todo son WebViews" — mezcla el falso
// positivo del ficha con al menos un caso de cosecha real, y sin poder leer
// `evidence` no se puede separar uno de otro por señal técnica.
//
// EL ARREGLO, por eso, NO es "esta combinación de evidencia nunca alerta" (eso
// habría dejado pasar a `f7716a15…`): es el discriminante que la propia ficha ya
// proponía y que separa los dos casos limpio — **una cuenta que ha respondido de
// verdad no es un bot, aunque su huella lo parezca; una cuenta servida-pero-nunca-
// respondida sigue alertando igual que hoy**, y la automatización DURA (webdriver,
// framework, puppeteer) nunca se exime por actividad: si además responde de verdad,
// es un caso más serio (granjeo con navegador controlado), no uno más benigno.

/** Umbral a partir del cual una detección es lo bastante firme para actuar.
 *  Es el MISMO que dispara el reto forzado: no tiene sentido abrir expediente por
 *  algo que no nos parece suficiente ni para pedir un captcha. */
export const BOT_ALERT_MIN_SCORE = 90

/** Días que se respeta un veredicto humano antes de volver a alertar del mismo
 *  sujeto y tipo. Sin esto el detector reincide: hay usuarias legítimas con 9 y 12
 *  alertas acumuladas del mismo patrón ya descartado. */
export const ABSOLVED_TTL_DAYS = 30

/**
 * Evidencia INEQUÍVOCA de automatización (T-303, 06/08/2026): un `navigator.webdriver`
 * o un framework de automatización detectado en el propio `window` no tiene explicación
 * de navegador legítimo — a diferencia de `botd:headless_chrome`/`zero_dimensions`, que
 * SÍ la tienen (ver comentario grande más abajo). Si aparece cualquiera de estos, la
 * cuenta NUNCA se exenta por actividad real: un agente automatizado que además rellena
 * respuestas de verdad (granjeo de rachas/recompensas) es un caso MÁS grave, no menos.
 */
const HARD_AUTOMATION_EVIDENCE = new Set(['webdriver_detected', 'automation_framework', 'puppeteer_detected'])

function hasHardAutomationEvidence(evidence: string[] | null | undefined): boolean {
  return Array.isArray(evidence) && evidence.some((e) => HARD_AUTOMATION_EVIDENCE.has(e))
}

/**
 * Respuestas reales guardadas a partir de las cuales una cuenta deja de tratarse como
 * "solo fingerprint" para `bot_detected` (T-303). Medido: las dos usuarias reales que
 * originaron esta ficha tenían 25 y 199 respuestas cuando se las marcó; un cazador de
 * preguntas real medido de paso (11 días, ~800 preguntas SERVIDAS, `daily_question_usage`
 * vacío — el patrón exacto de `harvest_no_answer`) tenía CERO respuestas guardadas. El
 * hueco entre 0 y 25 es amplio: 5 es un cuerpo de examen real pequeño, muy por debajo de
 * lo que cualquier caso medido de humana real trae, y muy por encima de lo que cuesta
 * fabricar una respuesta señuelo aislada para "blanquear" futuras detecciones (que además
 * seguiría sin explicar por qué luego no hay ni una más).
 */
export const MIN_REAL_ANSWERS_TO_TRUST = 5

/** Señales de comportamiento REALES, recalculadas en servidor sobre datos
 *  confirmados — nunca las que manda el cliente. */
export interface ServerBehaviour {
  /** Respuestas confirmadas en la ventana. */
  answers: number
  /** Segundos por pregunta (mediana). */
  medianSeconds: number
  /** Acierto 0..1. */
  accuracy: number
}

export interface BotAlertInput {
  alertType: string
  /** Score que declara el cliente (botScore o behaviorScore). */
  score: number
  /** ¿Este sujeto tuvo una alerta del mismo tipo DESCARTADA hace poco? */
  recentlyDismissed?: boolean
  /** Solo para `suspicious_behavior`: lo que dice la BD, no el cliente. */
  server?: ServerBehaviour | null
  /** Solo para `bot_detected`: el `evidence` que mandó el cliente (huella.js). */
  evidence?: string[] | null
  /** Solo para `bot_detected`: respuestas REALES guardadas en servidor (nunca del
   *  cliente). `null`/`undefined` = no se pudo consultar → no cambia el veredicto
   *  de antes (fail-safe: preferible seguir alertando a exentar sin haber mirado). */
  realAnswers?: number | null
}

export interface BotAlertDecision {
  /** ¿Se crea `fraud_alert`? */
  createAlert: boolean
  /** ¿Se marca al sujeto para reto forzado? */
  forceChallenge: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
  /** Motivo legible — va al evento de observabilidad cuando NO se alerta. */
  reason: string
}

function severityFor(score: number): BotAlertDecision['severity'] {
  if (score >= 120) return 'critical'
  if (score >= 90) return 'high'
  if (score >= 50) return 'medium'
  return 'low'
}

/**
 * Umbrales de comportamiento para hablar de bot con datos de servidor.
 *
 * ⚠️ Se exige RAPIDEZ, no lentitud. La regla anterior disparaba con "acierto bajo
 * + N respuestas" y por eso marcaba a opositores agobiados: los casos reales
 * tenían medianas de 20-31 SEGUNDOS por pregunta. Un bot no tarda medio minuto.
 */
export const BEHAVIOUR_LIMITS = {
  minAnswers: 20,
  /** Por encima de esto no es un bot, es una persona pensando. */
  maxMedianSeconds: 3,
  /** Un bot que responde al azar ronda 0,25 con 4 opciones. */
  maxAccuracy: 0.35,
}

/**
 * Decide. Puro y total: nunca lanza, nunca lee entorno ni BD.
 */
export function decideBotAlert(input: BotAlertInput): BotAlertDecision {
  const score = Number.isFinite(input?.score) ? Number(input.score) : 0
  const severity = severityFor(score)

  // Un veredicto humano reciente manda sobre el detector. Reincidir sobre alguien
  // ya absuelto es lo que produjo 9 y 12 alertas sobre usuarias legítimas.
  if (input?.recentlyDismissed) {
    return { createAlert: false, forceChallenge: false, severity, reason: 'absuelto_recientemente' }
  }

  if (input?.alertType === 'suspicious_behavior') {
    const s = input.server
    // Sin datos de servidor NO se alerta: la versión anterior se creía el
    // `correctRate` del cliente, calculado sobre respuestas aún sin guardar — un
    // caso real declaró 0% cuando la BD decía 28%.
    if (!s) {
      return { createAlert: false, forceChallenge: false, severity, reason: 'sin_datos_de_servidor' }
    }
    const bastantes = s.answers >= BEHAVIOUR_LIMITS.minAnswers
    const rapido = s.medianSeconds >= 0 && s.medianSeconds <= BEHAVIOUR_LIMITS.maxMedianSeconds
    const fallaMucho = s.accuracy <= BEHAVIOUR_LIMITS.maxAccuracy
    if (bastantes && rapido && fallaMucho) {
      return { createAlert: true, forceChallenge: true, severity: 'high', reason: 'comportamiento_confirmado_en_servidor' }
    }
    return {
      createAlert: false,
      forceChallenge: false,
      severity,
      reason: !bastantes ? 'pocas_respuestas' : !rapido ? `mediana_${s.medianSeconds}s_demasiado_lenta_para_bot` : 'acierto_demasiado_alto',
    }
  }

  // bot_detected (huella de automatización). Solo se abre expediente con la
  // confianza con la que además retaríamos.
  if (score >= BOT_ALERT_MIN_SCORE) {
    // T-303: la automatización DURA nunca se exime por actividad — si además
    // responde de verdad es un caso MÁS grave (navegador controlado granjeando
    // respuestas reales), no uno más benigno. Se exige conocer AMBOS datos nuevos
    // (evidencia Y respuestas reales) para eximir — un llamador antiguo que solo
    // manda uno de los dos se queda con el comportamiento de siempre, nunca con uno
    // nuevo sin haberlo pedido.
    const evidenciaConocida = Array.isArray(input.evidence)
    const dura = hasHardAutomationEvidence(input.evidence)
    const respuestasReales = Number.isFinite(input?.realAnswers) ? Number(input.realAnswers) : null
    if (evidenciaConocida && !dura && respuestasReales !== null && respuestasReales >= MIN_REAL_ANSWERS_TO_TRUST) {
      return { createAlert: false, forceChallenge: false, severity, reason: `actividad_real_confirmada_${respuestasReales}_respuestas` }
    }
    return { createAlert: true, forceChallenge: true, severity, reason: 'huella_de_automatizacion_firme' }
  }
  return { createAlert: false, forceChallenge: false, severity, reason: `score_${score}_bajo_umbral_${BOT_ALERT_MIN_SCORE}` }
}

/**
 * Limpia una serie de tiempos de respuesta del cliente y devuelve su mediana en
 * SEGUNDOS. Descarta los valores imposibles.
 *
 * Hace falta porque la instrumentación produce basura: en un caso real llegó un
 * `-273399` ms. Un tiempo negativo significa que se restan relojes que no son
 * comparables, y cualquier media que lo incluya no vale nada.
 */
export function medianSecondsFrom(timesMs: unknown): number | null {
  if (!Array.isArray(timesMs)) return null
  const limpios = timesMs
    .map((t) => Number(t))
    .filter((t) => Number.isFinite(t) && t >= 0 && t <= 30 * 60 * 1000)
    .sort((a, b) => a - b)
  if (!limpios.length) return null
  const mitad = Math.floor(limpios.length / 2)
  const ms = limpios.length % 2 ? limpios[mitad] : (limpios[mitad - 1] + limpios[mitad]) / 2
  return Math.round(ms / 1000)
}
