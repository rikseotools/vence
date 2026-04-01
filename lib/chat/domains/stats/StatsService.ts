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
import { mapSlugToShortName as mapLawSlugToShortName } from '@/lib/lawSlugSync'
import { getOposicionByPositionType } from '@/lib/config/oposiciones'
import { createClient } from '@supabase/supabase-js'

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
    // Resultados personales sin "mis" (ej: "dame los resultados", "los resultados que he hecho")
    /(dame|ver|enseñ[aá]|muestra|dime)\s*(los\s*)?(resultado|estad[ií]stica|nota|puntuaci[oó]n)/i,
    /resultado.*que\s*he\s*(hecho|sacado|obtenido)/i,
    /resultado.*(sim[iu]lacro|examen|test)/i,
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
 * Extrae nombre de ley del mensaje del usuario.
 *
 * Fuentes de resolución (en orden):
 * 1. Cache de BD (slug → short_name, short_name directo) — escalable, sin mantenimiento
 * 2. lawMappingUtils (aliases hardcodeados) — fallback para aliases no derivables del slug
 * 3. Patrones descriptivos (regex) — para frases como "constitución", "enjuiciamiento criminal"
 *
 * Para añadir una ley nueva: solo crear la ley en BD con su slug. Sin tocar código.
 */
export function extractLawFromMessage(message: string): string | null {
  const msgLower = message.toLowerCase().trim()

  // 1) Extraer referencias con número: "ley 39/2015", "lo 6/1985", "rd 364/1995", etc.
  const numRefs = msgLower.matchAll(
    /\b(ley|lo|rdl|rd|orden)\s+(\d+\/\d+)/gi
  )
  for (const match of numRefs) {
    const prefix = match[1].toLowerCase()
    const num = match[2].replace('/', '-')
    const slug = `${prefix}-${num}`
    const shortName = _resolveSlug(slug)
    if (shortName) return shortName
  }

  // 2) Probar palabras/tokens del mensaje como slugs o short_names directos
  // Captura abreviaturas: "lecrim", "lopj", "ebep", "lpac", "ce", "tfue", etc.
  const tokens = msgLower
    .replace(/[¿?¡!.,;:()"""]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2)

  for (const token of tokens) {
    const shortName = _resolveSlug(token)
    if (shortName) return shortName
  }

  // 3) Probar combinaciones de 2-3 tokens consecutivos como slug
  // "poder judicial" → "poder-judicial", "enjuiciamiento criminal" → "ley-enjuiciamiento-criminal"
  for (let i = 0; i < tokens.length - 1; i++) {
    const slug2 = `${tokens[i]}-${tokens[i + 1]}`
    let sn = _resolveSlug(slug2)
    if (sn) return sn

    // Probar con prefijo "ley-" para nombres descriptivos
    sn = _resolveSlug(`ley-${slug2}`)
    if (sn) return sn

    if (i < tokens.length - 2) {
      sn = _resolveSlug(`${tokens[i]}-${tokens[i + 1]}-${tokens[i + 2]}`)
      if (sn) return sn
    }
  }

  // 4) Patrones descriptivos mínimos: solo para abreviaturas/nombres que no están en el campo
  // `name` de la BD, o para desambiguar cuando dos leyes comparten un keyword
  const descriptivePatterns: Array<{ pattern: RegExp; slug: string }> = [
    { pattern: /constituci[oó]n/i, slug: 'ce' },
    { pattern: /enjuiciamiento\s*criminal/i, slug: 'ley-enjuiciamiento-criminal' },
    { pattern: /poder\s*judicial/i, slug: 'poder-judicial' },
    { pattern: /empleado\s*p[uú]blico/i, slug: 'ebep' },
    { pattern: /tratado.*funcionamiento/i, slug: 'tfue' },
    { pattern: /tratado.*uni[oó]n\s*europea/i, slug: 'tue' },
    // Desambiguación: "transparencia" puede ser Plan Transparencia Judicial o Ley 19/2013
    { pattern: /transparencia/i, slug: 'ley-19-2013' },
  ]

  for (const { pattern, slug } of descriptivePatterns) {
    if (pattern.test(msgLower)) {
      const shortName = _resolveSlug(slug)
      if (shortName) return shortName
    }
  }

  // 5) Búsqueda por keywords del campo `name` de la BD (escalable, sin mantenimiento)
  // Ej: "ley del gobierno" → match "Ley 50/1997, del Gobierno" por keyword "gobierno"
  const nameMatch = _matchLawByNameKeywords(message)
  if (nameMatch) return nameMatch

  return null
}

// ============================================
// CACHE DE LEYES DESDE BD (escalable)
// ============================================

/** slug → short_name cargado de la tabla laws */
let _dbSlugMap: Map<string, string> | null = null
/** short_name (lowercase) → short_name para match directo */
let _dbShortNameMap: Map<string, string> | null = null
/** Índice de keywords extraídos del campo `name` de la tabla laws */
let _dbNameKeywords: Array<{ shortName: string; keywords: string[] }> | null = null
let _dbCacheLoading: Promise<void> | null = null

// Stop words para filtrar al extraer keywords del nombre de la ley
const STOP_WORDS = new Set([
  'de', 'del', 'la', 'el', 'las', 'los', 'por', 'que', 'se', 'en', 'al', 'con',
  'para', 'y', 'o', 'a', 'un', 'una', 'su', 'sus', 'lo', 'le', 'les',
  'sobre', 'como', 'cual', 'cuales', 'este', 'esta', 'estos', 'estas',
  'ley', 'real', 'decreto', 'orden', 'organica', 'legislativo',
  'texto', 'refundido', 'aprueba', 'regula', 'reguladora', 'establece',
  'modifica', 'determina', 'dispone', 'materia', 'medidas', 'normas',
  // Meses (aparecen en muchas leyes por la fecha, pero no son relevantes)
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
])

/**
 * Extrae keywords significativos del nombre descriptivo de una ley.
 * Filtra stop words, números, fechas y tokens cortos.
 */
function _extractKeywords(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[()""".,;:\/\-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3)
    .filter(t => !/^\d+$/.test(t)) // sin números puros
    .filter(t => !STOP_WORDS.has(t))
}

/**
 * Busca una ley por keywords del campo `name` de la BD.
 * Para cada ley, calcula qué fracción de sus keywords aparecen en el mensaje.
 * Devuelve la ley con mayor score si supera el umbral mínimo.
 */
function _matchLawByNameKeywords(message: string): string | null {
  if (!_dbNameKeywords || _dbNameKeywords.length === 0) return null

  const msgNorm = message
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!()""".,;:\/\-]/g, ' ')
  const msgTokens = new Set(msgNorm.split(/\s+/).filter(t => t.length >= 3))

  let bestMatch: string | null = null
  let bestScore = 0
  let bestMatchedCount = 0

  for (const { shortName, keywords } of _dbNameKeywords) {
    if (keywords.length === 0) continue
    const matched = keywords.filter(kw => msgTokens.has(kw)).length
    if (matched === 0) continue
    const score = matched / keywords.length
    // Preferir mayor score; en empate, preferir más keywords coincidentes
    if (score > bestScore || (score === bestScore && matched > bestMatchedCount)) {
      bestScore = score
      bestMatch = shortName
      bestMatchedCount = matched
    }
  }

  // Umbral mínimo: al menos 1 keyword y score >= 0.25
  return bestScore >= 0.25 ? bestMatch : null
}

/**
 * Resuelve un slug/alias a short_name.
 * 1. Cache de BD (slug → short_name)
 * 2. Cache de BD (short_name directo, case-insensitive)
 * 3. lawMappingUtils hardcodeado (fallback)
 */
function _resolveSlug(slug: string): string | null {
  // BD cache: slug → short_name
  if (_dbSlugMap) {
    const fromSlug = _dbSlugMap.get(slug)
    if (fromSlug) return fromSlug
  }

  // BD cache: short_name directo (case-insensitive)
  if (_dbShortNameMap) {
    const fromSn = _dbShortNameMap.get(slug.toLowerCase())
    if (fromSn) return fromSn
  }

  // Fallback: lawMappingUtils hardcodeado
  return mapLawSlugToShortName(slug)
}

/**
 * Carga slug → short_name de la tabla laws en BD.
 * Se llama lazy desde searchStats. Solo carga una vez.
 */
export async function loadLawsCache(): Promise<void> {
  if (_dbSlugMap) return // ya cargado

  // Evitar cargas concurrentes
  if (_dbCacheLoading) { await _dbCacheLoading; return }

  _dbCacheLoading = (async () => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
      const supabase = createClient(supabaseUrl, supabaseKey)

      const { data, error } = await supabase
        .from('laws')
        .select('slug, short_name, name')
        .eq('is_active', true)

      if (error || !data) {
        logger.warn('Could not load laws cache from DB', { domain: 'stats', error: error?.message })
        return
      }

      const slugMap = new Map<string, string>()
      const snMap = new Map<string, string>()
      const nameKws: Array<{ shortName: string; keywords: string[] }> = []

      for (const law of data) {
        // slug → short_name
        if (law.slug) {
          slugMap.set(law.slug, law.short_name)
        }

        // short_name (lowercase) → short_name (para match directo de abreviaturas)
        snMap.set(law.short_name.toLowerCase(), law.short_name)

        // Extraer keywords del nombre descriptivo (solo si difiere del short_name)
        if (law.name && law.name !== law.short_name) {
          const keywords = _extractKeywords(law.name)
          if (keywords.length > 0) {
            nameKws.push({ shortName: law.short_name, keywords })
          }
        }
      }

      _dbSlugMap = slugMap
      _dbShortNameMap = snMap
      _dbNameKeywords = nameKws

      logger.info(`Laws cache loaded from DB: ${slugMap.size} slugs, ${snMap.size} short_names, ${nameKws.length} name keyword sets`, { domain: 'stats' })
    } catch (err) {
      logger.warn('Error loading laws cache from DB', { domain: 'stats', error: String(err) })
    }
  })()

  await _dbCacheLoading
}

// ============================================
// FORMATEO DE RESPUESTAS
// ============================================

/**
 * Formatea las estadísticas de exámenes para mostrar al usuario
 */
export function formatExamStatsResponse(stats: ExamStatsResult): string {
  let response = `📊 **Estadísticas de Exámenes Oficiales**\n\n`

  // Mostrar filtro de oposición
  if (stats.positionFilter) {
    const oposicion = getOposicionByPositionType(stats.positionFilter)
    if (oposicion) {
      response += `🎓 *Oposición: ${oposicion.shortName}*\n`
    }
  }

  if (stats.lawFilter) {
    response += `📋 *Filtro: ${stats.lawFilter}*\n\n`
  } else if (stats.positionFilter) {
    response += `\n`
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

  response += `\n\n📋 **[Ver estadísticas detalladas](/perfil#estadisticas)**`

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
 * @param overrideType - Tipo forzado (usado para follow-ups de conversación)
 */
export async function searchStats(context: ChatContext, overrideType?: StatsQueryType): Promise<StatsSearchResult> {
  const message = context.currentMessage
  const queryType = overrideType || detectStatsQueryType(message)

  logger.debug(`Stats query type detected: ${queryType}`, { domain: 'stats' })

  // Cargar cache de leyes desde BD (lazy, solo la primera vez)
  await loadLawsCache()

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
    // Filtrar por oposición del usuario si está disponible
    const examPosition = context.userDomain || null
    result.examStats = await getExamStats(result.lawFilter, 15, examPosition)
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
