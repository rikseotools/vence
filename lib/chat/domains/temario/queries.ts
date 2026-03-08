// lib/chat/domains/temario/queries.ts
// Queries para consultas sobre temarios, programas y epigrafes

import { createClient } from '@supabase/supabase-js'
import { logger } from '../../shared/logger'
import { getChatCache, CACHE_KEYS, CACHE_TTL } from '../../shared/cache'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

  const { data, error } = await getSupabase()
    .from('topics')
    .select('id, position_type, topic_number, title, description')
    .eq('position_type', positionType)
    .eq('is_active', true)
    .order('topic_number')

  if (error) {
    logger.error('Error fetching topics by position_type', error, { domain: 'temario' })
    return []
  }

  const result = (data || []).map(mapTopic)
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

  const supabase = getSupabase()

  // Construir condiciones OR para buscar en titulo y descripcion
  const orConditions = searchTerms
    .map(term => `title.ilike.%${term}%,description.ilike.%${term}%`)
    .join(',')

  let query = supabase
    .from('topics')
    .select('id, position_type, topic_number, title, description')
    .eq('is_active', true)
    .or(orConditions)
    .order('topic_number')

  if (positionType) {
    query = query.eq('position_type', positionType)
  }

  const { data, error } = await query

  if (error) {
    logger.error('Error searching topics by content', error, { domain: 'temario' })
    return []
  }

  const result = (data || []).map(mapTopic)
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

  const { data, error } = await getSupabase()
    .from('oposiciones')
    .select('id, nombre, short_name, slug, temas_count, grupo')
    .eq('slug', slug)
    .single()

  if (error || !data) {
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

  const { data, error } = await getSupabase()
    .from('oposiciones')
    .select('id, nombre, short_name, slug, temas_count, grupo')
    .eq('is_active', true)
    .order('nombre')

  if (error) {
    logger.error('Error fetching oposiciones', error, { domain: 'temario' })
    return []
  }

  const result = (data || []).map(mapOposicion)
  cache.set(cacheKey, result, CACHE_TTL.OPOSICIONES)
  return result
}
