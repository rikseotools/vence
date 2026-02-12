// lib/api/topic-data/queries.ts - Queries optimizadas para datos de tema
// V2: Usa módulo compartido topic-progress para el progreso del usuario
import { getDb } from '@/db/client'
import { topics, topicScope, laws, questions, articles, tests, testQuestions } from '@/db/schema'
import { eq, and, sql, inArray, isNotNull } from 'drizzle-orm'
import type {
  GetTopicDataResponse,
  TopicInfo,
  DifficultyStats,
  ArticlesByLaw,
  UserProgress,
  OposicionKey,
  OPOSICION_TO_POSITION_TYPE
} from './schemas'

// Importar módulo compartido
import {
  getUserAnswersWithArticles,
  filterAnswersByScopeMappings,
  calculateDetailedProgress,
} from '@/lib/api/topic-progress'

// Cache simple en memoria (5 minutos)
const topicCache = new Map<string, { data: GetTopicDataResponse; timestamp: number }>()
const CACHE_TTL = 30 * 1000 // 30 segundos - reducido para mejor UX

// Mapa de posición
const POSITION_TYPE_MAP: Record<OposicionKey, string> = {
  'auxiliar-administrativo-estado': 'auxiliar_administrativo',
  'administrativo-estado': 'administrativo',
  'tramitacion-procesal': 'tramitacion_procesal',
  'auxilio-judicial': 'auxilio_judicial',
}

// =================================================================
// 🏛️ MAPEO: positionType → valores válidos de exam_position
// =================================================================
// Las preguntas oficiales tienen exam_position con valores inconsistentes.
// Este mapeo permite filtrar preguntas oficiales por oposición del usuario.
// IMPORTANTE: Debe estar sincronizado con lib/testFetchers.js
const EXAM_POSITION_MAP: Record<string, string[]> = {
  'auxiliar_administrativo': [
    'auxiliar administrativo del estado',
    'auxiliar administrativo',
    'auxiliar_administrativo',
    'auxiliar_administrativo_estado',
  ],
  'administrativo': [
    'administrativo',
    'administrativo_estado',
    'cuerpo_general_administrativo',
    'cuerpo general administrativo de la administración del estado',
  ],
  'gestion_administracion_civil': [
    'cuerpo_gestion_administracion_civil',
    'cuerpo de gestión de la administración civil del estado',
  ],
  'tramitacion_procesal': [
    'tramitacion_procesal',
    'tramitación procesal',
  ],
  'auxilio_judicial': [
    'auxilio_judicial',
    'auxilio judicial',
  ],
  'gestion_procesal': [
    'gestion_procesal',
    'gestión procesal',
  ],
}

/**
 * Obtiene todos los datos de un tema en una sola llamada
 * Reemplaza las 8 queries separadas de la página actual
 */
