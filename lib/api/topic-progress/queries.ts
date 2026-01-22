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
  totalAttempts: number
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
    minAttempts = 1,
    maxSuccessRate = 60,
    maxPerTopic = 5,
    positionType,
  } = params

  try {
    const db = getDb()

    console.log(`🎯 [DRIZZLE/weak-articles] Getting weak articles for user ${userId.substring(0, 8)}...`)

    // Paso 1: Construir mapeo artículo -> tema desde topic_scope
    // Filtrar por positionType directamente en SQL para mejor rendimiento
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

    // Aplicar filtro de positionType en SQL si se especifica
    const scopes = positionType
      ? await scopeQuery.where(eq(topics.positionType, positionType))
      : await scopeQuery

    const filteredScopes = scopes

    // Construir mapeo: law_id_articleNumber -> topicNumber
    // NOTA: topic_number en BD ya es 1-indexed (empieza en 1)
    const articleToTopic: ArticleToTopicMap = {}
    filteredScopes.forEach(s => {
      if (!s.topicNumber || !s.lawId || !s.articleNumbers) return
      s.articleNumbers.forEach(artNum => {
        if (!artNum) return
        const key = `${s.lawId}_${artNum}`
        articleToTopic[key] = s.topicNumber // Ya es 1-indexed
      })
    })

    console.log(`🎯 [DRIZZLE/weak-articles] Built article->topic mapping with ${Object.keys(articleToTopic).length} entries`)

    // Debug: buscar si hay entries de Reglamento del Congreso (law_id d7addcab...)
    const rcEntries = Object.entries(articleToTopic).filter(([k]) => k.startsWith('d7addcab'))
    if (rcEntries.length > 0) {
      console.log(`🔍 [DEBUG] Reglamento del Congreso entries in mapping: ${rcEntries.map(([k, v]) => `${k}->T${v}`).join(', ')}`)
    } else {
      console.log(`🔍 [DEBUG] NO Reglamento del Congreso entries found in articleToTopic mapping!`)
    }

    // Paso 2: Obtener preguntas débiles del usuario con info de artículo
    // success_rate está en escala 0-1, convertir maxSuccessRate de porcentaje a decimal
    const maxSuccessRateDecimal = maxSuccessRate / 100
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
          lt(userQuestionHistory.successRate, String(maxSuccessRateDecimal)),
          gte(userQuestionHistory.totalAttempts, minAttempts)
        )
      )

    console.log(`🎯 [DRIZZLE/weak-articles] Found ${weakQuestions.length} weak questions`)

    // Debug: mostrar todas las preguntas débiles encontradas
    weakQuestions.forEach(q => {
      const key = `${q.lawId}_${q.articleNumber}`
      const topicNum = articleToTopic[key]
      console.log(`🔍 [DEBUG] Weak question: ${q.lawName}:${q.articleNumber} (rate=${q.successRate}, attempts=${q.totalAttempts}) -> key=${key} -> topic=${topicNum || 'NO MAPPING'}`)
    })

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
          totalAttempts: 0,
          rates: [],
        }
      }

      weakByTopic[topicNum][artKey].failedCount++
      weakByTopic[topicNum][artKey].totalAttempts += Number(q.totalAttempts) || 0
      // success_rate está en escala 0-1, convertir a 0-100
      const rate = parseFloat(q.successRate || '0') * 100
      weakByTopic[topicNum][artKey].rates.push(rate)
    })

    // Paso 4: Calcular promedio y convertir a formato final
    const result: Record<string, WeakArticle[]> = {}

    Object.entries(weakByTopic).forEach(([topicNum, articlesMap]) => {
      result[topicNum] = Object.values(articlesMap)
        .map(a => {
          const avgSuccessRate = Math.round(
            a.rates.reduce((sum, r) => sum + r, 0) / a.rates.length
          )
          // Calcular aciertos estimados: totalAttempts * (avgSuccessRate / 100)
          const correctCount = Math.round(a.totalAttempts * (avgSuccessRate / 100))
          return {
            lawName: a.lawName,
            articleNumber: a.articleNumber,
            failedCount: a.failedCount,
            totalAttempts: a.totalAttempts,
            correctCount,
            avgSuccessRate,
          }
        })
        .sort((a, b) => a.avgSuccessRate - b.avgSuccessRate)
        .slice(0, maxPerTopic)
    })

    console.log(`🎯 [DRIZZLE/weak-articles] Returning weak articles for ${Object.keys(result).length} topics: [${Object.keys(result).join(', ')}]`)
    // Debug: mostrar artículos por tema
    Object.entries(result).forEach(([topic, articles]) => {
      console.log(`🎯 [DRIZZLE/weak-articles] Topic ${topic}: ${articles.length} articles - ${articles.map(a => a.lawName + ':' + a.articleNumber).join(', ')}`)
    })

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
