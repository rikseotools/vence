// lib/api/topic-progress/stats.ts
// Funciones de agregación de estadísticas por tema

import type { ArticleTopicMapping } from './mapping'
import type { UserAnswer } from './user-answers'

// ============================================
// TIPOS
// ============================================

export interface TopicStat {
  temaNumber: number
  total: number
  correct: number
  accuracy: number
  lastStudy: string | null
  lastStudyFormatted: string
}

export interface TopicStats {
  [topicNumber: string]: TopicStat
}

export interface DetailedTopicProgress {
  totalAnswers: number
  correctAnswers: number
  overallAccuracy: number
  uniqueQuestionsAnswered: number
  lastStudy: Date | null
  performanceByDifficulty: {
    [difficulty: string]: {
      total: number
      correct: number
      accuracy: number
    }
  }
  recentStats?: {
    last7Days: number
    last15Days: number
    last30Days: number
  }
}

// ============================================
// AGREGACIÓN PARA TODOS LOS TEMAS
// ============================================

/**
 * Agrega respuestas del usuario por tema usando el mapeo article→topic.
 *
 * Usado por theme-stats para mostrar resumen de todos los temas.
 *
 * @param answers - Respuestas del usuario con info de artículo
 * @param mapping - Mapeo article→topic
 * @returns Estadísticas por tema
 */
export function aggregateStatsByTopic(
  answers: UserAnswer[],
  mapping: ArticleTopicMapping
): TopicStats {
  const statsByTopic: Record<number, {
    total: number
    correct: number
    lastStudy: Date | null
  }> = {}

  for (const answer of answers) {
    const key = `${answer.lawId}_${answer.articleNumber}`
    const topicNumber = mapping[key]

    if (topicNumber === undefined) continue // Artículo no está en ningún tema

    if (!statsByTopic[topicNumber]) {
      statsByTopic[topicNumber] = { total: 0, correct: 0, lastStudy: null }
    }

    statsByTopic[topicNumber].total++
    if (answer.isCorrect) {
      statsByTopic[topicNumber].correct++
    }

    if (!statsByTopic[topicNumber].lastStudy || answer.createdAt > statsByTopic[topicNumber].lastStudy) {
      statsByTopic[topicNumber].lastStudy = answer.createdAt
    }
  }

  // Formatear resultado
  const stats: TopicStats = {}

  for (const [topicNumStr, data] of Object.entries(statsByTopic)) {
    const topicNumber = parseInt(topicNumStr, 10)
    const accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0

    stats[topicNumStr] = {
      temaNumber: topicNumber,
      total: data.total,
      correct: data.correct,
      accuracy,
      lastStudy: data.lastStudy?.toISOString() || null,
      lastStudyFormatted: data.lastStudy
        ? data.lastStudy.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short'
          })
        : 'Nunca'
    }
  }

  return stats
}

// ============================================
// AGREGACIÓN PARA UN TEMA ESPECÍFICO
// ============================================

/**
 * Obtiene estadísticas detalladas para un tema específico.
 *
 * Usado por topic-data para mostrar progreso en un tema.
 *
 * @param answers - Respuestas del usuario con info de artículo
 * @param mapping - Mapeo article→topic
 * @param topicNumber - Número del tema a filtrar
 * @param totalQuestionsAvailable - Total de preguntas disponibles en el tema
 * @returns Progreso detallado del tema
 */