export async function getTopicFullData(
  topicNumber: number,
  oposicion: OposicionKey,
  userId?: string | null
): Promise<GetTopicDataResponse> {
  try {
    const cacheKey = `${oposicion}-${topicNumber}-${userId || 'anon'}`

    // Verificar cache (solo para datos sin usuario o datos básicos)
    if (!userId) {
      const cached = topicCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return { ...cached.data, cached: true }
      }
    }

    const db = getDb()
    const positionType = POSITION_TYPE_MAP[oposicion]

    // 1️⃣ OBTENER DATOS DEL TEMA
    const topicResult = await db
      .select({
        id: topics.id,
        topicNumber: topics.topicNumber,
        title: topics.title,
        description: topics.description,
        difficulty: topics.difficulty,
        estimatedHours: topics.estimatedHours,
      })
      .from(topics)
      .where(and(
        eq(topics.positionType, positionType),
        eq(topics.topicNumber, topicNumber),
        eq(topics.isActive, true)
      ))
      .limit(1)

    if (!topicResult.length) {
      return {
        success: false,
        error: `Tema ${topicNumber} no encontrado para ${oposicion}`,
      }
    }

    const topic: TopicInfo = {
      id: topicResult[0].id,
      topicNumber: topicResult[0].topicNumber,
      title: topicResult[0].title,
      description: topicResult[0].description,
      difficulty: topicResult[0].difficulty,
      estimatedHours: topicResult[0].estimatedHours,
    }

    // 2️⃣ OBTENER MAPEO DEL TEMA (topic_scope)
    const scopeMappings = await db
      .select({
        articleNumbers: topicScope.articleNumbers,
        lawId: topicScope.lawId,
        lawShortName: laws.shortName,
        lawName: laws.name,
      })
      .from(topicScope)
      .innerJoin(laws, eq(topicScope.lawId, laws.id))
      .where(eq(topicScope.topicId, topic.id))

    if (!scopeMappings.length) {
      // Tema sin mapeo - devolver datos básicos
      return {
        success: true,
        topic,
        difficultyStats: { easy: 0, medium: 0, hard: 0, extreme: 0, auto: 0 },
        totalQuestions: 0,
        officialQuestionsCount: 0,
        articlesByLaw: [],
        userProgress: null,
        generatedAt: new Date().toISOString(),
      }
    }

    // 3️⃣ OBTENER TODAS LAS PREGUNTAS DEL TEMA (una sola query)
    // Construir condiciones para cada ley y sus artículos
    const questionResults = await getQuestionsForTopic(db, scopeMappings)

    // 4️⃣ PROCESAR ESTADÍSTICAS DE DIFICULTAD
    const difficultyStats = processDifficultyStats(questionResults)
    const totalQuestions = Object.values(difficultyStats).reduce((sum, count) => sum + count, 0)

    // 5️⃣ CONTAR PREGUNTAS OFICIALES (filtrado por exam_position de la oposición)
    const validExamPositions = EXAM_POSITION_MAP[positionType] || []
    const officialQuestionsCount = questionResults.filter(q =>
      q.isOfficialExam &&
      q.examPosition &&
      validExamPositions.includes(q.examPosition.toLowerCase())
    ).length

    // 6️⃣ CONTAR ARTÍCULOS POR LEY
    const articlesByLaw = processArticlesByLaw(questionResults, scopeMappings)

    // 7️⃣ OBTENER PROGRESO DEL USUARIO (si hay userId)
    // V2: Deriva progreso desde article_id via topic_scope (no usa tema_number guardado)
    let userProgress: UserProgress | null = null
    if (userId) {
      userProgress = await getUserProgressForTopicV2(db, userId, scopeMappings, totalQuestions)
    }

    const response: GetTopicDataResponse = {
      success: true,
      topic,
      difficultyStats,
      totalQuestions,
      officialQuestionsCount,
      articlesByLaw,
      userProgress,
      generatedAt: new Date().toISOString(),
    }

    // Guardar en cache (solo si no hay usuario)
    if (!userId) {
      topicCache.set(cacheKey, { data: response, timestamp: Date.now() })
    }

    return response
  } catch (error) {
    console.error('Error obteniendo datos del tema:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Obtiene las preguntas para un tema basado en el mapeo de topic_scope
 */
async function getQuestionsForTopic(
  db: ReturnType<typeof getDb>,
  scopeMappings: Array<{
    articleNumbers: string[] | null
    lawId: string | null
    lawShortName: string | null
    lawName: string | null
  }>
): Promise<Array<{
  id: string
  difficulty: string | null
  globalDifficulty: string | null
  isOfficialExam: boolean | null
  examPosition: string | null
  articleNumber: string
  lawShortName: string | null
}>> {
  const allQuestions: Array<{
    id: string
    difficulty: string | null
    globalDifficulty: string | null
    isOfficialExam: boolean | null
    examPosition: string | null
    articleNumber: string
    lawShortName: string | null
  }> = []

  // Para cada mapeo, obtener las preguntas
  for (const mapping of scopeMappings) {
    if (!mapping.lawId) continue

    // Si articleNumbers es null, obtener TODAS las preguntas de la ley (leyes virtuales)
    // Si articleNumbers tiene valores, filtrar solo esos artículos
    const hasSpecificArticles = mapping.articleNumbers && mapping.articleNumbers.length > 0

    const questionsForLaw = await db
      .select({
        id: questions.id,
        difficulty: questions.difficulty,
        globalDifficulty: questions.globalDifficulty,
        isOfficialExam: questions.isOfficialExam,
        examPosition: questions.examPosition,
        articleNumber: articles.articleNumber,
        lawShortName: laws.shortName,
      })
      .from(questions)
      .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
      .innerJoin(laws, eq(articles.lawId, laws.id))
      .where(and(
        eq(questions.isActive, true),
        eq(laws.id, mapping.lawId),
        // Solo filtrar por artículos específicos si se proporcionan
        ...(hasSpecificArticles ? [inArray(articles.articleNumber, mapping.articleNumbers!)] : [])
      ))

    allQuestions.push(...questionsForLaw)
  }

  return allQuestions
}

/**
 * Procesa las estadísticas de dificultad
 */
function processDifficultyStats(
  questionResults: Array<{
    difficulty: string | null
    globalDifficulty: string | null
  }>
): DifficultyStats {
  const stats: DifficultyStats = { easy: 0, medium: 0, hard: 0, extreme: 0, auto: 0 }

  for (const q of questionResults) {
    let difficultyLevel: keyof DifficultyStats

    // Usar global_difficulty si existe, sino difficulty estática
    const globalDiff = q.globalDifficulty ? parseFloat(q.globalDifficulty) : null
    if (globalDiff !== null && !isNaN(globalDiff)) {
      if (globalDiff < 25) {
        difficultyLevel = 'easy'
      } else if (globalDiff < 50) {
        difficultyLevel = 'medium'
      } else if (globalDiff < 75) {
        difficultyLevel = 'hard'
      } else {
        difficultyLevel = 'extreme'
      }
    } else {
      difficultyLevel = (q.difficulty as keyof DifficultyStats) || 'auto'
    }

    stats[difficultyLevel] = (stats[difficultyLevel] || 0) + 1
  }

  return stats
}

/**
 * Procesa el conteo de artículos por ley
 */
function processArticlesByLaw(
  questionResults: Array<{
    articleNumber: string
    lawShortName: string | null
  }>,
  scopeMappings: Array<{
    lawShortName: string | null
    lawName: string | null
  }>
): ArticlesByLaw {
  // Agrupar artículos únicos por ley
  const articlesByLawMap = new Map<string, Set<string>>()
  const lawNames = new Map<string, string>()

  // Mapear nombres de leyes
  for (const mapping of scopeMappings) {
    if (mapping.lawShortName && mapping.lawName) {
      lawNames.set(mapping.lawShortName, mapping.lawName)
    }
  }

  // Contar artículos únicos con preguntas
  for (const q of questionResults) {
    if (!q.lawShortName) continue

    if (!articlesByLawMap.has(q.lawShortName)) {
      articlesByLawMap.set(q.lawShortName, new Set())
    }
    articlesByLawMap.get(q.lawShortName)!.add(q.articleNumber)
  }

  // Convertir a array y ordenar
  const result: ArticlesByLaw = []
  for (const [lawShortName, articlesSet] of articlesByLawMap) {
    result.push({
      lawShortName,
      lawName: lawNames.get(lawShortName) || lawShortName,
      articlesWithQuestions: articlesSet.size,
    })
  }

  return result.sort((a, b) => b.articlesWithQuestions - a.articlesWithQuestions)
}

/**
 * V2: Obtiene el progreso del usuario para un tema derivando desde article_id
 *
 * IMPORTANTE: Usa el módulo compartido topic-progress que:
 * 1. Cachea las respuestas del usuario por 30 segundos
 * 2. Filtra por scope mappings del tema
 * 3. Calcula estadísticas detalladas
 *
 * Esto permite que la misma respuesta cuente para diferentes temas según la oposición.
 */
async function getUserProgressForTopicV2(
  db: ReturnType<typeof getDb>,
  userId: string,
  scopeMappings: Array<{
    articleNumbers: string[] | null
    lawId: string | null
    lawShortName: string | null
    lawName: string | null
  }>,
  totalQuestionsAvailable: number
): Promise<UserProgress> {
  try {
    // Si no hay mappings, no hay progreso posible
    if (!scopeMappings.length) {
      return {
        totalAnswers: 0,
        overallAccuracy: 0,
        uniqueQuestionsAnswered: 0,
        totalQuestionsAvailable,
        neverSeen: totalQuestionsAvailable,
        performanceByDifficulty: {},
      }
    }

    // 1️⃣ Obtener respuestas del usuario (cacheado 30 segundos)
    const answers = await getUserAnswersWithArticles(userId)

    // 2️⃣ Filtrar por scope mappings de este tema
    const filteredAnswers = filterAnswersByScopeMappings(answers, scopeMappings)

    // 3️⃣ Calcular estadísticas
    const progress = calculateDetailedProgress(filteredAnswers, totalQuestionsAvailable)

    // 4️⃣ Convertir al formato UserProgress esperado
    return {
      totalAnswers: progress.totalAnswers,
      overallAccuracy: progress.overallAccuracy,
      uniqueQuestionsAnswered: progress.uniqueQuestionsAnswered,
      totalQuestionsAvailable,
      neverSeen: Math.max(0, totalQuestionsAvailable - progress.uniqueQuestionsAnswered),
      performanceByDifficulty: progress.performanceByDifficulty,
      recentStats: progress.recentStats,
    }
  } catch (error) {
    console.error('Error obteniendo progreso del usuario (V2):', error)
    return {
      totalAnswers: 0,
      overallAccuracy: 0,
      uniqueQuestionsAnswered: 0,
      totalQuestionsAvailable,
      neverSeen: totalQuestionsAvailable,
      performanceByDifficulty: {},
    }
  }
}

/**
 * @deprecated Usar getUserProgressForTopicV2 que deriva desde article_id
 * Obtiene el progreso del usuario para un tema (legacy - usa tema_number guardado)
 */
async function getUserProgressForTopic(
  db: ReturnType<typeof getDb>,
  userId: string,
  topicNumber: number,
  totalQuestionsAvailable: number
): Promise<UserProgress> {
  try {
    // Obtener todas las respuestas del usuario para este tema
    const userAnswers = await db
      .select({
        questionId: testQuestions.questionId,
        isCorrect: testQuestions.isCorrect,
        difficulty: testQuestions.difficulty,
        createdAt: testQuestions.createdAt,
      })
      .from(testQuestions)
      .innerJoin(tests, eq(testQuestions.testId, tests.id))
      .where(and(
        eq(tests.userId, userId),
        eq(testQuestions.temaNumber, topicNumber)
      ))

    if (!userAnswers.length) {
      return {
        totalAnswers: 0,
        overallAccuracy: 0,
        uniqueQuestionsAnswered: 0,
        totalQuestionsAvailable,
        neverSeen: totalQuestionsAvailable,
        performanceByDifficulty: {},
      }
    }

    // Calcular estadísticas
    const totalAnswers = userAnswers.length
    const correctAnswers = userAnswers.filter(a => a.isCorrect).length
    const overallAccuracy = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0

    // Preguntas únicas
    const uniqueQuestionIds = new Set(userAnswers.map(a => a.questionId))
    const uniqueQuestionsAnswered = uniqueQuestionIds.size
    const neverSeen = Math.max(0, totalQuestionsAvailable - uniqueQuestionsAnswered)

    // Performance por dificultad
    const performanceByDifficulty: UserProgress['performanceByDifficulty'] = {}
    const difficultyGroups = new Map<string, { total: number; correct: number }>()

    for (const answer of userAnswers) {
      const diff = answer.difficulty || 'auto'
      if (!difficultyGroups.has(diff)) {
        difficultyGroups.set(diff, { total: 0, correct: 0 })
      }
      const group = difficultyGroups.get(diff)!
      group.total++
      if (answer.isCorrect) group.correct++
    }

    for (const [diff, stats] of difficultyGroups) {
      performanceByDifficulty[diff] = {
        total: stats.total,
        correct: stats.correct,
        accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
      }
    }

    // Estadísticas recientes
    const now = Date.now()
    const last7Days = userAnswers.filter(a =>
      new Date(a.createdAt!).getTime() >= now - 7 * 24 * 60 * 60 * 1000
    )
    const last15Days = userAnswers.filter(a =>
      new Date(a.createdAt!).getTime() >= now - 15 * 24 * 60 * 60 * 1000
    )
    const last30Days = userAnswers.filter(a =>
      new Date(a.createdAt!).getTime() >= now - 30 * 24 * 60 * 60 * 1000
    )

    return {
      totalAnswers,
      overallAccuracy,
      uniqueQuestionsAnswered,
      totalQuestionsAvailable,
      neverSeen,
      performanceByDifficulty,
      recentStats: {
        last7Days: new Set(last7Days.map(a => a.questionId)).size,
        last15Days: new Set(last15Days.map(a => a.questionId)).size,
        last30Days: new Set(last30Days.map(a => a.questionId)).size,
      },
    }
  } catch (error) {
    console.error('Error obteniendo progreso del usuario:', error)
    return {
      totalAnswers: 0,
      overallAccuracy: 0,
      uniqueQuestionsAnswered: 0,
      totalQuestionsAvailable,
      neverSeen: totalQuestionsAvailable,
      performanceByDifficulty: {},
    }
  }
}

/**
 * Invalida el cache de un tema
 */
export function invalidateTopicCache(topicNumber: number, oposicion: OposicionKey): void {
  const cacheKey = `${oposicion}-${topicNumber}-anon`
  topicCache.delete(cacheKey)
}

/**
 * Limpia todo el cache
 */
export function clearAllTopicCache(): void {
  topicCache.clear()
}
