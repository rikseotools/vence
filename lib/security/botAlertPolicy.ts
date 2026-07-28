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

/** Umbral a partir del cual una detección es lo bastante firme para actuar.
 *  Es el MISMO que dispara el reto forzado: no tiene sentido abrir expediente por
 *  algo que no nos parece suficiente ni para pedir un captcha. */
export const BOT_ALERT_MIN_SCORE = 90

/** Días que se respeta un veredicto humano antes de volver a alertar del mismo
 *  sujeto y tipo. Sin esto el detector reincide: hay usuarias legítimas con 9 y 12
 *  alertas acumuladas del mismo patrón ya descartado. */
export const ABSOLVED_TTL_DAYS = 30

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
