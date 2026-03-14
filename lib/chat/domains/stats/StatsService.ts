// lib/chat/domains/stats/StatsService.ts
// Servicio principal de estadísticas

import { getExamStats, getUserStats } from './queries'
import { logger } from '../../shared/logger'
import type { ChatContext } from '../../core/types'
import type {
  ExamStatsResult,
  UserStatsResult,
  TemporalFilter,
  StatsQueryType,
} from './schemas'

// ============================================
// DETECCIÓN DE CONSULTAS
// ============================================

/**
 * Detecta si el mensaje es una consulta sobre estadísticas de exámenes oficiales
 */
export function isExamStatsQuery(message: string): boolean {
  const msgLower = message.toLowerCase()

  // Patrones que indican pregunta sobre qué cae en exámenes:
  // - "artículos que caen/han caído/aparecen en examen"
  // - "examen oficial" + artículos/preguntas
  // - "qué cae/preguntas caen/aparece en examen"
  // - "estadísticas de examen"
  // - "más preguntado"
  // - "qué preguntas suelen caer" (sin mencionar examen explícitamente)
  // - "qué tipo de preguntas caen/suelen"
  // - "qué suele caer de la ley X"

  const patterns = [
    /art[ií]culos?.*(ca[ií]do|caen|aparec|pregunta|examen|oficial)/i,
    /examen.*oficial.*(art|pregunta)/i,
    /qu[eé].*preguntas?.*(cae|caen|aparec|suele)/i,
    /qu[eé].*(cae|caen|suele).*examen/i,
    /estad[ií]stica.*examen/i,
    /m[aá]s preguntad/i,
    /preguntas?.*caen.*examen/i,
    /(cae|caen).*en.*examen/i,
    /qu[eé]\s*(tipo|clase)\s*(de)?\s*preguntas/i,
    /preguntas?\s*suele|suele.*caer/i,
  ]

  return patterns.some(p => p.test(msgLower))
}

/**
 * Detecta si el mensaje es una consulta sobre progreso/estadísticas del usuario
 */
export function isUserStatsQuery(message: string): boolean {
  const msgLower = message.toLowerCase()

  // Patrones que indican pregunta sobre progreso personal:
  // - "mis fallos/errores/áreas débiles"
  // - "qué he fallado / dónde fallo"
  // - "cómo voy" (con o sin comparación semanal)
  // - "en qué debo mejorar/estudiar/repasar"
  // - "qué artículos/temas debería repasar"
  // - "debería repasar urgentemente"
  // - "necesito mejorar/repasar"
  // - "test de fallos/errores/repaso"
  // - "fallos/errores + período temporal"

  const patterns = [
    /mi[s]?\s*(progreso|estad[ií]stica|resultado|fallo|error|acierto|rendimiento|punto.*d[eé]bil|[aá]rea.*d[eé]bil)/i,
    /qu[eé].*(he\s*fallado|fallos?\s*m[aá]s|me\s*cuesta)/i, // fallo/fallos más
    /d[oó]?nde\s*(fallo|tengo.*problema)/i, // donde/dónde
    /c[oó]mo\s*voy/i, // Detecta "cómo voy" con o sin contexto adicional
    /en\s*qu[eé]\s*debo\s*(mejorar|estudiar|repasar)/i,
    /qu[eé]\s*(art[ií]culos?|temas?|leyes?|partes?)\s*(deber[ií]a|tengo\s*que|necesito)\s*repasar/i,
    /(deber[ií]a|necesito|tengo\s*que)\s*repasar\s*(urgente|m[aá]s)?/i,
    /repasar\s*urgente/i,
    /test\s*(de\s*)?(mis\s*)?(fallo|error|repaso)/i,
    /practicar\s*(mis\s*)?(fallo|error)/i,
    /(fallo|error)s?\s*(de\s*)?(esta\s*semana|este\s*mes|hoy|ayer|[uú]ltimos?\s*\d+\s*d[ií]as?|desde\s*siempre|hist[oó]rico)/i,
    // Nuevos patrones más flexibles para preguntas sobre fallos
    /en\s*qu[eé]\s*(art[ií]culos?|temas?)\s*fallos?\s*m[aá]s/i, // "en que articulos fallo/fallos mas"
    /(art[ií]culos?|temas?)\s*(que|donde|en\s*los?\s*que)\s*fallos?\s*m[aá]s/i, // "articulos que fallo mas"
    /fallos?\s*m[aá]s/i, // Patrón general: cualquier mención de "fallo/fallos más"
  ]

  return patterns.some(p => p.test(msgLower))
}

/**
 * Detecta si el usuario quiere empezar un test de puntos débiles
 * (responde afirmativamente a la propuesta o lo pide directamente)
 */
