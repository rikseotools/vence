// lib/api/temario/queries.ts - Queries Drizzle para Temario Dinámico
// NOTA: Simplificado - ya no hay sistema de bloqueo, todos los temas son accesibles
import { getDb } from '@/db/client'
import { topics, topicScope, articles, laws, questions } from '@/db/schema'
import { eq, and, inArray, sql, count } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import type {
  TopicContent,
  LawWithArticles,
} from './schemas'
import {
  OPOSICIONES,
  type OposicionSlug,
} from './schemas'

// ============================================
// OBTENER CONTENIDO COMPLETO DE UN TEMA
// ============================================

// Tipo interno para contenido cacheado
type TopicContentBase = {
  topicNumber: number
  title: string
  description: string | null
  oposicion: OposicionSlug
  oposicionName: string
  laws: LawWithArticles[]
  totalArticles: number
}

// Función interna que obtiene el contenido del tema
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
const getTopicContentBaseCached = unstable_cache(
  getTopicContentBaseInternal,
  ['topic-content-base'],
  { revalidate: 3600 } // 1 hora
)

// Función pública para obtener contenido del tema
export async function getTopicContent(
  oposicionSlug: OposicionSlug,
  topicNumber: number
): Promise<TopicContent | null> {
  const baseContent = await getTopicContentBaseCached(oposicionSlug, topicNumber)

  if (!baseContent) {
    return null
  }

  // Todos los temas están desbloqueados (ya no hay sistema de bloqueo)
  return {
    ...baseContent,
    isUnlocked: true,
    unlockRequirements: null,
    userProgress: null,
    lastUpdated: null,
    generatedAt: new Date().toISOString(),
  }
}
