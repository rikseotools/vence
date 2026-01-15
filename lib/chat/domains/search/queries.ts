// lib/chat/domains/search/queries.ts
// Queries tipadas para búsqueda de artículos

import { createClient } from '@supabase/supabase-js'
import { getDb } from '@/db/client'
import { articles, laws } from '@/db/schema'
import { eq, and, or, ilike, inArray, sql } from 'drizzle-orm'
import { logger } from '../../shared/logger'
import type { ArticleMatch, SearchOptions } from '../../core/types'

// Cliente Supabase para RPC functions (match_articles usa pgvector)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================
// BÚSQUEDA SEMÁNTICA (via RPC)
// ============================================

export interface SemanticSearchOptions extends SearchOptions {
  priorityLawIds?: string[]
  mentionedLawNames?: string[]
  contextLawName?: string | null
}

/**
 * Búsqueda semántica usando embeddings (via match_articles RPC)
 */
export async function searchArticlesBySimilarity(
  embedding: number[],
  options: SemanticSearchOptions = {}
): Promise<ArticleMatch[]> {
  const {
    limit = 10,
    minSimilarity = 0.2,
    priorityLawIds = [],
    mentionedLawNames = [],
    contextLawName = null,
  } = options

  // Si hay leyes mencionadas, pedir más resultados
  const multiplier = mentionedLawNames.length > 0 ? 15 : 4

  const { data: rawArticles, error } = await supabase.rpc('match_articles', {
    query_embedding: embedding,
    match_threshold: minSimilarity,
    match_count: limit * multiplier,
  })

  if (error) {
    logger.error('Error in match_articles RPC', error, { domain: 'search' })
    return []
  }

  if (!rawArticles || rawArticles.length === 0) {
    return []
  }

  // Obtener info de las leyes
  const lawIds = [...new Set(rawArticles.map((a: any) => a.law_id))]
  const { data: lawsData } = await supabase
    .from('laws')
    .select('id, short_name, name, is_derogated')
    .in('id', lawIds)

  const lawMap: Record<string, { id: string; short_name: string; name: string; is_derogated: boolean }> = {}
  lawsData?.forEach(l => { lawMap[l.id] = l })

  // Filtrar leyes derogadas
  let validArticles = rawArticles.filter((a: any) => {
    const law = lawMap[a.law_id]
    return !law?.is_derogated
  })

  // Si hay leyes mencionadas, filtrar SOLO esas
  if (mentionedLawNames.length > 0) {
    const mentionedArticles = validArticles.filter((a: any) => {
      const law = lawMap[a.law_id]
      return mentionedLawNames.includes(law?.short_name)
    })

    if (mentionedArticles.length > 0) {
      validArticles = mentionedArticles
      logger.debug(`Filtered by mentioned laws: ${mentionedLawNames.join(', ')} → ${validArticles.length} articles`, { domain: 'search' })
    } else {
      logger.debug(`No articles found for mentioned laws: ${mentionedLawNames.join(', ')}`, { domain: 'search' })
      return [] // Forzar fallback
    }
  }

  // Priorizar por contexto de ley o leyes de oposición
  let finalArticles = validArticles
  if (contextLawName && mentionedLawNames.length === 0) {
    finalArticles = prioritizeByLaw(validArticles, lawMap, contextLawName, limit)
  } else if (priorityLawIds.length > 0 && mentionedLawNames.length === 0) {
    finalArticles = prioritizeByLawIds(validArticles, priorityLawIds, limit)
  }

  return finalArticles.slice(0, limit).map((a: any) => ({
    id: a.id,
    lawId: a.law_id,
    lawName: lawMap[a.law_id]?.name || '',
    lawShortName: lawMap[a.law_id]?.short_name || '',
    articleNumber: a.article_number,
    title: a.title,
    content: a.content,
    similarity: a.similarity,
  }))
}

