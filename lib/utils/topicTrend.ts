// lib/utils/topicTrend.ts
// Helpers puros para la métrica de tendencia (flechitas ▲/▼) del temario y para
// el modal informativo "¿qué significan estos números?".
//
// La lógica vive fuera de los componentes para poder testearla sin montar React
// (mismo patrón que los helpers puros de DailyGoalBanner).

/**
 * Visibilidad efectiva de las flechitas de tendencia a partir de la preferencia
 * de cuenta `user_profiles.show_topic_trend`. Default = visible: sólo se ocultan
 * si el flag es explícitamente `false` (null/undefined = aún no cargado o sin
 * preferencia → visibles). El % de acierto y su barra NO se ven afectados.
 */
export function isTopicTrendVisible(flag: boolean | null | undefined): boolean {
  return flag !== false
}

/** Valor siguiente al pulsar el toggle (invierte el estado efectivo actual). */
export function nextTopicTrendVisible(currentEffective: boolean): boolean {
  return !currentEffective
}

export interface TopicProgressEntry {
  titulo: string
  accuracy: number
  accuracy30d: number | null
  questionsAnswered: number
}

export interface TrendSummary {
  /** Nº de temas con al menos una pregunta respondida. */
  temasPracticados: number
  /** Total de preguntas respondidas sumando los temas practicados. */
  totalRespondidas: number
  /** Media de acierto ponderada por preguntas respondidas (0-100). */
  mediaAciertos: number
  /** Tema con mayor % de acierto (null si no hay datos). */
  mejorTema: { titulo: string; accuracy: number } | null
  /** Tema practicado con menor % de acierto (null si no hay datos). */
  temaReforzar: { titulo: string; accuracy: number } | null
  /** Reparto de tendencia en los últimos 30 días (sólo temas con dato 30d). */
  tendencia: { mejorando: number; empeorando: number; estable: number }
}

/**
 * Resume el progreso del usuario en los temas de una oposición para el modal
 * informativo. Sólo cuenta temas con preguntas respondidas. Pura: sin DOM ni red.
 */
export function summarizeTopicProgress(entries: TopicProgressEntry[]): TrendSummary {
  const practicados = entries.filter(e => e.questionsAnswered > 0)

  const totalRespondidas = practicados.reduce((acc, e) => acc + e.questionsAnswered, 0)
  const mediaAciertos = totalRespondidas > 0
    ? Math.round(
        practicados.reduce((acc, e) => acc + e.accuracy * e.questionsAnswered, 0) / totalRespondidas
      )
    : 0

  let mejorTema: TrendSummary['mejorTema'] = null
  let temaReforzar: TrendSummary['temaReforzar'] = null
  for (const e of practicados) {
    if (!mejorTema || e.accuracy > mejorTema.accuracy) mejorTema = { titulo: e.titulo, accuracy: e.accuracy }
    if (!temaReforzar || e.accuracy < temaReforzar.accuracy) temaReforzar = { titulo: e.titulo, accuracy: e.accuracy }
  }

  const tendencia = { mejorando: 0, empeorando: 0, estable: 0 }
  for (const e of practicados) {
    if (e.accuracy30d == null) continue
    if (e.accuracy30d > e.accuracy) tendencia.mejorando++
    else if (e.accuracy30d < e.accuracy) tendencia.empeorando++
    else tendencia.estable++
  }

  return { temasPracticados: practicados.length, totalRespondidas, mediaAciertos, mejorTema, temaReforzar, tendencia }
}
