// lib/api/temario/queries.ts - Queries Drizzle para Temario Dinámico
import { getDb } from '@/db/client'
import { topics, topicScope, articles, laws, questions } from '@/db/schema'
import { eq, and, inArray, asc, sql, count } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import type {
  TopicContent,
  TopicSummary,
  LawWithArticles,
  UserProgress,
  UnlockRequirements,
} from './schemas'
import {
  OPOSICIONES,
  UNLOCK_THRESHOLD,
  UNLOCK_MIN_QUESTIONS,
  type OposicionSlug,
} from './schemas'

// ============================================
// OBTENER CONTENIDO COMPLETO DE UN TEMA
// ============================================

// Tipo interno para contenido cacheado (sin datos de usuario)
type TopicContentBase = {
  topicNumber: number
  title: string
  description: string | null
  oposicion: OposicionSlug
  oposicionName: string
  laws: LawWithArticles[]
  totalArticles: number
}

// Función interna que obtiene solo el contenido (sin progreso de usuario)
// Esta es la parte pesada con muchas queries que se cachea
async function getTopicContentBaseInternal(
  oposicionSlug: OposicionSlug,
  topicNumber: number
): Promise<TopicContentBase | null> {
  const db = getDb()
  const oposicion = OPOSICIONES[oposicionSlug]

  if (!oposicion) {
    return null
  }

  // 1. Obtener el topic
  const topicResult = await db
    .select({
      id: topics.id,
      topicNumber: topics.topicNumber,
      title: topics.title,
      description: topics.description,
      positionType: topics.positionType,
    })
    .from(topics)
    .where(
      and(
        eq(topics.positionType, oposicion.positionType),
        eq(topics.topicNumber, topicNumber)
      )
    )
    .limit(1)

  if (topicResult.length === 0) {
    return null
  }

  const topic = topicResult[0]

  // 2. Obtener topic_scope (qué leyes y artículos incluye)
  const scopeResult = await db
    .select({
      id: topicScope.id,
      lawId: topicScope.lawId,
      articleNumbers: topicScope.articleNumbers,
      weight: topicScope.weight,
    })
    .from(topicScope)
    .where(eq(topicScope.topicId, topic.id))

  // 3. Para cada ley en el scope, obtener la ley y sus artículos
  const lawsWithArticles: LawWithArticles[] = []
  let totalArticles = 0

  for (const scope of scopeResult) {
    if (!scope.lawId || !scope.articleNumbers) continue

    // Obtener info de la ley
    const lawResult = await db
      .select({
        id: laws.id,
        shortName: laws.shortName,
        name: laws.name,
        year: laws.year,
        boeUrl: laws.boeUrl,
      })
      .from(laws)
      .where(eq(laws.id, scope.lawId))
      .limit(1)

    if (lawResult.length === 0) continue

    const law = lawResult[0]

    // Obtener artículos de esa ley que están en el scope
    const articlesResult = await db
      .select({
        id: articles.id,
        articleNumber: articles.articleNumber,
        title: articles.title,
        content: articles.content,
        titleNumber: articles.titleNumber,
        chapterNumber: articles.chapterNumber,
        section: articles.section,
      })
      .from(articles)
      .where(
        and(
          eq(articles.lawId, scope.lawId),
          inArray(articles.articleNumber, scope.articleNumbers)
        )
      )
      .orderBy(sql`
        CASE
          WHEN ${articles.articleNumber} ~ '^[0-9]+$'
          THEN CAST(${articles.articleNumber} AS INTEGER)
          ELSE 9999
        END,
        ${articles.articleNumber}
      `)

    if (articlesResult.length > 0) {
      // Obtener conteo de preguntas oficiales por artículo
      const articleIds = articlesResult.map((a) => a.id)
      const officialCountsResult = await db
        .select({
          articleId: questions.primaryArticleId,
          count: count(),
        })
        .from(questions)
        .where(
          and(
            inArray(questions.primaryArticleId, articleIds),
            eq(questions.isOfficialExam, true),
            eq(questions.isActive, true)
          )
        )
        .groupBy(questions.primaryArticleId)

      // Crear mapa de conteos
      const officialCounts: Record<string, number> = {}
      for (const row of officialCountsResult) {
        officialCounts[row.articleId] = Number(row.count)
      }

      lawsWithArticles.push({
        law: {
          id: law.id,
          shortName: law.shortName,
          name: law.name,
          year: law.year,
          boeUrl: law.boeUrl,
        },
        articles: articlesResult.map((a) => ({
          id: a.id,
          articleNumber: a.articleNumber,
          title: a.title,
          content: a.content,
          titleNumber: a.titleNumber,
          chapterNumber: a.chapterNumber,
          section: a.section,
          officialQuestionCount: officialCounts[a.id] || 0,
        })),
        articleCount: articlesResult.length,
      })
      totalArticles += articlesResult.length
    }
  }

  return {
    topicNumber: topic.topicNumber,
    title: topic.title,
    description: topic.description,
    oposicion: oposicionSlug,
    oposicionName: oposicion.name,
    laws: lawsWithArticles,
    totalArticles,
  }
}