function prioritizeByLaw(
  articles: any[],
  lawMap: Record<string, any>,
  targetLawName: string,
  limit: number
): any[] {
  // FILTRAR solo artículos de la ley del contexto
  // No incluir artículos de otras leyes cuando hay una ley específica en el contexto
  const contextArticles = articles.filter(a => lawMap[a.law_id]?.short_name === targetLawName)

  // Si no hay artículos de la ley del contexto, devolver vacío
  // para que el sistema sepa que no encontró resultados relevantes
  if (contextArticles.length === 0) {
    logger.debug(`No articles found for context law: ${targetLawName}`, { domain: 'search' })
    return []
  }

  return contextArticles.slice(0, limit)
}

function prioritizeByLawIds(
  articles: any[],
  priorityLawIds: string[],
  limit: number
): any[] {
  const prioritySet = new Set(priorityLawIds)
  const priorityArticles = articles.filter(a => prioritySet.has(a.law_id))
  const otherArticles = articles.filter(a => !prioritySet.has(a.law_id))

  const numPriority = Math.min(priorityArticles.length, Math.ceil(limit * 0.7))
  const numOther = limit - numPriority

  return [
    ...priorityArticles.slice(0, numPriority),
    ...otherArticles.slice(0, numOther),
  ]
}

// ============================================
// BÚSQUEDA DIRECTA POR LEY
// ============================================

/**
 * Busca artículos directamente por nombre de ley
 */
export async function searchArticlesByLawDirect(
  lawShortName: string,
  options: { limit?: number; searchTerms?: string[] | null } = {}
): Promise<ArticleMatch[]> {
  const { limit = 15, searchTerms = null } = options

  // Buscar la ley
  const { data: law, error: lawError } = await supabase
    .from('laws')
    .select('id, short_name, name, is_derogated')
    .eq('short_name', lawShortName)
    .single()

  if (lawError || !law) {
    logger.warn(`Law not found: ${lawShortName}`, { domain: 'search' })
    return []
  }

  if (law.is_derogated) {
    logger.warn(`Derogated law: ${lawShortName}`, { domain: 'search' })
    return []
  }

  let query = supabase
    .from('articles')
    .select('id, law_id, article_number, title, content')
    .eq('law_id', law.id)
    .eq('is_active', true)

  // Filtrar por términos de búsqueda si hay
  if (searchTerms && searchTerms.length > 0) {
    const orConditions = searchTerms
      .map(term => `title.ilike.%${term}%,content.ilike.%${term}%`)
      .join(',')
    query = query.or(orConditions)
    logger.debug(`Searching in ${lawShortName} with terms: ${searchTerms.join(', ')}`, { domain: 'search' })
  }

  const { data: articlesData, error } = await query
    .order('article_number', { ascending: true })
    .limit(limit)

  if (error || !articlesData) {
    logger.error('Error searching articles directly', error, { domain: 'search' })
    return []
  }

  return articlesData.map(a => ({
    id: a.id,
    lawId: a.law_id,
    lawName: law.name,
    lawShortName: law.short_name,
    articleNumber: a.article_number,
    title: a.title,
    content: a.content,
    similarity: 1.0, // Máxima relevancia
  }))
}

// ============================================
// BÚSQUEDA POR KEYWORDS
// ============================================

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'al',
  'y', 'o', 'que', 'en', 'a', 'por', 'para', 'con', 'sin',
  'es', 'son', 'qué', 'cómo', 'cuál', 'me', 'te', 'se',
])

/**
 * Búsqueda por keywords cuando no hay embeddings
 */
