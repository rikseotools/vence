// lib/api/topic-progress/mapping.ts
// Caché compartido para mapeo article → topic por position_type
// TTL: 30 días (el mapeo raramente cambia)

import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'

// ============================================
// TIPOS
// ============================================

export interface ArticleTopicMapping {
  [lawId_articleNumber: string]: number // topic_number
}

interface TopicScopeCacheEntry {
  mapping: ArticleTopicMapping
  timestamp: number
}

// ============================================
// CACHÉ GLOBAL (30 días TTL)
// ============================================

const topicScopeCache = new Map<string, TopicScopeCacheEntry>()
const TOPIC_SCOPE_TTL = 60 * 60 * 1000 // 1 hora (30 días era excesivo y causaba stale data tras cambios de scope)

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================

/**
 * Obtiene el mapeo article → topic para un position_type.
 *
 * El mapeo se construye desde topic_scope:
 * - Cada topic_scope tiene: law_id, article_numbers[], topic_id
 * - Cada topic tiene: topic_number, position_type
 *
 * Resultado: { "lawId_articleNumber": topicNumber, ... }
 *
 * @param positionType - Tipo de oposición (ej: 'auxiliar_administrativo_estado')
 * @returns Mapeo cacheado (30 días)
 */
export async function getArticleTopicMapping(
  positionType: string
): Promise<ArticleTopicMapping> {
  const cacheKey = `topic-scope:${positionType}`
  const cached = topicScopeCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < TOPIC_SCOPE_TTL) {
    return cached.mapping
  }

  const db = getDb()

  // Obtener todos los topic_scope para este position_type
  const scopeRows = await db.execute<{
    law_id: string
    article_numbers: string[]
    topic_number: number
  }>(sql`
    SELECT ts.law_id, ts.article_numbers, tp.topic_number
    FROM topic_scope ts
    INNER JOIN topics tp ON ts.topic_id = tp.id
    WHERE tp.position_type = ${positionType}
      AND tp.is_active = true
  `)

  const rows = Array.isArray(scopeRows) ? scopeRows : (scopeRows as any).rows || []

  // Construir mapeo: lawId_articleNumber → topic_number
  const mapping: ArticleTopicMapping = {}
  for (const row of rows) {
    if (row.article_numbers && Array.isArray(row.article_numbers)) {
      for (const articleNum of row.article_numbers) {
        const key = `${row.law_id}_${articleNum}`
        // Si ya existe, quedarse con el topic_number más bajo (consistencia)
        if (!(key in mapping) || row.topic_number < mapping[key]) {
          mapping[key] = row.topic_number
        }
      }
    }
  }

  topicScopeCache.set(cacheKey, { mapping, timestamp: Date.now() })
  console.log(`📊 [topic-progress] Mapeo article→topic cargado: ${Object.keys(mapping).length} entradas para ${positionType}`)

  return mapping
}

// ============================================
// UTILIDADES DE CACHÉ
// ============================================

/**
 * Invalida el caché de mapeo para un position_type
 */
export function invalidateArticleTopicMapping(positionType: string): void {
  topicScopeCache.delete(`topic-scope:${positionType}`)
}

/**
 * Invalida todo el caché de mapeos
 */
export function clearAllArticleTopicMappings(): void {
  topicScopeCache.clear()
}

/**
 * Obtiene estadísticas del caché (para debugging)
 */
export function getArticleTopicMappingCacheStats(): {
  size: number
  entries: Array<{ positionType: string; entriesCount: number; age: number }>
} {
  const entries: Array<{ positionType: string; entriesCount: number; age: number }> = []

  for (const [key, value] of topicScopeCache) {
    const positionType = key.replace('topic-scope:', '')
    entries.push({
      positionType,
      entriesCount: Object.keys(value.mapping).length,
      age: Math.round((Date.now() - value.timestamp) / 1000 / 60), // minutos
    })
  }

  return { size: topicScopeCache.size, entries }
}
