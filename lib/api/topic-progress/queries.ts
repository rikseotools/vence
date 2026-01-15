// lib/api/topic-progress/queries.ts
// Queries tipadas para progreso por tema y artículos débiles usando Drizzle
import { getDb } from '@/db/client'
import {
  userQuestionHistory,
  questions,
  articles,
  laws,
  topicScope,
  topics,
} from '@/db/schema'
import { eq, and, lt, gte, sql } from 'drizzle-orm'
import type {
  GetWeakArticlesRequest,
  GetWeakArticlesResponse,
  WeakArticle,
} from './schemas'

// ============================================
// OBTENER ARTÍCULOS DÉBILES POR TEMA
// ============================================

interface ArticleToTopicMap {
  [key: string]: number // law_id_articleNumber -> topicNumber
}

interface WeakArticleAggregate {
  lawName: string
  articleNumber: string
  failedCount: number
  rates: number[]
}

/**
 * Obtiene los artículos débiles del usuario agrupados por tema
 * Un artículo débil es aquel donde el usuario tiene success_rate < maxSuccessRate
 * con al menos minAttempts intentos
 */
export async function getWeakArticlesForUser(
  params: GetWeakArticlesRequest
): Promise<GetWeakArticlesResponse> {
  const {
    userId,
    minAttempts = 2,
    maxSuccessRate = 60,
    maxPerTopic = 5,
    positionType,
  } = params

  try {
    const db = getDb()

    console.log(`🎯 [DRIZZLE/weak-articles] Getting weak articles for user ${userId.substring(0, 8)}...`)

    // Paso 1: Construir mapeo artículo -> tema desde topic_scope
    const scopeQuery = db
      .select({
        topicId: topicScope.topicId,
        lawId: topicScope.lawId,
        articleNumbers: topicScope.articleNumbers,
        topicNumber: topics.topicNumber,
        positionType: topics.positionType,
      })
      .from(topicScope)
      .innerJoin(topics, eq(topicScope.topicId, topics.id))

    const scopes = await scopeQuery

    // Filtrar por positionType si se especifica
    const filteredScopes = positionType
      ? scopes.filter(s => s.positionType === positionType)
      : scopes

    // Construir mapeo: law_id_articleNumber -> topicNumber (1-indexed)
    const articleToTopic: ArticleToTopicMap = {}
    filteredScopes.forEach(s => {
      if (!s.topicNumber || !s.lawId || !s.articleNumbers) return
      s.articleNumbers.forEach(artNum => {
        if (!artNum) return
        const key = `${s.lawId}_${artNum}`
        articleToTopic[key] = s.topicNumber + 1 // Convertir a 1-indexed
      })
    })

    console.log(`🎯 [DRIZZLE/weak-articles] Built article->topic mapping with ${Object.keys(articleToTopic).length} entries`)

    // Paso 2: Obtener preguntas débiles del usuario con info de artículo
    const weakQuestions = await db
      .select({
        successRate: userQuestionHistory.successRate,
        totalAttempts: userQuestionHistory.totalAttempts,
        articleNumber: articles.articleNumber,
        lawId: articles.lawId,
        lawName: laws.shortName,
      })
      .from(userQuestionHistory)
      .innerJoin(questions, eq(userQuestionHistory.questionId, questions.id))
      .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
      .innerJoin(laws, eq(articles.lawId, laws.id))
      .where(
        and(
          eq(userQuestionHistory.userId, userId),
          lt(userQuestionHistory.successRate, String(maxSuccessRate)),
          gte(userQuestionHistory.totalAttempts, minAttempts)
        )
      )

    console.log(`🎯 [DRIZZLE/weak-articles] Found ${weakQuestions.length} weak questions`)

    if (weakQuestions.length === 0) {
      return {
        success: true,
        weakArticlesByTopic: {},
      }
    }

    // Paso 3: Agrupar por tema y artículo
    const weakByTopic: Record<number, Record<string, WeakArticleAggregate>> = {}

    weakQuestions.forEach(q => {
      if (!q.lawId || !q.articleNumber) return

      const key = `${q.lawId}_${q.articleNumber}`
      const topicNum = articleToTopic[key]
      if (!topicNum) return

      if (!weakByTopic[topicNum]) {
        weakByTopic[topicNum] = {}
      }

      const artKey = `${q.lawName || '?'}_${q.articleNumber}`
      if (!weakByTopic[topicNum][artKey]) {
        weakByTopic[topicNum][artKey] = {
          lawName: q.lawName || '?',
          articleNumber: q.articleNumber,
          failedCount: 0,
          rates: [],
        }
      }

      weakByTopic[topicNum][artKey].failedCount++
      const rate = parseFloat(q.successRate || '0')
      weakByTopic[topicNum][artKey].rates.push(rate)
    })

    // Paso 4: Calcular promedio y convertir a formato final
    const result: Record<string, WeakArticle[]> = {}

    Object.entries(weakByTopic).forEach(([topicNum, articlesMap]) => {
      result[topicNum] = Object.values(articlesMap)
        .map(a => ({
          lawName: a.lawName,
          articleNumber: a.articleNumber,
          failedCount: a.failedCount,
          avgSuccessRate: Math.round(
            a.rates.reduce((sum, r) => sum + r, 0) / a.rates.length
          ),
        }))
        .sort((a, b) => a.avgSuccessRate - b.avgSuccessRate)
        .slice(0, maxPerTopic)
    })

    console.log(`🎯 [DRIZZLE/weak-articles] Returning weak articles for ${Object.keys(result).length} topics`)

    return {
      success: true,
      weakArticlesByTopic: result,
    }

  } catch (error) {
    console.error('❌ [DRIZZLE/weak-articles] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