export async function searchArticlesByKeywords(
  question: string,
  options: SearchOptions = {}
): Promise<ArticleMatch[]> {
  const { limit = 10 } = options

  // Extraer keywords
  const keywords = question
    .toLowerCase()
    .replace(/[^\w\sáéíóúñü]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w))
    .slice(0, 5)

  if (keywords.length === 0) {
    return []
  }

  // Construir condiciones OR
  const orConditions = keywords
    .map(kw => `title.ilike.%${kw}%,content.ilike.%${kw}%`)
    .join(',')

  const { data: articlesData, error } = await supabase
    .from('articles')
    .select(`
      id,
      article_number,
      title,
      content,
      law_id,
      law:laws!inner(id, short_name, name, is_derogated)
    `)
    .eq('is_active', true)
    .eq('law.is_derogated', false)
    .or(orConditions)
    .limit(limit * 2)

  if (error || !articlesData) {
    logger.error('Error in keyword search', error, { domain: 'search' })
    return []
  }

  // Rankear por relevancia
  const ranked = articlesData.map(a => {
    const text = `${a.title || ''} ${a.content || ''}`.toLowerCase()
    let score = 0
    keywords.forEach(kw => {
      const regex = new RegExp(kw, 'gi')
      const matches = text.match(regex)
      if (matches) score += matches.length
    })
    return { ...a, score }
  })

  return ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(a => ({
      id: a.id,
      lawId: a.law_id,
      lawName: (a.law as any)?.name || '',
      lawShortName: (a.law as any)?.short_name || '',
      articleNumber: a.article_number,
      title: a.title,
      content: a.content,
      similarity: Math.min(1, a.score / 10),
    }))
}

// ============================================
// BÚSQUEDA POR PATRÓN
// ============================================

export interface PatternSearchResult extends ArticleMatch {
  relevanceScore: number
}

/**
 * Busca artículos que coincidan con keywords de un patrón
 */
export async function searchArticlesForPattern(
  keywords: string[],
  options: { lawShortName?: string | null; limit?: number } = {}
): Promise<PatternSearchResult[]> {
  const { lawShortName = null, limit = 15 } = options

  // Si hay ley específica, obtener su ID
  let lawId: string | null = null
  let lawInfo: { id: string; short_name: string; name: string } | null = null

  if (lawShortName) {
    const { data: law } = await supabase
      .from('laws')
      .select('id, short_name, name')
      .eq('short_name', lawShortName)
      .single()

    if (law) {
      lawId = law.id
      lawInfo = law
    }
  }

  // Construir búsqueda con OR
  const orConditions = keywords
    .flatMap(term => [`title.ilike.%${term}%`, `content.ilike.%${term}%`])
    .join(',')

  let query = supabase
    .from('articles')
    .select(`
      id,
      article_number,
      title,
      content,
      law_id,
      law:laws!inner(id, short_name, name, is_derogated)
    `)
    .eq('is_active', true)
    .eq('law.is_derogated', false)
    .or(orConditions)

  if (lawId) {
    query = query.eq('law_id', lawId)
  }

  const { data: articlesData, error } = await query
    .order('article_number', { ascending: true })
    .limit(limit * 2)

  if (error || !articlesData) {
    logger.error('Error in pattern search', error, { domain: 'search' })
    return []
  }

  // Rankear por relevancia
  const ranked = articlesData.map(a => {
    const text = `${a.title || ''} ${a.content || ''}`.toLowerCase()
    let score = 0
    keywords.forEach(kw => {
      const regex = new RegExp(kw, 'gi')
      const matches = text.match(regex)
      if (matches) score += matches.length
    })
    return { ...a, relevanceScore: score }
  })

  return ranked
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit)
    .map(a => ({
      id: a.id,
      lawId: a.law_id,
      lawName: (a.law as any)?.name || '',
      lawShortName: (a.law as any)?.short_name || '',
      articleNumber: a.article_number,
      title: a.title,
      content: a.content,
      similarity: Math.min(1, a.relevanceScore / 10),
      relevanceScore: a.relevanceScore,
    }))
}

// ============================================
// HELPERS
// ============================================

/**
 * Busca una ley por nombre corto o nombre completo
 * Prioriza exact match antes de fuzzy search
 */
