// lib/chat/domains/temario/queries.ts
// Queries para consultas sobre temarios, programas y epigrafes

import { getReadDb } from '@/db/client'
import { topics, oposiciones } from '@/db/schema'
import { eq, and, or, ilike } from 'drizzle-orm'
import { logger } from '../../shared/logger'
import { getChatCache, CACHE_KEYS, CACHE_TTL } from '../../shared/cache'

// ============================================
// TIPOS
// ============================================

export interface TopicInfo {
  id: string
  positionType: string
  topicNumber: number
  title: string
  description: string | null
}

export interface OposicionInfo {
  id: string
  nombre: string
  shortName: string | null
  slug: string | null
  temasCount: number | null
  grupo: string | null
  subgrupo: string | null
}

export interface TemarioSearchResult {
  /** Topics que coinciden con la busqueda */
  matchingTopics: TopicInfo[]
  /** Oposicion del usuario (si tiene) */
  userOposicion: OposicionInfo | null
  /** Si se busco en todas las oposiciones */
  searchedAll: boolean
}

// ============================================
// MAPPERS
// ============================================

function mapTopic(t: Record<string, unknown>): TopicInfo {
  return {
    id: t.id as string,
    positionType: t.position_type as string,
    topicNumber: t.topic_number as number,
    title: t.title as string,
    description: t.description as string | null,
  }
}

function mapOposicion(o: Record<string, unknown>): OposicionInfo {
  return {
    id: o.id as string,
    nombre: o.nombre as string,
    shortName: o.short_name as string | null,
    slug: o.slug as string | null,
    temasCount: o.temas_count as number | null,
    grupo: o.grupo as string | null,
    subgrupo: o.subgrupo as string | null,
  }
}

// ============================================
// QUERIES (con cache)
// ============================================

/**
 * Obtiene todos los topics de una oposicion por position_type
 * Cache: 1 hora (los temarios cambian muy raramente)
 */
export async function getTopicsByPositionType(positionType: string): Promise<TopicInfo[]> {
  const cache = getChatCache()
  const cacheKey = CACHE_KEYS.topics(positionType)

  const cached = cache.get<TopicInfo[]>(cacheKey)
  if (cached) {
    logger.debug(`Cache hit: topics for ${positionType}`, { domain: 'temario' })
    return cached
  }

  let data: Array<Record<string, unknown>>
  try {
    const db = getReadDb()
    data = await db
      .select({
        id: topics.id,
        position_type: topics.positionType,
        topic_number: topics.topicNumber,
        title: topics.title,
        description: topics.description,
      })
      .from(topics)
      .where(and(eq(topics.positionType, positionType), eq(topics.isActive, true)))
      .orderBy(topics.topicNumber)
  } catch (error) {
    logger.error('Error fetching topics by position_type', error, { domain: 'temario' })
    return []
  }

  const result = data.map(mapTopic)
  cache.set(cacheKey, result, CACHE_TTL.TOPICS)
  return result
}

/**
 * Busca topics por contenido (titulo o descripcion) en una oposicion especifica
 * Cache: 15 min
 */
export async function searchTopicsByContent(
  searchTerms: string[],
  positionType?: string
): Promise<TopicInfo[]> {
  const cache = getChatCache()
  const termsKey = searchTerms.sort().join('|')
  const cacheKey = CACHE_KEYS.topicSearch(termsKey, positionType)

  const cached = cache.get<TopicInfo[]>(cacheKey)
  if (cached) {
    logger.debug(`Cache hit: topic search for "${termsKey}"`, { domain: 'temario' })
    return cached
  }

  // Condiciones OR: buscar cada término en título y descripción (ILIKE %term%)
  const orConditions = searchTerms.flatMap(term => [
    ilike(topics.title, `%${term}%`),
    ilike(topics.description, `%${term}%`),
  ])

  const conditions = [eq(topics.isActive, true), or(...orConditions)]
  if (positionType) {
    conditions.push(eq(topics.positionType, positionType))
  }

  let data: Array<Record<string, unknown>>
  try {
    const db = getReadDb()
    data = await db
      .select({
        id: topics.id,
        position_type: topics.positionType,
        topic_number: topics.topicNumber,
        title: topics.title,
        description: topics.description,
      })
      .from(topics)
      .where(and(...conditions))
      .orderBy(topics.topicNumber)
  } catch (error) {
    logger.error('Error searching topics by content', error, { domain: 'temario' })
    return []
  }

  const result = data.map(mapTopic)
  cache.set(cacheKey, result, CACHE_TTL.TOPIC_SEARCH)
  return result
}

/**
 * Obtiene info de una oposicion desde la tabla oposiciones
 * Cache: 1 hora
 */
export async function getOposicionInfo(oposicionId: string): Promise<OposicionInfo | null> {
  const cache = getChatCache()
  const cacheKey = CACHE_KEYS.oposicionInfo(oposicionId)

  const cached = cache.get<OposicionInfo>(cacheKey)
  if (cached) return cached

  // El ID en oposiciones es un UUID, pero userDomain es el slug tipo "auxiliar_administrativo_estado"
  // Necesitamos buscar por slug
  const { ID_TO_SLUG } = await import('@/lib/config/oposiciones')
  const slug = ID_TO_SLUG[oposicionId]

  if (!slug) return null

  let data: Record<string, unknown> | undefined
  try {
    const db = getReadDb()
    const rows = await db
      .select({
        id: oposiciones.id,
        nombre: oposiciones.nombre,
        short_name: oposiciones.shortName,
        slug: oposiciones.slug,
        temas_count: oposiciones.temasCount,
        grupo: oposiciones.grupo,
        subgrupo: oposiciones.subgrupo,
      })
      .from(oposiciones)
      .where(eq(oposiciones.slug, slug))
      .limit(1)
    data = rows[0]
  } catch {
    return null
  }

  if (!data) {
    return null
  }

  const result = mapOposicion(data)
  cache.set(cacheKey, result, CACHE_TTL.OPOSICIONES)
  return result
}

/**
 * Obtiene todas las oposiciones activas
 * Cache: 1 hora
 */
export async function getAllOposiciones(): Promise<OposicionInfo[]> {
  const cache = getChatCache()
  const cacheKey = CACHE_KEYS.oposiciones()

  const cached = cache.get<OposicionInfo[]>(cacheKey)
  if (cached) return cached

  let data: Array<Record<string, unknown>>
  try {
    const db = getReadDb()
    data = await db
      .select({
        id: oposiciones.id,
        nombre: oposiciones.nombre,
        short_name: oposiciones.shortName,
        slug: oposiciones.slug,
        temas_count: oposiciones.temasCount,
        grupo: oposiciones.grupo,
        subgrupo: oposiciones.subgrupo,
      })
      .from(oposiciones)
      .where(eq(oposiciones.isActive, true))
      .orderBy(oposiciones.nombre)
  } catch (error) {
    logger.error('Error fetching oposiciones', error, { domain: 'temario' })
    return []
  }

  const result = data.map(mapOposicion)
  cache.set(cacheKey, result, CACHE_TTL.OPOSICIONES)
  return result
}