// 🚀 VERSIÓN CACHEADA del contenido base (1 hora de cache)
// Esto elimina las 30+ queries en cada visita
const getTopicContentBaseCached = unstable_cache(
  getTopicContentBaseInternal,
  ['topic-content-base'],
  { revalidate: 3600 } // 1 hora
)

// Función pública que combina contenido cacheado + progreso de usuario fresco
export async function getTopicContent(
  oposicionSlug: OposicionSlug,
  topicNumber: number,
  userId?: string
): Promise<TopicContent | null> {
  // 1. Obtener contenido cacheado (rápido después de la primera vez)
  const baseContent = await getTopicContentBaseCached(oposicionSlug, topicNumber)

  if (!baseContent) {
    return null
  }

  const oposicion = OPOSICIONES[oposicionSlug]

  // 2. Obtener progreso del usuario (sin cache, siempre fresco)
  let isUnlocked = topicNumber === 1
  let unlockRequirements: UnlockRequirements | null = null
  let userProgress: UserProgress | null = null

  if (userId && oposicion) {
    const progressData = await getUserTopicProgress(userId, oposicion.positionType, topicNumber)
    userProgress = progressData.currentProgress
    isUnlocked = progressData.isUnlocked
    unlockRequirements = progressData.unlockRequirements
  }

  // 3. Combinar y retornar
  return {
    ...baseContent,
    isUnlocked,
    unlockRequirements,
    userProgress,
    lastUpdated: null,
    generatedAt: new Date().toISOString(),
  }
}

// ============================================
// OBTENER PROGRESO Y ESTADO DE DESBLOQUEO
// ============================================

async function getUserTopicProgress(
  userId: string,
  positionType: string,
  topicNumber: number
): Promise<{
  currentProgress: UserProgress | null
  isUnlocked: boolean
  unlockRequirements: UnlockRequirements | null
}> {
  const db = getDb()

  // Obtener progreso del usuario desde el cache
  const cacheResult = await db.execute(
    sql`SELECT topic_number, total_questions, correct_answers, accuracy, last_practiced
        FROM user_theme_performance_cache
        WHERE user_id = ${userId}::uuid
        ORDER BY topic_number`
  )

  const progressByTopic: Record<number, { questions: number; accuracy: number; lastPracticed: string | null }> = {}

  if (cacheResult && Array.isArray(cacheResult)) {
    for (const row of cacheResult as any[]) {
      progressByTopic[row.topic_number] = {
        questions: Number(row.total_questions) || 0,
        accuracy: Number(row.accuracy) || 0,
        lastPracticed: row.last_practiced,
      }
    }
  }

  // Progreso del tema actual
  const current = progressByTopic[topicNumber]
  const currentProgress: UserProgress | null = current
    ? {
        questionsAnswered: current.questions,
        correctAnswers: Math.round((current.accuracy / 100) * current.questions),
        accuracy: current.accuracy,
        masteryLevel:
          current.accuracy >= 90 ? 'expert' : current.accuracy >= 70 ? 'good' : 'beginner',
        lastPracticed: current.lastPracticed,
      }
    : null

  // Lógica de desbloqueo
  let isUnlocked = topicNumber === 1
  let unlockRequirements: UnlockRequirements | null = null

  if (topicNumber > 1) {
    const previousTopic = topicNumber - 1
    const previous = progressByTopic[previousTopic]

    const previousAccuracy = previous?.accuracy || 0
    const previousQuestions = previous?.questions || 0

    // Desbloqueo normal: tema anterior con 70%+ y 10+ preguntas
    isUnlocked = previousAccuracy >= UNLOCK_THRESHOLD && previousQuestions >= UNLOCK_MIN_QUESTIONS

    // Desbloqueo alternativo: progreso propio suficiente
    if (!isUnlocked && current) {
      isUnlocked = current.questions >= 20 && current.accuracy >= 75
    }

    unlockRequirements = {
      requiredAccuracy: UNLOCK_THRESHOLD,
      requiredQuestions: UNLOCK_MIN_QUESTIONS,
      currentAccuracy: current?.accuracy || 0,
      currentQuestions: current?.questions || 0,
      previousTopicNumber: previousTopic,
      previousTopicAccuracy: previousAccuracy,
    }
  }

  return { currentProgress, isUnlocked, unlockRequirements }
}