export async function findLawByName(
  name: string
): Promise<{ id: string; shortName: string; name: string } | null> {
  // 1. Primero intentar exact match por short_name (más preciso)
  const { data: exactMatch } = await supabase
    .from('laws')
    .select('id, short_name, name')
    .eq('short_name', name)
    .eq('is_derogated', false)
    .limit(1)
    .single()

  if (exactMatch) {
    logger.debug(`🔎 findLawByName: exact match for "${name}" → ${exactMatch.short_name}`, { domain: 'search' })
    return {
      id: exactMatch.id,
      shortName: exactMatch.short_name,
      name: exactMatch.name,
    }
  }

  // 2. Si no hay exact match, intentar case-insensitive exact
  const { data: ciExact } = await supabase
    .from('laws')
    .select('id, short_name, name')
    .ilike('short_name', name)
    .eq('is_derogated', false)
    .limit(1)
    .single()

  if (ciExact) {
    logger.debug(`🔎 findLawByName: case-insensitive match for "${name}" → ${ciExact.short_name}`, { domain: 'search' })
    return {
      id: ciExact.id,
      shortName: ciExact.short_name,
      name: ciExact.name,
    }
  }

  // 3. Fallback: fuzzy search (solo si no hay match exacto)
  const { data: fuzzyMatch } = await supabase
    .from('laws')
    .select('id, short_name, name')
    .or(`short_name.ilike.%${name}%,name.ilike.%${name}%`)
    .eq('is_derogated', false)
    .limit(1)
    .single()

  if (fuzzyMatch) {
    logger.debug(`🔎 findLawByName: fuzzy match for "${name}" → ${fuzzyMatch.short_name}`, { domain: 'search' })
    return {
      id: fuzzyMatch.id,
      shortName: fuzzyMatch.short_name,
      name: fuzzyMatch.name,
    }
  }

  logger.warn(`🔎 findLawByName: no law found for "${name}"`, { domain: 'search' })
  return null
}

/**
 * Obtiene los IDs de leyes para una oposición
 */
export async function getOposicionLawIds(userOposicion: string): Promise<string[]> {
  const OPOSICION_TO_POSITION_TYPE: Record<string, string> = {
    auxiliar_administrativo_estado: 'auxiliar_administrativo',
    administrativo_estado: 'administrativo',
    gestion_procesal: 'gestion_procesal',
  }

  const positionType = OPOSICION_TO_POSITION_TYPE[userOposicion]
  if (!positionType) return []

  // Obtener topics de esta oposición
  const { data: topics } = await supabase
    .from('topics')
    .select('id')
    .eq('position_type', positionType)

  if (!topics || topics.length === 0) return []

  const topicIds = topics.map(t => t.id)

  // Obtener leyes de estos topics
  const { data: scopes } = await supabase
    .from('topic_scope')
    .select('law_id')
    .in('topic_id', topicIds)

  if (!scopes || scopes.length === 0) return []

  return [...new Set(scopes.map(s => s.law_id))]
}

/**
 * Extrae términos de búsqueda legales del mensaje
 */
export function extractSearchTerms(message: string): string[] | null {
  const msgLower = message.toLowerCase()

  const legalKeywords = [
    'plazo', 'plazos', 'término', 'termino', 'días', 'dias',
    'silencio', 'administrativo', 'positivo', 'negativo',
    'recurso', 'recursos', 'alzada', 'reposición', 'reposicion',
    'notificación', 'notificacion', 'notificar',
    'procedimiento', 'procedimientos',
    'delegación', 'delegacion', 'competencia', 'competencias', 'avocación', 'avocacion',
    'órgano', 'organo', 'colegiado', 'colegiados',
    'convenio', 'convenios', 'acuerdo', 'acuerdos',
    'responsabilidad', 'patrimonial',
    'sanción', 'sancion', 'sanciones', 'sancionador',
    'interesado', 'interesados',
    'resolución', 'resolucion', 'resolver',
    'subsanación', 'subsanacion', 'subsanar',
    'alegación', 'alegacion', 'alegaciones',
    'audiencia', 'trámite', 'tramite',
    'caducidad', 'prescripción', 'prescripcion',
    'nulidad', 'anulabilidad', 'revisión', 'revision',
    'ejecución', 'ejecutivo', 'ejecutiva',
  ]

  const foundTerms = legalKeywords.filter(kw => msgLower.includes(kw))

  if (foundTerms.length === 0) return null

  return [...new Set(foundTerms)].slice(0, 5)
}
