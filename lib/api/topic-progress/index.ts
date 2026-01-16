// lib/api/topic-progress/index.ts
// Módulo unificado para progreso de usuario por tema
//
// Este módulo centraliza la lógica V2 que deriva estadísticas
// desde article_id + topic_scope por oposición.
//
// Usado por:
// - theme-stats: Estadísticas de todos los temas
// - topic-data: Progreso en un tema específico
// - weak-articles: Artículos débiles por tema

// ============================================
// EXPORTS: MAPPING (caché 30 días)
// ============================================

export {
  getArticleTopicMapping,
  invalidateArticleTopicMapping,
  clearAllArticleTopicMappings,
  getArticleTopicMappingCacheStats,
  type ArticleTopicMapping,
} from './mapping'

// ============================================
// EXPORTS: USER ANSWERS (caché 30 segundos)
// ============================================

export {
  getUserAnswersWithArticles,
  invalidateUserAnswersCache,
  clearAllUserAnswersCache,
  type UserAnswer,
} from './user-answers'

// ============================================
// EXPORTS: STATS (agregación en memoria)
// ============================================

export {
  aggregateStatsByTopic,
  getStatsForTopic,
  filterAnswersByScopeMappings,
  calculateDetailedProgress,
  type TopicStat,
  type TopicStats,
  type DetailedTopicProgress,
} from './stats'

// ============================================
// EXPORTS: WEAK ARTICLES (existente)
// ============================================

export {
  weakArticleSchema,
  topicProgressSchema,
  getTopicProgressRequestSchema,
  getTopicProgressResponseSchema,
  getWeakArticlesRequestSchema,
  getWeakArticlesResponseSchema,
  safeParseGetTopicProgress,
  safeParseGetWeakArticles,
  type WeakArticle,
  type TopicProgress,
  type GetTopicProgressRequest,
  type GetTopicProgressResponse,
  type GetWeakArticlesRequest,
  type GetWeakArticlesResponse,
} from './schemas'

export {
  getWeakArticlesForUser,
} from './queries'

// ============================================
// CONSTANTES COMPARTIDAS
// ============================================

export const OPOSICION_TO_POSITION_TYPE: Record<string, string> = {
  'auxiliar-administrativo-estado': 'auxiliar_administrativo',
  'administrativo-estado': 'administrativo',
  'tramitacion-procesal': 'tramitacion_procesal',
  'auxilio-judicial': 'auxilio_judicial',
  'gestion-procesal': 'gestion_procesal',
}

export const POSITION_TYPE_TO_OPOSICION: Record<string, string> = {
  'auxiliar_administrativo': 'auxiliar-administrativo-estado',
  'administrativo': 'administrativo-estado',
  'tramitacion_procesal': 'tramitacion-procesal',
  'auxilio_judicial': 'auxilio-judicial',
  'gestion_procesal': 'gestion-procesal',
}

// ============================================
// FUNCIONES DE ALTO NIVEL
// ============================================

import {
  getArticleTopicMapping,
  invalidateArticleTopicMapping,
} from './mapping'
import {
  getUserAnswersWithArticles,
  invalidateUserAnswersCache,
} from './user-answers'
import {
  aggregateStatsByTopic,
  getStatsForTopic,
  type TopicStats,
  type DetailedTopicProgress,
} from './stats'

/**
 * Obtiene todas las estadísticas por tema para un usuario en una oposición.
 *
 * Función de conveniencia que combina:
 * 1. getArticleTopicMapping (cacheado 30 días)
 * 2. getUserAnswersWithArticles (cacheado 30 segundos)
 * 3. aggregateStatsByTopic (en memoria)
 *
 * @param userId - ID del usuario
 * @param oposicionSlug - Slug de la oposición (ej: 'auxiliar-administrativo-estado')
 * @returns Estadísticas por tema
 */
export async function getAllTopicStatsForUser(
  userId: string,
  oposicionSlug: string
): Promise<{
  success: boolean
  stats?: TopicStats
  error?: string
}> {
  try {
    const positionType = OPOSICION_TO_POSITION_TYPE[oposicionSlug]
    if (!positionType) {
      return {
        success: false,
        error: `Oposición no válida: ${oposicionSlug}`,
      }
    }

    const mapping = await getArticleTopicMapping(positionType)
    const answers = await getUserAnswersWithArticles(userId)
    const stats = aggregateStatsByTopic(answers, mapping)

    return { success: true, stats }
  } catch (error) {
    console.error('[topic-progress] Error en getAllTopicStatsForUser:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Obtiene el progreso de un usuario en un tema específico.
 *
 * @param userId - ID del usuario
 * @param oposicionSlug - Slug de la oposición
 * @param topicNumber - Número del tema
 * @param totalQuestionsAvailable - Total de preguntas disponibles (opcional)
 * @returns Progreso detallado del tema
 */
export async function getTopicProgressForUser(
  userId: string,
  oposicionSlug: string,
  topicNumber: number,
  totalQuestionsAvailable: number = 0
): Promise<{
  success: boolean
  progress?: DetailedTopicProgress
  error?: string
}> {
  try {
    const positionType = OPOSICION_TO_POSITION_TYPE[oposicionSlug]
    if (!positionType) {
      return {
        success: false,
        error: `Oposición no válida: ${oposicionSlug}`,
      }
    }

    const mapping = await getArticleTopicMapping(positionType)
    const answers = await getUserAnswersWithArticles(userId)
    const progress = getStatsForTopic(answers, mapping, topicNumber, totalQuestionsAvailable)

    return { success: true, progress }
  } catch (error) {
    console.error('[topic-progress] Error en getTopicProgressForUser:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// INVALIDACIÓN GLOBAL
// ============================================

/**
 * Invalida todos los cachés para un usuario.
 * Llamar después de que el usuario responda preguntas.
 */
export function invalidateUserCaches(userId: string): void {
  invalidateUserAnswersCache(userId)
}

/**
 * Invalida el caché de mapeo para una oposición.
 * Llamar si cambia topic_scope.
 */
export function invalidateMappingCache(oposicionSlug: string): void {
  const positionType = OPOSICION_TO_POSITION_TYPE[oposicionSlug]
  if (positionType) {
    invalidateArticleTopicMapping(positionType)
  }
}

/**
 * Limpia todos los cachés del módulo.
 */
export function clearAllCaches(): void {
  const { clearAllArticleTopicMappings } = require('./mapping')
  const { clearAllUserAnswersCache } = require('./user-answers')

  clearAllArticleTopicMappings()
  clearAllUserAnswersCache()
}
