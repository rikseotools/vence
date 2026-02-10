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
// OPTIMIZADA: Usa queries en batch en lugar de N+1
async function getTopicContentBaseInternal(
  oposicionSlug: OposicionSlug,
  topicNumber: number
): Promise<TopicContentBase | null> {
  const db = getDb()
  const oposicion = OPOSICIONES[oposicionSlug]

  if (!oposicion) {
    return null
  }

  // 1. Obtener topic + scope en una sola query con subquery
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

  // 2. Obtener topic_scope
  const scopeResult = await db
    .select({
      id: topicScope.id,
      lawId: topicScope.lawId,
      articleNumbers: topicScope.articleNumbers,
      weight: topicScope.weight,
    })
    .from(topicScope)
    .where(eq(topicScope.topicId, topic.id))

  // Filtrar scopes válidos y extraer lawIds únicos
  const validScopes = scopeResult.filter(s => s.lawId && s.articleNumbers && s.articleNumbers.length > 0)
  if (validScopes.length === 0) {
    return {
      topicNumber: topic.topicNumber,
      title: topic.title,
      description: topic.description,
      oposicion: oposicionSlug,
      oposicionName: oposicion.name,
      laws: [],
      totalArticles: 0,
    }
  }

  const lawIds = [...new Set(validScopes.map(s => s.lawId!))]

  // 3. Obtener TODAS las leyes en una sola query
  const lawsResult = await db
    .select({
      id: laws.id,
      shortName: laws.shortName,
      name: laws.name,
      year: laws.year,
      boeUrl: laws.boeUrl,
    })
    .from(laws)
    .where(inArray(laws.id, lawIds))

  // Crear mapa de leyes para lookup rápido
  const lawsMap = new Map(lawsResult.map(l => [l.id, l]))

  // 4. Obtener artículos por ley - queries separadas para evitar timeout
  // con muchos parámetros IN (problema cuando hay 4+ leyes con 90+ artículos)
  const scopeByLaw = new Map<string, string[]>()

  for (const scope of validScopes) {
    const existing = scopeByLaw.get(scope.lawId!) || []
    scopeByLaw.set(scope.lawId!, [...existing, ...scope.articleNumbers!])
  }

  // Query separada por cada ley - usa mejor el índice (law_id, article_number)
  const filteredArticles: {
    id: string
    lawId: string | null
    articleNumber: string
    title: string | null
    content: string | null
    titleNumber: string | null
    chapterNumber: string | null
    section: string | null
  }[] = []

  // Ejecutar queries en paralelo para cada ley
  const articlePromises = Array.from(scopeByLaw.entries()).map(async ([lawId, articleNums]) => {
    const uniqueArticleNums = [...new Set(articleNums)]
    const result = await db
      .select({
        id: articles.id,
        lawId: articles.lawId,
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
          eq(articles.lawId, lawId),
          inArray(articles.articleNumber, uniqueArticleNums)
        )
      )
    return result
  })

  const articlesResults = await Promise.all(articlePromises)
  for (const result of articlesResults) {
    filteredArticles.push(...result)
  }

  // 5. Obtener conteos de preguntas oficiales en UNA sola query
  const allArticleIds = filteredArticles.map(a => a.id)
  let officialCounts: Record<string, number> = {}

  if (allArticleIds.length > 0) {
    const countsResult = await db
      .select({
        articleId: questions.primaryArticleId,
        count: count(),
      })
      .from(questions)
      .where(
        and(
          inArray(questions.primaryArticleId, allArticleIds),
          eq(questions.isOfficialExam, true),
          eq(questions.isActive, true)
        )
      )
      .groupBy(questions.primaryArticleId)

    for (const row of countsResult) {
      officialCounts[row.articleId!] = Number(row.count)
    }
  }

  // 6. Agrupar artículos por ley y construir resultado
  const articlesByLaw = new Map<string, typeof filteredArticles>()
  for (const article of filteredArticles) {
    const existing = articlesByLaw.get(article.lawId!) || []
    existing.push(article)
    articlesByLaw.set(article.lawId!, existing)
  }

  const lawsWithArticles: LawWithArticles[] = []
  let totalArticles = 0

  // Ordenar por weight del scope (si existe)
  const sortedLawIds = validScopes
    .sort((a, b) => (Number(a.weight) || 0) - (Number(b.weight) || 0))
    .map(s => s.lawId!)
    .filter((v, i, a) => a.indexOf(v) === i) // unique

  for (const lawId of sortedLawIds) {
    const law = lawsMap.get(lawId)
    if (!law) continue

    const lawArticles = articlesByLaw.get(lawId) || []
    if (lawArticles.length === 0) continue

    // Ordenar artículos numéricamente
    const sortedArticles = [...lawArticles].sort((a, b) => {
      const numA = parseInt(a.articleNumber) || 9999
      const numB = parseInt(b.articleNumber) || 9999
      return numA - numB
    })

    lawsWithArticles.push({
      law: {
        id: law.id,
        shortName: law.shortName,
        name: law.name,
        year: law.year,
        boeUrl: law.boeUrl,
      },
      articles: sortedArticles.map(a => ({
        id: a.id,
        articleNumber: a.articleNumber,
        title: a.title,
        content: a.content,
        titleNumber: a.titleNumber,
        chapterNumber: a.chapterNumber,
        section: a.section,
        officialQuestionCount: officialCounts[a.id] || 0,
      })),
      articleCount: sortedArticles.length,
    })
    totalArticles += sortedArticles.length
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

// 🚀 VERSIÓN CACHEADA del contenido base (cache permanente)
// El contenido de leyes/artículos casi nunca cambia
// Para invalidar manualmente: revalidateTag('temario')
const getTopicContentBaseCached = unstable_cache(
  getTopicContentBaseInternal,
  ['topic-content-base'],
  { revalidate: false, tags: ['temario'] }
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
