// lib/api/random-test-data/queries.ts - Queries optimizadas para datos de test aleatorio
import { getDb } from '@/db/client'
import { topics, topicScope, laws, questions, articles, tests, testQuestions } from '@/db/schema'
import { eq, and, sql, inArray, gte } from 'drizzle-orm'
import type {
  GetRandomTestDataResponse,
  ThemeQuestionCounts,
  UserThemeStats,
  DetailedThemeStats,
  OposicionKey,
  GetDetailedThemeStatsResponse,
  CheckAvailableQuestionsResponse,
} from './schemas'
import {
  OPOSICION_TO_POSITION_TYPE,
  getTopicNumberFromThemeId,
  getThemeIdFromTopicNumber,
  VALID_THEME_IDS,
} from './schemas'

// Cache simple en memoria (5 minutos)
const dataCache = new Map<string, { data: GetRandomTestDataResponse; timestamp: number }>()
const CACHE_TTL = 30 * 1000 // 30 segundos - reducido para mejor UX

/**
 * Obtiene todos los datos iniciales para la página de test aleatorio
 * Consolida: loadThemeQuestionCounts + loadUserStats
 */
export async function getRandomTestData(
  oposicion: OposicionKey,
  userId?: string | null
): Promise<GetRandomTestDataResponse> {
  try {
    const cacheKey = `${oposicion}-${userId || 'anon'}`

    // Verificar cache (solo para usuarios anónimos o datos básicos)
    if (!userId) {
      const cached = dataCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return { ...cached.data, cached: true }
      }
    }

    const db = getDb()
    const positionType = OPOSICION_TO_POSITION_TYPE[oposicion]
    const themeRange = VALID_THEME_IDS[oposicion]

    // 1️⃣ OBTENER CONTEO DE PREGUNTAS POR TEMA
    const themeQuestionCounts = await getThemeQuestionCounts(db, oposicion, positionType, themeRange)

    // 2️⃣ OBTENER ESTADÍSTICAS DEL USUARIO (si hay userId)
    let userStats: UserThemeStats | undefined
    if (userId) {
      userStats = await getUserThemeStats(db, userId, oposicion)
    }

    const response: GetRandomTestDataResponse = {
      success: true,
      themeQuestionCounts,
      userStats,
      generatedAt: new Date().toISOString(),
    }

    // Guardar en cache (solo si no hay usuario)
    if (!userId) {
      dataCache.set(cacheKey, { data: response, timestamp: Date.now() })
    }

    return response
  } catch (error) {
    console.error('Error obteniendo datos de test aleatorio:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Obtiene el conteo de preguntas por tema
 */
async function getThemeQuestionCounts(
  db: ReturnType<typeof getDb>,
  oposicion: OposicionKey,
  positionType: string,
  themeRange: { min: number; max: number }
): Promise<ThemeQuestionCounts> {
  const counts: ThemeQuestionCounts = {}

  // Obtener todos los mapeos de topic_scope para esta oposición
  const allMappings = await db
    .select({
      topicNumber: topics.topicNumber,
      articleNumbers: topicScope.articleNumbers,
      lawId: topicScope.lawId,
    })
    .from(topicScope)
    .innerJoin(topics, eq(topicScope.topicId, topics.id))
    .where(eq(topics.positionType, positionType))

  // Agrupar mappings por topic_number
  const mappingsByTopic = new Map<number, Array<{ articleNumbers: string[] | null; lawId: string | null }>>()
  for (const mapping of allMappings) {
    if (!mapping.topicNumber) continue
    if (!mappingsByTopic.has(mapping.topicNumber)) {
      mappingsByTopic.set(mapping.topicNumber, [])
    }
    mappingsByTopic.get(mapping.topicNumber)!.push({
      articleNumbers: mapping.articleNumbers,
      lawId: mapping.lawId,
    })
  }

  // Para cada tema en el rango, contar preguntas
  for (let themeId = themeRange.min; themeId <= themeRange.max; themeId++) {
    const topicNumber = getTopicNumberFromThemeId(themeId, oposicion)
    const topicMappings = mappingsByTopic.get(topicNumber)

    if (!topicMappings || topicMappings.length === 0) {
      counts[themeId.toString()] = 0
      continue
    }

    // Contar preguntas para este tema
    let totalCount = 0
    for (const mapping of topicMappings) {
      if (!mapping.lawId || !mapping.articleNumbers?.length) continue

      const questionCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(questions)
        .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
        .where(and(
          eq(questions.isActive, true),
          eq(articles.lawId, mapping.lawId),
          inArray(articles.articleNumber, mapping.articleNumbers)
        ))

      totalCount += Number(questionCount[0]?.count || 0)
    }

    counts[themeId.toString()] = totalCount
  }

  return counts
}

/**
 * Obtiene las estadísticas del usuario por tema (últimos 6 meses)
 */
async function getUserThemeStats(
  db: ReturnType<typeof getDb>,
  userId: string,
  oposicion: OposicionKey
): Promise<UserThemeStats> {
  const stats: UserThemeStats = {}

  // Fecha de corte: 6 meses atrás
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  // Obtener todas las respuestas del usuario de los últimos 6 meses
  const userAnswers = await db
    .select({
      temaNumber: testQuestions.temaNumber,
      isCorrect: testQuestions.isCorrect,
      createdAt: testQuestions.createdAt,
    })
    .from(testQuestions)
    .innerJoin(tests, eq(testQuestions.testId, tests.id))
    .where(and(
      eq(tests.userId, userId),
      gte(testQuestions.createdAt, sixMonthsAgo.toISOString())
    ))

  // Agrupar por tema y calcular estadísticas
  const statsByTopic = new Map<number, {
    total: number
    correct: number
    lastStudy: Date | null
  }>()

  for (const answer of userAnswers) {
    if (!answer.temaNumber) continue

    if (!statsByTopic.has(answer.temaNumber)) {
      statsByTopic.set(answer.temaNumber, {
        total: 0,
        correct: 0,
        lastStudy: null,
      })
    }

    const topicStats = statsByTopic.get(answer.temaNumber)!
    topicStats.total++
    if (answer.isCorrect) {
      topicStats.correct++
    }

    const answerDate = answer.createdAt ? new Date(answer.createdAt) : null
    if (answerDate && (!topicStats.lastStudy || answerDate > topicStats.lastStudy)) {
      topicStats.lastStudy = answerDate
    }
  }

  // Convertir a formato de respuesta con themeId
  for (const [topicNumber, topicStats] of statsByTopic) {
    const themeId = getThemeIdFromTopicNumber(topicNumber, oposicion)
    const accuracy = topicStats.total > 0
      ? Math.round((topicStats.correct / topicStats.total) * 100)
      : 0

    stats[themeId.toString()] = {
      total: topicStats.total,
      correct: topicStats.correct,
      accuracy,
      lastStudy: topicStats.lastStudy?.toISOString() || null,
      lastStudyFormatted: formatLastStudy(topicStats.lastStudy),
    }
  }

  return stats
}

/**
 * Obtiene estadísticas detalladas de un tema específico (preguntas vistas/no vistas)
 */
export async function getDetailedThemeStats(
  oposicion: OposicionKey,
  themeId: number,
  userId: string
): Promise<GetDetailedThemeStatsResponse> {
  try {
    const db = getDb()
    const positionType = OPOSICION_TO_POSITION_TYPE[oposicion]
    const topicNumber = getTopicNumberFromThemeId(themeId, oposicion)

    // 1. Obtener mapeo del tema
    const mappings = await db
      .select({
        articleNumbers: topicScope.articleNumbers,
        lawId: topicScope.lawId,
      })
      .from(topicScope)
      .innerJoin(topics, eq(topicScope.topicId, topics.id))
      .where(and(
        eq(topics.topicNumber, topicNumber),
        eq(topics.positionType, positionType)
      ))

    if (!mappings.length) {
      return {
        success: true,
        stats: {
          themeId,
          total: 0,
          answered: 0,
          neverSeen: 0,
        },
      }
    }

    // 2. Obtener todas las preguntas del tema
    const allQuestionIds = new Set<string>()
    for (const mapping of mappings) {
      if (!mapping.lawId || !mapping.articleNumbers?.length) continue

      const questionResults = await db
        .select({ id: questions.id })
        .from(questions)
        .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
        .where(and(
          eq(questions.isActive, true),
          eq(articles.lawId, mapping.lawId),
          inArray(articles.articleNumber, mapping.articleNumbers)
        ))

      for (const q of questionResults) {
        allQuestionIds.add(q.id)
      }
    }

    const totalQuestions = allQuestionIds.size

    if (totalQuestions === 0) {
      return {
        success: true,
        stats: {
          themeId,
          total: 0,
          answered: 0,
          neverSeen: 0,
        },
      }
    }

    // 3. Obtener preguntas respondidas por el usuario
    const answeredQuestions = await db
      .select({ questionId: testQuestions.questionId })
      .from(testQuestions)
      .innerJoin(tests, eq(testQuestions.testId, tests.id))
      .where(and(
        eq(tests.userId, userId),
        inArray(testQuestions.questionId, Array.from(allQuestionIds))
      ))

    const answeredIds = new Set(answeredQuestions.map(a => a.questionId))
    const answeredCount = answeredIds.size
    const neverSeenCount = totalQuestions - answeredCount

    return {
      success: true,
      stats: {
        themeId,
        total: totalQuestions,
        answered: answeredCount,
        neverSeen: neverSeenCount,
      },
    }
  } catch (error) {
    console.error('Error obteniendo stats detalladas del tema:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Formatea la fecha de último estudio
 */
function formatLastStudy(date: Date | null): string {
  if (!date) return 'Nunca'

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 7) return `Hace ${diffDays} días`
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`
  if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} meses`
  return `Hace más de 1 año`
}

/**
 * Invalida el cache de datos aleatorios
 */
export function invalidateRandomTestDataCache(oposicion: OposicionKey): void {
  const cacheKey = `${oposicion}-anon`
  dataCache.delete(cacheKey)
}

/**
 * Limpia todo el cache
 */
export function clearAllRandomTestDataCache(): void {
  dataCache.clear()
}

// Cache para check-availability (30 segundos - cambia más frecuentemente)
const availabilityCache = new Map<string, { data: CheckAvailableQuestionsResponse; timestamp: number }>()
const AVAILABILITY_CACHE_TTL = 30 * 1000 // 30 segundos

/**
 * Verifica cuántas preguntas están disponibles con los filtros dados
 * Consolida múltiples queries en una sola operación eficiente
 */
export async function checkAvailableQuestions(
  oposicion: OposicionKey,
  selectedThemes: number[],
  difficulty: 'mixed' | 'easy' | 'medium' | 'hard' = 'mixed',
  onlyOfficialQuestions: boolean = false,
  focusEssentialArticles: boolean = false
): Promise<CheckAvailableQuestionsResponse> {
  try {
    // Generar cache key basado en los parámetros
    const cacheKey = `${oposicion}-${selectedThemes.sort().join(',')}-${difficulty}-${onlyOfficialQuestions}-${focusEssentialArticles}`

    // Verificar cache
    const cached = availabilityCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < AVAILABILITY_CACHE_TTL) {
      return { ...cached.data, cached: true }
    }

    const db = getDb()
    const positionType = OPOSICION_TO_POSITION_TYPE[oposicion]

    // Convertir themeIds internos a topic_numbers de BD
    const topicNumbers = selectedThemes.map(themeId =>
      getTopicNumberFromThemeId(themeId, oposicion)
    )

    // 1. Obtener todos los mapeos de topic_scope para los temas seleccionados
    const allMappings = await db
      .select({
        topicNumber: topics.topicNumber,
        articleNumbers: topicScope.articleNumbers,
        lawId: topicScope.lawId,
      })
      .from(topicScope)
      .innerJoin(topics, eq(topicScope.topicId, topics.id))
      .where(and(
        eq(topics.positionType, positionType),
        inArray(topics.topicNumber, topicNumbers)
      ))

    if (!allMappings.length) {
      const response: CheckAvailableQuestionsResponse = {
        success: true,
        availableQuestions: 0,
        breakdown: {},
      }
      availabilityCache.set(cacheKey, { data: response, timestamp: Date.now() })
      return response
    }

    // 2. Agrupar mappings por topic_number
    const mappingsByTopic = new Map<number, Array<{ articleNumbers: string[] | null; lawId: string | null }>>()
    for (const mapping of allMappings) {
      if (!mapping.topicNumber) continue
      if (!mappingsByTopic.has(mapping.topicNumber)) {
        mappingsByTopic.set(mapping.topicNumber, [])
      }
      mappingsByTopic.get(mapping.topicNumber)!.push({
        articleNumbers: mapping.articleNumbers,
        lawId: mapping.lawId,
      })
    }

    // 3. Construir condiciones para contar preguntas
    // Recolectar todos los pares (lawId, articleNumbers) válidos
    const lawArticlePairs: Array<{ lawId: string; articleNumbers: string[] }> = []

    for (const [, topicMappings] of mappingsByTopic) {
      for (const mapping of topicMappings) {
        if (mapping.lawId && mapping.articleNumbers?.length) {
          lawArticlePairs.push({
            lawId: mapping.lawId,
            articleNumbers: mapping.articleNumbers,
          })
        }
      }
    }

    if (lawArticlePairs.length === 0) {
      const response: CheckAvailableQuestionsResponse = {
        success: true,
        availableQuestions: 0,
        breakdown: {},
      }
      availabilityCache.set(cacheKey, { data: response, timestamp: Date.now() })
      return response
    }

    // 4. Contar preguntas para cada par (lawId, articleNumbers) con los filtros aplicados
    let totalQuestions = 0
    const breakdown: Record<string, number> = {}

    for (const pair of lawArticlePairs) {
      // Construir condiciones base
      const conditions = [
        eq(questions.isActive, true),
        eq(articles.lawId, pair.lawId),
        inArray(articles.articleNumber, pair.articleNumbers),
      ]

      // Filtro de dificultad
      if (difficulty !== 'mixed') {
        conditions.push(eq(questions.difficulty, difficulty))
      }

      // Filtro de preguntas oficiales
      if (onlyOfficialQuestions) {
        conditions.push(eq(questions.isOfficialExam, true))
      }

      // Filtro de artículos esenciales (solo preguntas de exámenes oficiales)
      if (focusEssentialArticles) {
        conditions.push(eq(questions.isOfficialExam, true))
      }

      const countResult = await db
        .select({ count: sql<number>`count(DISTINCT ${questions.id})` })
        .from(questions)
        .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
        .where(and(...conditions))

      const count = Number(countResult[0]?.count || 0)
      totalQuestions += count

      // Añadir al breakdown por lawId (para debugging)
      if (count > 0) {
        breakdown[pair.lawId] = (breakdown[pair.lawId] || 0) + count
      }
    }

    const response: CheckAvailableQuestionsResponse = {
      success: true,
      availableQuestions: totalQuestions,
      breakdown,
    }

    // Guardar en cache
    availabilityCache.set(cacheKey, { data: response, timestamp: Date.now() })

    return response
  } catch (error) {
    console.error('Error verificando preguntas disponibles:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Invalida el cache de disponibilidad
 */
export function invalidateAvailabilityCache(): void {
  availabilityCache.clear()
}