export function isWeakPointsTestRequest(message: string): boolean {
  const msgLower = message.toLowerCase().trim()

  // Respuestas afirmativas simples
  const affirmativePatterns = [
    /^s[ií]$/i,
    /^s[ií]\s*(por\s*favor|porfavor|porfa)?$/i,
    /^vale$/i,
    /^ok(ay)?$/i,
    /^dale$/i,
    /^venga$/i,
    /^claro$/i,
    /^adelante$/i,
    /^haz(lo|me\s*el\s*test)?$/i,
    /^prep[aá]ra(me)?(\s*(el|un)\s*test)?$/i,
  ]

  // Peticiones directas de test de puntos débiles
  const directPatterns = [
    /quiero\s*(el|un)\s*test\s*(de\s*)?(puntos?\s*d[eé]biles?|fallos?|errores?)/i,
    /prep[aá]ra(me)?\s*(el|un)\s*test\s*(de\s*)?(puntos?\s*d[eé]biles?|fallos?|errores?)/i,
    /hazme\s*(el|un)\s*test\s*(de\s*)?(puntos?\s*d[eé]biles?|fallos?|errores?)/i,
    /test\s*(de\s*)?(mis\s*)?(puntos?\s*d[eé]biles?|fallos?|errores?)/i,
    /practicar\s*(mis\s*)?(puntos?\s*d[eé]biles?|fallos?|errores?)/i,
    /repasar\s*(mis\s*)?(puntos?\s*d[eé]biles?|fallos?|errores?)/i,
  ]

  return affirmativePatterns.some(p => p.test(msgLower)) ||
         directPatterns.some(p => p.test(msgLower))
}

/**
 * Genera la respuesta con el enlace al test de puntos débiles
 */
export function formatWeakPointsTestResponse(): string {
  return `🎯 **¡Perfecto!** 👉 [Empezar test de puntos débiles](/test/repaso-fallos?n=10)`
}

/**
 * Detecta el tipo de consulta de estadísticas
 */
export function detectStatsQueryType(message: string): StatsQueryType {
  // Primero verificar si quiere test de puntos débiles
  if (isWeakPointsTestRequest(message)) return 'weak_points_test'
  if (isExamStatsQuery(message)) return 'exam'
  if (isUserStatsQuery(message)) return 'user'
  return 'none'
}

// ============================================
// PARSEO DE FILTROS TEMPORALES
// ============================================

/**
 * Parsea frases temporales del mensaje y devuelve fecha de inicio
 */
export function parseTemporalPhrase(message: string): TemporalFilter {
  const msgLower = message.toLowerCase()
  const now = new Date()

  // "esta semana" -> desde el lunes 00:00
  if (/esta\s*semana|semana\s*actual/i.test(msgLower)) {
    const monday = new Date(now)
    const day = monday.getDay()
    const diff = day === 0 ? 6 : day - 1 // Lunes = 0
    monday.setDate(monday.getDate() - diff)
    monday.setHours(0, 0, 0, 0)
    return { fromDate: monday, label: 'esta semana' }
  }

  // "este mes" -> desde el día 1 del mes 00:00
  if (/este\s*mes|mes\s*actual/i.test(msgLower)) {
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    firstOfMonth.setHours(0, 0, 0, 0)
    return { fromDate: firstOfMonth, label: 'este mes' }
  }

  // "hace X días" / "últimos X días" -> desde hace X días
  const daysMatch = msgLower.match(/(?:hace|[uú]ltimos?)\s*(\d+)\s*d[ií]as?/i)
  if (daysMatch) {
    const days = parseInt(daysMatch[1])
    const fromDate = new Date(now)
    fromDate.setDate(fromDate.getDate() - days)
    fromDate.setHours(0, 0, 0, 0)
    return { fromDate, label: `últimos ${days} días` }
  }

  // "ayer" -> desde ayer 00:00
  if (/\bayer\b/i.test(msgLower)) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    return { fromDate: yesterday, label: 'desde ayer' }
  }

  // "hoy" -> desde hoy 00:00
  if (/\bhoy\b/i.test(msgLower)) {
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    return { fromDate: today, label: 'hoy' }
  }

  // "desde siempre" / "histórico" / "todo" -> sin filtro
  if (/desde\s*siempre|hist[oó]rico|todo\s*el\s*historial|todos?\s*mis\s*fallos/i.test(msgLower)) {
    return { fromDate: null, label: 'histórico' }
  }

  // Por defecto: sin filtro temporal específico (se usará el default de 30 días)
  return { fromDate: null, label: null }
}

// ============================================
// EXTRACCIÓN DE LEY DEL MENSAJE
// ============================================

/**
 * Extrae nombre de ley del mensaje si se menciona
 */