// ============================================
// OBTENER LISTA DE TEMAS
// ============================================

export async function getTopicList(
  oposicionSlug: OposicionSlug,
  userId?: string
): Promise<TopicSummary[]> {
  const db = getDb()
  const oposicion = OPOSICIONES[oposicionSlug]

  if (!oposicion) {
    return []
  }

  // 1. Obtener todos los topics de esta oposición
  const topicsResult = await db
    .select({
      id: topics.id,
      topicNumber: topics.topicNumber,
      title: topics.title,
      description: topics.description,
    })
    .from(topics)
    .where(eq(topics.positionType, oposicion.positionType))
    .orderBy(asc(topics.topicNumber))

  // 2. Obtener conteo de artículos por topic desde topic_scope
  const scopeCounts: Record<string, { articles: number; laws: number }> = {}

  for (const topic of topicsResult) {
    const scopeResult = await db
      .select({
        articleNumbers: topicScope.articleNumbers,
        lawId: topicScope.lawId,
      })
      .from(topicScope)
      .where(eq(topicScope.topicId, topic.id))

    let articlesCount = 0
    const lawIds = new Set<string>()

    for (const scope of scopeResult) {
      if (scope.articleNumbers) {
        articlesCount += scope.articleNumbers.length
      }
      if (scope.lawId) {
        lawIds.add(scope.lawId)
      }
    }

    scopeCounts[topic.id] = { articles: articlesCount, laws: lawIds.size }
  }

  // 3. Obtener progreso del usuario si está autenticado
  let userProgressByTopic: Record<number, number> = {}

  if (userId) {
    const cacheResult = await db.execute(
      sql`SELECT topic_number, accuracy
          FROM user_theme_performance_cache
          WHERE user_id = ${userId}::uuid`
    )

    if (cacheResult && Array.isArray(cacheResult)) {
      for (const row of cacheResult as any[]) {
        userProgressByTopic[row.topic_number] = Number(row.accuracy) || 0
      }
    }
  }

  // 4. Construir lista con estado de desbloqueo
  const result: TopicSummary[] = []
  let previousUnlocked = true // Tema 1 siempre está desbloqueado para el anterior

  for (const topic of topicsResult) {
    const counts = scopeCounts[topic.id] || { articles: 0, laws: 0 }
    const progress = userProgressByTopic[topic.topicNumber]

    // Lógica de desbloqueo simplificada para lista
    let isUnlocked = topic.topicNumber === 1

    if (topic.topicNumber > 1 && userId) {
      const prevProgress = userProgressByTopic[topic.topicNumber - 1]
      isUnlocked = (prevProgress || 0) >= UNLOCK_THRESHOLD
    } else if (!userId) {
      // Usuario no autenticado: solo tema 1
      isUnlocked = topic.topicNumber === 1
    }

    result.push({
      topicNumber: topic.topicNumber,
      title: topic.title,
      description: topic.description,
      isUnlocked,
      userProgress: progress ?? null,
      articlesCount: counts.articles,
      lawsCount: counts.laws,
    })

    previousUnlocked = isUnlocked
  }

  return result
}
