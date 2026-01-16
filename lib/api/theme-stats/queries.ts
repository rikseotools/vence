// lib/api/theme-stats/queries.ts - Queries optimizadas para estadísticas por tema
// V2: Stats derivadas dinámicamente desde article_id + topic_scope por oposición
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import type { GetThemeStatsResponse, ThemeStat, OposicionSlug } from './schemas'
import { OPOSICION_TO_POSITION_TYPE } from './schemas'

// ============================================
// CACHE LRU OPTIMIZADO (100k usuarios)
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
// QUERY PRINCIPAL V2 (derivación dinámica)
// ============================================

/**
 * Obtiene las estadísticas por tema para un usuario en una oposición específica.
 *
 * IMPORTANTE: Esta función deriva el tema_number dinámicamente desde:
 * - question_id → primary_article_id → articles → topic_scope → topics
 *
 * Esto significa que la misma respuesta del usuario contribuye a diferentes
 * temas según qué oposición esté viendo.
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

    // Verificar cache
    const cached = statsCache.get(cacheKey)
    if (cached) return cached

    const db = getDb()
    const positionType = OPOSICION_TO_POSITION_TYPE[oposicionId]

    if (!positionType) {
      return {
        success: false,
        error: `Oposición no válida: ${oposicionId}`,
      }
    }

    // Query optimizada con derivación dinámica de tema
    // Usamos una CTE para mayor claridad y performance
    const result = await db.execute<{
      tema_number: number
      total: number
      correct: number
      last_study: string | null
    }>(sql`
      WITH user_answers AS (
        -- Obtener todas las respuestas del usuario con article info
        SELECT
          tq.id as answer_id,
          tq.is_correct,
          tq.created_at,
          q.primary_article_id,
          a.law_id,
          a.article_number
        FROM test_questions tq
        INNER JOIN tests t ON tq.test_id = t.id
        INNER JOIN questions q ON tq.question_id = q.id
        INNER JOIN articles a ON q.primary_article_id = a.id
        WHERE t.user_id = ${userId}
          AND q.primary_article_id IS NOT NULL
      ),
      answer_topics AS (
        -- Mapear cada respuesta a su tema según topic_scope
        SELECT DISTINCT ON (ua.answer_id)
          ua.answer_id,
          ua.is_correct,
          ua.created_at,
          tp.topic_number
        FROM user_answers ua
        INNER JOIN topic_scope ts ON ts.law_id = ua.law_id
          AND ua.article_number = ANY(ts.article_numbers)
        INNER JOIN topics tp ON ts.topic_id = tp.id
        WHERE tp.position_type = ${positionType}
          AND tp.is_active = true
        ORDER BY ua.answer_id, tp.topic_number
      )
      -- Agregar por tema
      SELECT
        topic_number as tema_number,
        COUNT(*)::int as total,
        SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::int as correct,
        MAX(created_at)::text as last_study
      FROM answer_topics
      GROUP BY topic_number
      ORDER BY topic_number
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
}

/**
 * Invalida el cache de un usuario para una oposición específica
 */
export function invalidateThemeStatsCacheForOposicion(
  userId: string,
  oposicionId: OposicionSlug
): void {
  statsCache.delete(`theme-stats:${userId}:${oposicionId}`)
}

/**
 * Limpia todo el cache
 */
export function clearAllThemeStatsCache(): void {
  statsCache.clear()
}