export function getStatsForTopic(
  answers: UserAnswer[],
  mapping: ArticleTopicMapping,
  topicNumber: number,
  totalQuestionsAvailable: number = 0
): DetailedTopicProgress {
  // Filtrar respuestas que pertenecen a este tema
  const topicAnswers = answers.filter(answer => {
    const key = `${answer.lawId}_${answer.articleNumber}`
    return mapping[key] === topicNumber
  })

  if (topicAnswers.length === 0) {
    return {
      totalAnswers: 0,
      correctAnswers: 0,
      overallAccuracy: 0,
      uniqueQuestionsAnswered: 0,
      lastStudy: null,
      performanceByDifficulty: {},
      recentStats: {
        last7Days: 0,
        last15Days: 0,
        last30Days: 0,
      },
    }
  }

  // Calcular estadísticas básicas
  const totalAnswers = topicAnswers.length
  const correctAnswers = topicAnswers.filter(a => a.isCorrect).length
  const overallAccuracy = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0

  // Preguntas únicas
  const uniqueQuestionIds = new Set(topicAnswers.map(a => a.questionId))
  const uniqueQuestionsAnswered = uniqueQuestionIds.size

  // Última respuesta
  const lastStudy = topicAnswers.reduce((latest, answer) => {
    if (!latest || answer.createdAt > latest) return answer.createdAt
    return latest
  }, null as Date | null)

  // Performance por dificultad
  const performanceByDifficulty: DetailedTopicProgress['performanceByDifficulty'] = {}
  const difficultyGroups = new Map<string, { total: number; correct: number }>()

  for (const answer of topicAnswers) {
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
  const last7Days = topicAnswers.filter(a =>
    a.createdAt.getTime() >= now - 7 * 24 * 60 * 60 * 1000
  )
  const last15Days = topicAnswers.filter(a =>
    a.createdAt.getTime() >= now - 15 * 24 * 60 * 60 * 1000
  )
  const last30Days = topicAnswers.filter(a =>
    a.createdAt.getTime() >= now - 30 * 24 * 60 * 60 * 1000
  )

  return {
    totalAnswers,
    correctAnswers,
    overallAccuracy,
    uniqueQuestionsAnswered,
    lastStudy,
    performanceByDifficulty,
    recentStats: {
      last7Days: new Set(last7Days.map(a => a.questionId)).size,
      last15Days: new Set(last15Days.map(a => a.questionId)).size,
      last30Days: new Set(last30Days.map(a => a.questionId)).size,
    },
  }
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Filtra respuestas que pertenecen a un conjunto de artículos específicos.
 *
 * Útil cuando topic-data ya tiene los scopeMappings y no necesita el mapeo global.
 *
 * @param answers - Respuestas del usuario
 * @param scopeMappings - Mapeo específico del tema (law_id + article_numbers[])
 * @returns Respuestas filtradas
 */
export function filterAnswersByScopeMappings(
  answers: UserAnswer[],
  scopeMappings: Array<{
    lawId: string | null
    articleNumbers: string[] | null
  }>
): UserAnswer[] {
  // Construir set de claves válidas
  const validKeys = new Set<string>()

  for (const mapping of scopeMappings) {
    if (!mapping.lawId) continue

    if (mapping.articleNumbers && mapping.articleNumbers.length > 0) {
      // Artículos específicos
      for (const articleNum of mapping.articleNumbers) {
        validKeys.add(`${mapping.lawId}_${articleNum}`)
      }
    } else {
      // Toda la ley - marcar con prefijo especial
      validKeys.add(`LAW:${mapping.lawId}`)
    }
  }

  return answers.filter(answer => {
    const articleKey = `${answer.lawId}_${answer.articleNumber}`
    const lawKey = `LAW:${answer.lawId}`

    return validKeys.has(articleKey) || validKeys.has(lawKey)
  })
}

/**
 * Calcula estadísticas detalladas desde respuestas ya filtradas.
 *
 * @param filteredAnswers - Respuestas ya filtradas por tema
 * @param totalQuestionsAvailable - Total de preguntas disponibles
 * @returns Progreso detallado
 */
export function calculateDetailedProgress(
  filteredAnswers: UserAnswer[],
  totalQuestionsAvailable: number = 0
): DetailedTopicProgress {
  if (filteredAnswers.length === 0) {
    return {
      totalAnswers: 0,
      correctAnswers: 0,
      overallAccuracy: 0,
      uniqueQuestionsAnswered: 0,
      lastStudy: null,
      performanceByDifficulty: {},
      recentStats: {
        last7Days: 0,
        last15Days: 0,
        last30Days: 0,
      },
    }
  }

  const totalAnswers = filteredAnswers.length
  const correctAnswers = filteredAnswers.filter(a => a.isCorrect).length
  const overallAccuracy = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0

  const uniqueQuestionIds = new Set(filteredAnswers.map(a => a.questionId))
  const uniqueQuestionsAnswered = uniqueQuestionIds.size

  const lastStudy = filteredAnswers.reduce((latest, answer) => {
    if (!latest || answer.createdAt > latest) return answer.createdAt
    return latest
  }, null as Date | null)

  // Performance por dificultad
  const performanceByDifficulty: DetailedTopicProgress['performanceByDifficulty'] = {}
  const difficultyGroups = new Map<string, { total: number; correct: number }>()

  for (const answer of filteredAnswers) {
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
  const last7Days = filteredAnswers.filter(a =>
    a.createdAt.getTime() >= now - 7 * 24 * 60 * 60 * 1000
  )
  const last15Days = filteredAnswers.filter(a =>
    a.createdAt.getTime() >= now - 15 * 24 * 60 * 60 * 1000
  )
  const last30Days = filteredAnswers.filter(a =>
    a.createdAt.getTime() >= now - 30 * 24 * 60 * 60 * 1000
  )

  return {
    totalAnswers,
    correctAnswers,
    overallAccuracy,
    uniqueQuestionsAnswered,
    lastStudy,
    performanceByDifficulty,
    recentStats: {
      last7Days: new Set(last7Days.map(a => a.questionId)).size,
      last15Days: new Set(last15Days.map(a => a.questionId)).size,
      last30Days: new Set(last30Days.map(a => a.questionId)).size,
    },
  }
}
