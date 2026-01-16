// lib/api/theme-stats/queries.ts - Queries optimizadas para estadísticas por tema
// V2: Usa módulo compartido topic-progress para derivar stats desde article_id + topic_scope

import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import type { GetThemeStatsResponse, ThemeStat, OposicionSlug } from './schemas'
import { OPOSICION_TO_POSITION_TYPE } from './schemas'

// Importar módulo compartido
import {
  getArticleTopicMapping,
  getUserAnswersWithArticles,
  aggregateStatsByTopic,
  invalidateUserAnswersCache,
  clearAllArticleTopicMappings,
  clearAllUserAnswersCache,
} from '@/lib/api/topic-progress'

// ============================================
// CACHE LRU PARA RESPUESTAS FORMATEADAS
// ============================================

interface CacheEntry {
  data: GetThemeStatsResponse
  timestamp: number
}

class LRUCache {
  private cache = new Map<string, CacheEntry>()
  private maxSize: number
  private ttl: number

  constructor(maxSize = 10000, ttlMs = 30000) {
    this.maxSize = maxSize
    this.ttl = ttlMs
  }

  get(key: string): GetThemeStatsResponse | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)

    return { ...entry.data, cached: true }
  }

  set(key: string, data: GetThemeStatsResponse): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }

    this.cache.set(key, { data, timestamp: Date.now() })
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }
}

// Cache global con 10k entradas máximo, TTL 30 segundos
const statsCache = new LRUCache(10000, 30000)

// ============================================
// QUERY PRINCIPAL V2 (usa módulo compartido)
// ============================================

/**
 * Obtiene las estadísticas por tema para un usuario en una oposición específica.
 *
 * Usa el módulo compartido topic-progress que:
 * 1. Cachea el mapeo article→topic por 30 días
 * 2. Cachea las respuestas del usuario por 30 segundos
 * 3. Agrega en memoria (muy rápido)
 *
 * @param userId - ID del usuario
 * @param oposicionId - Slug de la oposición (ej: 'auxiliar-administrativo-estado')
 */
