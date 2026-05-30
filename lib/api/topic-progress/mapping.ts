// lib/api/topic-progress/mapping.ts
// Caché compartido para mapeo article → topic por position_type
// TTL: 30 días (el mapeo raramente cambia)

// CANARY pooler (sweep masivo oleada 5 — todos user-facing 2026-05-10):
import { getDb, getPoolerDb } from '@/db/client'

function getTopicProgressMappingDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}
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

  const db = getTopicProgressMappingDb()

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

// ============================================
// RESOLUCIÓN article_ids POR TEMA (HOT PATH)
// ============================================

interface TopicArticleIdsCacheEntry {
  articleIds: string[]
  timestamp: number
}

const topicArticleIdsCache = new Map<string, TopicArticleIdsCacheEntry>()
const TOPIC_ARTICLE_IDS_TTL = 60 * 60 * 1000 // 1h (igual que mapping)

/**
 * Resuelve los `article_ids` (uuid) de un tema concreto desde el mapping.
 *
 * Convierte las claves `lawId_articleNumber` del mapping a uuids de `articles`,
 * filtrando por las del topicNumber pedido. Cacheado 1h.
 *
 * Usado por getUserAnswersForArticles para filtrar en SQL en vez de en JS:
 *   - heavy user (64.720 respuestas): 14s → 88ms warm (161× speedup)
 *
 * @param positionType - Tipo de oposición
 * @param topicNumber - Número del tema
 * @returns Lista de article_ids (uuid) para ese tema
 */
export async function getArticleIdsForTopic(
  positionType: string,
  topicNumber: number
): Promise<string[]> {
  const cacheKey = `topic-article-ids:${positionType}:${topicNumber}`
  const cached = topicArticleIdsCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < TOPIC_ARTICLE_IDS_TTL) {
    return cached.articleIds
  }

  const db = getTopicProgressMappingDb()

  // Una sola query con JOIN: topic_scope → topics + articles
  // Resuelve article_id final desde (law_id, article_number) del scope.
  const result = await db.execute<{ article_id: string }>(sql`
    SELECT DISTINCT a.id AS article_id
    FROM public.topic_scope ts
    INNER JOIN public.topics tp ON ts.topic_id = tp.id
    INNER JOIN public.articles a ON a.law_id = ts.law_id
    WHERE tp.position_type = ${positionType}
      AND tp.is_active = true
      AND tp.topic_number = ${topicNumber}
      AND a.is_active = true
      AND (
        ts.article_numbers IS NULL  -- "toda la ley"
        OR a.article_number = ANY(ts.article_numbers)
      )
  `)

  const rows = Array.isArray(result) ? result : (result as any).rows || []
  const articleIds = rows.map((r: any) => r.article_id)

  topicArticleIdsCache.set(cacheKey, { articleIds, timestamp: Date.now() })

  return articleIds
}

/**
 * Invalida el caché de article_ids resueltos por tema.
 */
export function invalidateTopicArticleIds(positionType: string): void {
  for (const key of topicArticleIdsCache.keys()) {
    if (key.startsWith(`topic-article-ids:${positionType}:`)) {
      topicArticleIdsCache.delete(key)
    }
  }
}

/**
 * Resuelve TODOS los article_ids del position_type (todos los temas activos).
 *
 * Para getAllTopicStatsForUser (theme-stats) — permite filtrar en SQL en vez
 * de cargar TODAS las respuestas del user y filtrar 1.275 art_ids en JS.
 *
 * Bench heavy user (63k respuestas, 1.275 art_ids aux_admin_estado):
 *   - Sin filter: 30s cold / 22s warm
 *   - Con filter: 1.3s cold / 394ms warm  →  23× / 56× speedup
 *
 * Cacheado 1h (mismo TTL que el mapping principal).
 */
export async function getAllArticleIdsForPositionType(
  positionType: string
): Promise<string[]> {
  const cacheKey = `all-article-ids:${positionType}`
  const cached = topicArticleIdsCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < TOPIC_ARTICLE_IDS_TTL) {
    return cached.articleIds
  }

  const db = getTopicProgressMappingDb()

  const result = await db.execute<{ article_id: string }>(sql`
    SELECT DISTINCT a.id AS article_id
    FROM public.topic_scope ts
    INNER JOIN public.topics tp ON ts.topic_id = tp.id
    INNER JOIN public.articles a ON a.law_id = ts.law_id
    WHERE tp.position_type = ${positionType}
      AND tp.is_active = true
      AND a.is_active = true
      AND (
        ts.article_numbers IS NULL
        OR a.article_number = ANY(ts.article_numbers)
      )
  `)

  const rows = Array.isArray(result) ? result : (result as any).rows || []
  const articleIds = rows.map((r: any) => r.article_id)

  topicArticleIdsCache.set(cacheKey, { articleIds, timestamp: Date.now() })

  return articleIds
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