export function extractLawFromMessage(message: string): string | null {
  const msgLower = message.toLowerCase()

  // Patrones de leyes comunes
  const lawPatterns: Array<{ pattern: RegExp; law: string }> = [
    { pattern: /ley\s*39\/2015/i, law: 'Ley 39/2015' },
    { pattern: /ley\s*40\/2015/i, law: 'Ley 40/2015' },
    { pattern: /constituci[oó]n/i, law: 'CE' },
    { pattern: /lpac|procedimiento\s*administrativo\s*com[uú]n/i, law: 'Ley 39/2015' },
    { pattern: /lrjsp|r[eé]gimen\s*jur[ií]dico/i, law: 'Ley 40/2015' },
    { pattern: /ley\s*50\/1997|gobierno/i, law: 'Ley 50/1997' },
    { pattern: /ley\s*19\/2013|transparencia/i, law: 'Ley 19/2013' },
    { pattern: /ebep|empleado\s*p[uú]blico/i, law: 'RDL 5/2015' },
  ]

  for (const { pattern, law } of lawPatterns) {
    if (pattern.test(msgLower)) {
      return law
    }
  }

  return null
}

// ============================================
// FORMATEO DE RESPUESTAS
// ============================================

/**
 * Formatea las estadísticas de exámenes para mostrar al usuario
 */
export function formatExamStatsResponse(stats: ExamStatsResult): string {
  let response = `📊 **Estadísticas de Exámenes Oficiales**\n\n`

  if (stats.lawFilter) {
    response += `📋 *Filtro: ${stats.lawFilter}*\n\n`
  }

  response += `Se analizaron **${stats.totalOfficialQuestions} preguntas** de exámenes oficiales.\n\n`
  response += `**🎯 Artículos más preguntados:**\n\n`

  stats.topArticles.forEach((art, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
    response += `${medal} **${art.law} ${art.article}** - ${art.count} veces\n`
  })

  response += `\n💡 *Tip: Enfoca tu estudio en estos artículos ya que son los más frecuentes en exámenes.*`

  return response
}

/**
 * Formatea la comparación semanal de estadísticas
 */
export function formatWeeklyComparisonResponse(
  comparison: {
    thisWeek: { totalQuestions: number; correctAnswers: number; accuracy: number }
    lastWeek: { totalQuestions: number; correctAnswers: number; accuracy: number }
    improvement: { questions: number; accuracy: number }
  }
): string {
  let response = `📊 **Tu Progreso: Esta Semana vs Semana Pasada**\n\n`

  // Comparación de actividad
  response += `📅 **Esta Semana:**\n`
  response += `- Preguntas respondidas: **${comparison.thisWeek.totalQuestions}**\n`
  response += `- Correctas: **${comparison.thisWeek.correctAnswers}** ✅\n`
  response += `- Porcentaje de acierto: **${comparison.thisWeek.accuracy}%**\n\n`

  response += `📅 **Semana Pasada:**\n`
  response += `- Preguntas respondidas: **${comparison.lastWeek.totalQuestions}**\n`
  response += `- Correctas: **${comparison.lastWeek.correctAnswers}** ✅\n`
  response += `- Porcentaje de acierto: **${comparison.lastWeek.accuracy}%**\n\n`

  // Caso especial: no ha practicado esta semana
  if (comparison.thisWeek.totalQuestions === 0) {
    if (comparison.lastWeek.totalQuestions > 0) {
      response += `📚 **No has practicado esta semana todavía.** La semana pasada hiciste ${comparison.lastWeek.totalQuestions} preguntas con un ${comparison.lastWeek.accuracy}% de acierto. ¡Retoma el ritmo!`
    } else {
      response += `📚 **No has practicado ninguna de las dos semanas.** ¡Es hora de empezar! Intenta hacer al menos 10 preguntas al día.`
    }
    return response
  }

  // Análisis de mejora
  response += `📈 **Comparación:**\n`

  // Comparar actividad
  if (comparison.improvement.questions > 0) {
    response += `- Has respondido **${Math.abs(comparison.improvement.questions)} preguntas más** esta semana 🎯\n`
  } else if (comparison.improvement.questions < 0) {
    response += `- Has respondido **${Math.abs(comparison.improvement.questions)} preguntas menos** esta semana ⚠️\n`
  } else {
    response += `- Has mantenido el mismo ritmo de estudio 📊\n`
  }

  // Comparar precisión (solo si ambas semanas tienen datos)
  if (comparison.lastWeek.totalQuestions > 0) {
    if (comparison.improvement.accuracy > 0) {
      response += `- Tu precisión ha **subido de ${comparison.lastWeek.accuracy}% a ${comparison.thisWeek.accuracy}%** 🚀\n`
    } else if (comparison.improvement.accuracy < 0) {
      response += `- Tu precisión ha **bajado de ${comparison.lastWeek.accuracy}% a ${comparison.thisWeek.accuracy}%** 📉\n`
    } else {
      response += `- Tu precisión se mantiene estable en **${comparison.thisWeek.accuracy}%** 📊\n`
    }
  }

  response += `\n`

  // Mensaje motivacional según el progreso
  if (comparison.improvement.questions > 0 && comparison.improvement.accuracy >= 0) {
    response += `💪 **¡Excelente progreso!** Estás aumentando tanto tu ritmo de estudio como tu precisión. ¡Sigue así!`
  } else if (comparison.improvement.questions > 0 && comparison.improvement.accuracy < 0) {
    response += `🎯 **Buen ritmo de estudio**, pero intenta revisar las explicaciones para mejorar tu precisión.`
  } else if (comparison.improvement.questions < 0 && comparison.improvement.accuracy > 0) {
    response += `✨ **Tu precisión ha mejorado**, aunque has estudiado menos. ¡Intenta ser más constante!`
  } else if (comparison.improvement.questions < 0 && comparison.improvement.accuracy < 0) {
    response += `⚠️ **Necesitas retomar el ritmo**. Intenta dedicar más tiempo y revisar las explicaciones.`
  } else {
    response += `📊 **Mantén la constancia**. Un ritmo regular es clave para aprobar.`
  }

  return response
}