export async function getUserThemeStatsByOposicion(
  userId: string,
  oposicionId: OposicionSlug
): Promise<GetThemeStatsResponse> {
  try {
    const cacheKey = `theme-stats:${userId}:${oposicionId}`

    // Verificar cache de respuesta formateada
    const cached = statsCache.get(cacheKey)
    if (cached) return cached

    const positionType = OPOSICION_TO_POSITION_TYPE[oposicionId]

    if (!positionType) {
      return {
        success: false,
        error: `Oposición no válida: ${oposicionId}`,
      }
    }

    // 1️⃣ Obtener mapeo article → topic (cacheado 30 días)
    const mapping = await getArticleTopicMapping(positionType)

    // 2️⃣ Obtener respuestas del usuario (cacheado 30 segundos)
    const answers = await getUserAnswersWithArticles(userId)

    // 3️⃣ Agregar en memoria usando el mapeo
    const rawStats = aggregateStatsByTopic(answers, mapping)

    // 4️⃣ Convertir al formato esperado por la API
    const stats: Record<string, ThemeStat> = {}
    for (const [topicNumStr, stat] of Object.entries(rawStats)) {
      stats[topicNumStr] = {
        temaNumber: stat.temaNumber,
        total: stat.total,
        correct: stat.correct,
        accuracy: stat.accuracy,
        lastStudy: stat.lastStudy,
        lastStudyFormatted: stat.lastStudyFormatted,
      }
    }

    const response: GetThemeStatsResponse = {
      success: true,
      stats,
      generatedAt: new Date().toISOString(),
    }

    // Guardar en cache
    statsCache.set(cacheKey, response)

    return response
  } catch (error) {
    console.error('Error obteniendo estadísticas por tema (V2):', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// FUNCIÓN LEGACY (compatibilidad hacia atrás)
// ============================================

/**
 * Función de compatibilidad hacia atrás.
 * Si se proporciona oposicionId, usa la nueva lógica V2.
 * Si no, usa la lógica legacy basada en tema_number guardado.
 *
 * @deprecated Usar getUserThemeStatsByOposicion() directamente
 */
export async function getUserThemeStats(
  userId: string,
  oposicionId?: OposicionSlug
): Promise<GetThemeStatsResponse> {
  // Si hay oposicionId, usar la nueva lógica V2
  if (oposicionId) {
    return getUserThemeStatsByOposicion(userId, oposicionId)
  }

  // Legacy: usar tema_number guardado (comportamiento anterior)
  return getUserThemeStatsLegacy(userId)
}

/**
 * Lógica legacy que agrupa por tema_number guardado.
 * Mantener solo para compatibilidad, preferir V2.
 */
async function getUserThemeStatsLegacy(userId: string): Promise<GetThemeStatsResponse> {
  try {
    const cacheKey = `theme-stats-legacy:${userId}`

    // Verificar cache
    const cached = statsCache.get(cacheKey)
    if (cached) return cached

    const db = getDb()

    // Query legacy: agrupa por tema_number guardado
    const result = await db.execute<{
      tema_number: number | null
      total: number
      correct: number
      last_study: string | null
    }>(sql`
      SELECT
        tq.tema_number,
        COUNT(*)::int as total,
        SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int as correct,
        MAX(tq.created_at)::text as last_study
      FROM test_questions tq
      INNER JOIN tests t ON tq.test_id = t.id
      WHERE t.user_id = ${userId}
        AND tq.tema_number IS NOT NULL
      GROUP BY tq.tema_number
      ORDER BY tq.tema_number
    `)

    // Procesar resultados (execute() retorna array directamente con postgres-js)
    const stats: Record<string, ThemeStat> = {}
    const rows = Array.isArray(result) ? result : (result as any).rows || []

    for (const row of rows) {
      if (row.tema_number === null) continue

      const total = row.total || 0
      const correct = row.correct || 0
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
      const lastStudyDate = row.last_study ? new Date(row.last_study) : null

      stats[row.tema_number.toString()] = {
        temaNumber: row.tema_number,
        total,
        correct,
        accuracy,
        lastStudy: row.last_study,
        lastStudyFormatted: lastStudyDate
          ? lastStudyDate.toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short'
            })
          : 'Nunca'
      }
    }

    const response: GetThemeStatsResponse = {
      success: true,
      stats,
      generatedAt: new Date().toISOString(),
    }

    // Guardar en cache
    statsCache.set(cacheKey, response)

    return response
  } catch (error) {
    console.error('Error obteniendo estadísticas por tema (legacy):', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// BATCH QUERY (para múltiples usuarios)
// ============================================

/**
 * Obtiene estadísticas para múltiples usuarios a la vez.
 * Útil para dashboards de admin o procesamiento batch.
 */
export async function getUserThemeStatsBatch(
  userIds: string[],
  oposicionId: OposicionSlug
): Promise<Map<string, GetThemeStatsResponse>> {
  const results = new Map<string, GetThemeStatsResponse>()

  if (userIds.length === 0) return results

  // Para batches pequeños, usar consultas paralelas
  if (userIds.length <= 10) {
    const promises = userIds.map(userId =>
      getUserThemeStatsByOposicion(userId, oposicionId)
        .then(stats => ({ userId, stats }))
    )

    const resolved = await Promise.all(promises)
    for (const { userId, stats } of resolved) {
      results.set(userId, stats)
    }

    return results
  }

  // Para batches grandes, procesar en chunks
  const chunkSize = 10
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize)
    const promises = chunk.map(userId =>
      getUserThemeStatsByOposicion(userId, oposicionId)
        .then(stats => ({ userId, stats }))
    )

    const resolved = await Promise.all(promises)
    for (const { userId, stats } of resolved) {
      results.set(userId, stats)
    }
  }

  return results
}

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Invalida el cache de un usuario específico (todas las oposiciones)
 */
export function invalidateThemeStatsCache(userId: string): void {
  for (const oposicion of Object.keys(OPOSICION_TO_POSITION_TYPE)) {
    statsCache.delete(`theme-stats:${userId}:${oposicion}`)
  }
  statsCache.delete(`theme-stats-legacy:${userId}`)

  // También invalidar caché del módulo compartido
  invalidateUserAnswersCache(userId)
}

/**
 * Invalida el cache de un usuario para una oposición específica
 */
export function invalidateThemeStatsCacheForOposicion(
  userId: string,
  oposicionId: OposicionSlug
): void {
  statsCache.delete(`theme-stats:${userId}:${oposicionId}`)

  // También invalidar caché del módulo compartido
  invalidateUserAnswersCache(userId)
}

/**
 * Limpia todo el cache
 */
export function clearAllThemeStatsCache(): void {
  statsCache.clear()
  clearAllArticleTopicMappings()
  clearAllUserAnswersCache()
}