/**
 * Formatea las estadísticas del usuario para mostrar
 */
export function formatUserStatsResponse(
  stats: UserStatsResult,
  temporalLabel: string | null
): string {
  let response = `📊 **Tu Progreso de Estudio**`

  if (temporalLabel) {
    response += ` (${temporalLabel})`
  }

  response += `\n\n`

  // Resumen general
  response += `📈 **Resumen:**\n`
  response += `- Total de preguntas: **${stats.totalAnswers}**\n`
  response += `- Correctas: **${stats.totalCorrect}** ✅\n`
  response += `- Falladas: **${stats.totalFailed}** ❌\n`
  response += `- Porcentaje de acierto: **${stats.overallAccuracy}%**\n\n`

  // Artículos más fallados
  if (stats.mostFailed.length > 0) {
    response += `**❌ Artículos donde más fallas:**\n\n`

    stats.mostFailed.slice(0, 5).forEach((art, i) => {
      response += `${i + 1}. **${art.law} ${art.article}** - ${art.failed} fallos (${art.accuracy}% acierto)\n`
    })

    response += `\n`
  }

  // Artículos con peor porcentaje
  if (stats.worstAccuracy.length > 0 && stats.worstAccuracy[0].accuracy < 50) {
    response += `**⚠️ Artículos con peor rendimiento:**\n\n`

    stats.worstAccuracy.slice(0, 3).forEach((art, i) => {
      response += `${i + 1}. **${art.law} ${art.article}** - ${art.accuracy}% (${art.correct}/${art.total})\n`
    })

    response += `\n`
  }

  // Propuesta de test si hay puntos débiles
  if (stats.mostFailed.length > 0 || (stats.worstAccuracy.length > 0 && stats.worstAccuracy[0].accuracy < 50)) {
    response += `\n🎯 **¿Te preparo un test de tus puntos débiles?** 👉 [Sí, empezar test](/test/repaso-fallos?n=10)`
  } else {
    response += `💡 *Sigue así, tu rendimiento es bueno.*`
  }

  return response
}

// ============================================
// SERVICIO PRINCIPAL
// ============================================

export interface StatsSearchResult {
  type: StatsQueryType
  examStats: ExamStatsResult | null
  userStats: UserStatsResult | null
  temporalFilter: TemporalFilter
  lawFilter: string | null
}

/**
 * Busca y obtiene estadísticas según el contexto
 */
export async function searchStats(context: ChatContext): Promise<StatsSearchResult> {
  const message = context.currentMessage
  const queryType = detectStatsQueryType(message)

  logger.debug(`Stats query type detected: ${queryType}`, { domain: 'stats' })

  const result: StatsSearchResult = {
    type: queryType,
    examStats: null,
    userStats: null,
    temporalFilter: { fromDate: null, label: null },
    lawFilter: extractLawFromMessage(message),
  }

  if (queryType === 'none') {
    return result
  }

  if (queryType === 'exam') {
    result.examStats = await getExamStats(result.lawFilter, 15, null)
  }

  if (queryType === 'user') {
    result.temporalFilter = parseTemporalPhrase(message)
    result.userStats = await getUserStats(
      context.userId,
      result.lawFilter,
      10,
      result.temporalFilter.fromDate
    )
  }

  return result
}

// Re-exportar tipos y funciones útiles
export type { ExamStatsResult, UserStatsResult, TemporalFilter, StatsQueryType }
