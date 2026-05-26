// lib/chat/domains/search/queries.ts
// Queries tipadas para búsqueda de artículos

import { createClient } from '@supabase/supabase-js'
import { getDb } from '@/db/client'
import { articles, laws } from '@/db/schema'
import { eq, and, or, ilike, inArray, sql } from 'drizzle-orm'
import { logger } from '../../shared/logger'
import { createGlobalCache } from '@/lib/cache/globalCache'
import { getChatCache, CACHE_KEYS, CACHE_TTL } from '../../shared/cache'
import type { ArticleMatch, SearchOptions } from '../../core/types'
import { getOposicion } from '@/lib/config/oposiciones'

// Cliente Supabase para RPC functions (match_articles usa pgvector)
export const getSupabaseForSearch = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const getSupabase = () => createClient(
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

  const { data: rawArticles, error } = await getSupabase().rpc('match_articles', {
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
  const { data: lawsData } = await getSupabase()
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
 * Stopwords interrogativas que el stemmer 'spanish' no filtra pero degradan
 * la búsqueda AND en FTS (porque ningún artículo del BOE contiene "cuanto",
 * "cuál", etc., así que el AND devuelve 0).
 */
const QUERY_STOPWORDS = new Set([
  'cuanto', 'cuanta', 'cuantos', 'cuantas',
  'cual', 'cuales', 'que', 'como',
  'cuando', 'donde', 'quien', 'quienes',
  'porque', 'sobre', 'segun',
  'dice', 'dicen', 'decir', 'hay', 'tiene', 'tienen',
  'seria', 'puede', 'puedo', 'funciona', 'funcionan',
  'explicame', 'explica', 'explicar',
])

/** Normaliza un string a lowercase + sin tildes (para matching de stopwords) */
function normalizeForStopwords(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Limpia la query del usuario: quita stopwords interrogativas */
function cleanQueryForFTS(q: string): string {
  return q
    .split(/\s+/)
    .filter(w => w.length >= 2)
    .filter(w => !QUERY_STOPWORDS.has(normalizeForStopwords(w)))
    .join(' ')
}

interface FTSRow extends Record<string, unknown> {
  id: string
  law_id: string
  article_number: string
  title: string | null
  content: string | null
  rank: number
}

/**
 * Búsqueda Full-Text Search en una ley específica.
 * Pipeline: AND search (preciso) → OR fallback (si AND devuelve 0).
 * Ordena por ts_rank (relevancia), NO por número de artículo.
 *
 * Requiere migración 20260515_articles_fts.sql (columna content_tsv + índice GIN).
 */
async function searchArticlesByFTS(
  law: { id: string; name: string; short_name: string },
  userQuery: string,
  limit: number,
): Promise<ArticleMatch[]> {
  const cleaned = cleanQueryForFTS(userQuery)
  if (!cleaned) return []

  const db = getDb()

  // Stage 1: AND (plainto_tsquery requiere TODOS los términos)
  const andRows = await db.execute<FTSRow>(sql`
    SELECT a.id, a.law_id, a.article_number, a.title, a.content,
      ts_rank(a.content_tsv, plainto_tsquery('spanish', ${cleaned})) AS rank
    FROM articles a
    WHERE a.law_id = ${law.id}::uuid
      AND a.is_active = true
      AND a.content_tsv @@ plainto_tsquery('spanish', ${cleaned})
    ORDER BY rank DESC, a.article_number ASC
    LIMIT ${limit}
  `)
  const andArray: FTSRow[] = Array.isArray(andRows) ? (andRows as FTSRow[]) : ((andRows as { rows?: FTSRow[] }).rows ?? [])

  if (andArray.length > 0) {
    logger.debug(`FTS AND: ${andArray.length} arts in ${law.short_name} for "${cleaned}"`, { domain: 'search' })
    return andArray.map(r => ({
      id: r.id,
      lawId: r.law_id,
      lawName: law.name,
      lawShortName: law.short_name,
      articleNumber: r.article_number,
      title: r.title,
      content: r.content ?? '',
      similarity: Number(r.rank),
    }))
  }

  // Stage 2: OR fallback con lexemas significativos (length >= 3)
  const lexRows = await db.execute<{ lexemes: string[] | null }>(sql`
    SELECT array_agg(lexeme) AS lexemes
    FROM unnest(to_tsvector('spanish', ${cleaned}))
    WHERE char_length(lexeme) >= 3
  `)
  const lexArray: Array<{ lexemes: string[] | null }> = Array.isArray(lexRows)
    ? (lexRows as Array<{ lexemes: string[] | null }>)
    : ((lexRows as { rows?: Array<{ lexemes: string[] | null }> }).rows ?? [])
  const lexemes = lexArray[0]?.lexemes ?? []
  if (lexemes.length === 0) return []

  const orQuery = lexemes.join(' | ')
  const orRows = await db.execute<FTSRow>(sql`
    SELECT a.id, a.law_id, a.article_number, a.title, a.content,
      ts_rank(a.content_tsv, to_tsquery('spanish', ${orQuery})) AS rank
    FROM articles a
    WHERE a.law_id = ${law.id}::uuid
      AND a.is_active = true
      AND a.content_tsv @@ to_tsquery('spanish', ${orQuery})
    ORDER BY rank DESC, a.article_number ASC
    LIMIT ${limit}
  `)
  const orArray: FTSRow[] = Array.isArray(orRows) ? (orRows as FTSRow[]) : ((orRows as { rows?: FTSRow[] }).rows ?? [])

  logger.debug(`FTS OR fallback: ${orArray.length} arts in ${law.short_name} (lex: ${lexemes.join(',')})`, { domain: 'search' })
  return orArray.map(r => ({
    id: r.id,
    lawId: r.law_id,
    lawName: law.name,
    lawShortName: law.short_name,
    articleNumber: r.article_number,
    title: r.title,
    content: r.content ?? '',
    similarity: Number(r.rank),
  }))
}

/**
 * Busca artículos directamente por nombre de ley.
 *
 * Si se pasa `query` (mensaje original del usuario), usa Full-Text Search con
 * ts_rank — los artículos más relevantes salen primero. Es el camino preferido
 * desde que existe la columna articles.content_tsv (migración 20260515).
 *
 * Si solo se pasa `searchTerms`, usa el camino legacy con ILIKE ordenado por
 * número de artículo. Se mantiene por compatibilidad con callers antiguos,
 * pero se considera obsoleto.
 */
export async function searchArticlesByLawDirect(
  lawShortName: string,
  options: { limit?: number; searchTerms?: string[] | null; query?: string | null } = {}
): Promise<ArticleMatch[]> {
  const { limit = 15, searchTerms = null, query = null } = options

  // Buscar la ley
  const { data: law, error: lawError } = await getSupabase()
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

  // Camino preferido: FTS con ts_rank cuando recibimos la query original.
  if (query) {
    return searchArticlesByFTS(law, query, limit)
  }

  // Camino legacy: ILIKE con searchTerms, ordenado por número de artículo.
  let supaQuery = getSupabase()
    .from('articles')
    .select('id, law_id, article_number, title, content')
    .eq('law_id', law.id)
    .eq('is_active', true)

  if (searchTerms && searchTerms.length > 0) {
    const orConditions = searchTerms
      .map(term => `title.ilike.%${term}%,content.ilike.%${term}%`)
      .join(',')
    supaQuery = supaQuery.or(orConditions)
    logger.debug(`Legacy ILIKE search in ${lawShortName}: ${searchTerms.join(', ')}`, { domain: 'search' })
  }

  const { data: articlesData, error } = await supaQuery
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
    similarity: 1.0,
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

  const { data: articlesData, error } = await getSupabase()
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
    const { data: law } = await getSupabase()
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

  let query = getSupabase()
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
  const { data: exactMatch } = await getSupabase()
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
  const { data: ciExact } = await getSupabase()
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
  const { data: fuzzyMatch } = await getSupabase()
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

  // 4. Para refs tipo "LO 2/1979", "RD 366/2007", etc., buscar solo por "número/año" en name
  const numYearMatch = name.match(/\d+\/\d{4}/)
  if (numYearMatch) {
    const { data: numYearResult } = await getSupabase()
      .from('laws')
      .select('id, short_name, name')
      .ilike('name', `%${numYearMatch[0]}%`)
      .eq('is_derogated', false)
      .limit(1)
      .single()

    if (numYearResult) {
      logger.debug(`🔎 findLawByName: num/year match for "${name}" → ${numYearResult.short_name}`, { domain: 'search' })
      return {
        id: numYearResult.id,
        shortName: numYearResult.short_name,
        name: numYearResult.name,
      }
    }
  }

  logger.warn(`🔎 findLawByName: no law found for "${name}"`, { domain: 'search' })
  return null
}

/**
 * Obtiene los IDs de leyes para una oposición
 */
export async function getOposicionLawIds(userOposicion: string): Promise<string[]> {
  const { ID_TO_POSITION_TYPE } = await import('@/lib/config/oposiciones')

  const positionType = ID_TO_POSITION_TYPE[userOposicion]
  if (!positionType) return []

  // Obtener topics de esta oposición
  const { data: topics } = await getSupabase()
    .from('topics')
    .select('id')
    .eq('position_type', positionType)

  if (!topics || topics.length === 0) return []

  const topicIds = topics.map(t => t.id)

  // Obtener leyes de estos topics
  const { data: scopes } = await getSupabase()
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

// ============================================
// DETECCIÓN DINÁMICA DE LEYES (desde BD)
// ============================================

// Cache de leyes para detección — TTL 1h, cross-bundle via createGlobalCache (#118)
type _LawDetectionEntry = { id: string; shortName: string; name: string; searchPatterns: string[] }

const _lawsDetectionCache = createGlobalCache<_LawDetectionEntry[]>(
  'chat-search-laws-detection-v1',
  60 * 60 * 1000, // 1 hora
)

/**
 * Carga todas las leyes de la BD con patrones de búsqueda generados.
 */
async function loadLawsForDetection(): Promise<_LawDetectionEntry[]> {
  return _lawsDetectionCache.getOrLoad(async () => {
    const { data } = await getSupabase()
      .from('laws')
      .select('id, short_name, name')
      .eq('is_active', true)

    if (!data || data.length === 0) {
      return []
    }

    // Generar patrones de búsqueda para cada ley
    const entries: _LawDetectionEntry[] = data.map(law => {
      const patterns: string[] = []

      // short_name siempre es un patrón (ej: "LOTC", "CE", "Ley 39/2015")
      if (law.short_name) {
        patterns.push(law.short_name.toLowerCase())
      }

      // Extraer partes del nombre completo para patrones
      if (law.name) {
        const nameLower = law.name.toLowerCase()

        // El nombre completo como patrón
        patterns.push(nameLower)

        // Si contiene "tribunal constitucional", "poder judicial", etc., extraer esos términos
        const institutionMatches = nameLower.match(/tribunal\s+constitucional|poder\s+judicial|consejo\s+de\s+estado|defensor\s+del\s+pueblo|tribunal\s+de\s+cuentas/gi)
        if (institutionMatches) {
          institutionMatches.forEach((m: string) => patterns.push(m.toLowerCase()))
        }

        // Extraer "Ley Orgánica del XXX" -> "XXX"
        const orgMatch = nameLower.match(/ley\s+orgánica\s+(?:del?\s+)?(.+)/i)
        if (orgMatch && orgMatch[1] && orgMatch[1].length > 5) {
          patterns.push(orgMatch[1].trim())
        }
      }

      return {
        id: law.id,
        shortName: law.short_name,
        name: law.name || '',
        searchPatterns: [...new Set(patterns)],
      }
    })

    logger.debug(`📚 Laws detection cache loaded: ${entries.length} laws`, { domain: 'search' })
    return entries
  })
}

/**
 * Detecta leyes mencionadas en un texto usando la BD (dinámico, sin hardcodear)
 * Retorna los short_name de las leyes detectadas
 */
export async function detectLawsFromText(text: string): Promise<string[]> {
  if (!text || text.length < 3) return []

  const textLower = text.toLowerCase()
  const detectedLaws: Array<{ shortName: string; score: number }> = []

  const laws = await loadLawsForDetection()

  for (const law of laws) {
    let score = 0

    // Verificar cada patrón de búsqueda
    for (const pattern of law.searchPatterns) {
      // Crear regex con word boundaries para evitar falsos positivos
      // Escapar caracteres especiales de regex
      const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`\\b${escapedPattern}\\b`, 'i')

      if (regex.test(textLower)) {
        // Mayor score para patrones más largos/específicos
        score += pattern.length
      }
    }

    // Bonus para contexto europeo: evita confundir "Tribunal de Cuentas" UE vs España
    const hasEUContext =
      /\b(unión\s+europea|tratado\s+de\s+la\s+unión|comisión\s+europea|parlamento\s+europeo)\b/i.test(
        textLower
      )
    if (hasEUContext && (law.shortName === 'TUE' || law.shortName === 'TFUE')) {
      score += 50
    }

    if (score > 0) {
      detectedLaws.push({ shortName: law.shortName, score })
    }
  }

  // Ordenar por score (más específico primero) y eliminar duplicados
  return [...new Set(
    detectedLaws
      .sort((a, b) => b.score - a.score)
      .map(l => l.shortName)
  )]
}

// ============================================
// EXTRACCIÓN DE ARTÍCULOS DEL TEXTO
// ============================================

// Mapeo de números ordinales en español a números
const ORDINAL_TO_NUMBER: Record<string, string> = {
  'primero': '1', 'primer': '1', 'primera': '1',
  'segundo': '2', 'segunda': '2',
  'tercero': '3', 'tercer': '3', 'tercera': '3',
  'cuarto': '4', 'cuarta': '4',
  'quinto': '5', 'quinta': '5',
  'sexto': '6', 'sexta': '6',
  'séptimo': '7', 'septimo': '7', 'séptima': '7', 'septima': '7',
  'octavo': '8', 'octava': '8',
  'noveno': '9', 'novena': '9',
  'décimo': '10', 'decimo': '10', 'décima': '10', 'decima': '10',
  'undécimo': '11', 'undecimo': '11',
  'duodécimo': '12', 'duodecimo': '12',
}

/**
 * Extrae números de artículo mencionados en un texto
 * Detecta formatos: "artículo 9", "art. 9", "artículo noveno", "art. noveno"
 */
export function extractArticleNumbers(text: string): string[] {
  if (!text) return []

  const articles: string[] = []
  const textLower = text.toLowerCase()

  // Patrón 1: artículo/art. seguido de número
  const numericPattern = /\b(?:art[ií]culo|art\.?)\s*(\d+(?:\.\d+)?(?:\s*bis)?)/gi
  let match
  while ((match = numericPattern.exec(text)) !== null) {
    articles.push(match[1].trim())
  }

  // Patrón 2: artículo/art. seguido de ordinal (primero, segundo, etc.)
  const ordinalPattern = /\b(?:art[ií]culo|art\.?)\s+(primero?|segunda?|tercero?|tercer|cuarto?|quinto?|sexto?|s[eé]ptimo?|octavo?|noveno?|d[eé]cimo?|und[eé]cimo?|duod[eé]cimo?)\b/gi
  while ((match = ordinalPattern.exec(textLower)) !== null) {
    const ordinal = match[1].toLowerCase()
    const number = ORDINAL_TO_NUMBER[ordinal]
    if (number && !articles.includes(number)) {
      articles.push(number)
    }
  }

  // Patrón 3: número seguido de "ley" o "de la ley" (ej: "131 ley 39", "131 de la ley")
  // Solo números de 1-3 dígitos para evitar falsos positivos con años (39/2015)
  const numberBeforeLawPattern = /\b(\d{1,3})\s+(?:de\s+)?(?:la\s+)?ley\b/gi
  while ((match = numberBeforeLawPattern.exec(text)) !== null) {
    const num = match[1].trim()
    if (!articles.includes(num)) {
      articles.push(num)
    }
  }

  return [...new Set(articles)]
}

/**
 * Busca un artículo específico en una ley
 */
export async function findArticleInLaw(
  lawShortName: string,
  articleNumber: string
): Promise<{
  id: string
  lawId: string
  articleNumber: string
  title: string | null
  content: string | null
  lawShortName: string
  lawName: string
} | null> {
  logger.debug(`🔎 findArticleInLaw: searching ${lawShortName} art. ${articleNumber}`, { domain: 'search' })

  // Primero buscar la ley
  const { data: law } = await getSupabase()
    .from('laws')
    .select('id, short_name, name')
    .eq('short_name', lawShortName)
    .eq('is_active', true)
    .single()

  if (!law) {
    // Intentar búsqueda case-insensitive
    const { data: lawCI } = await getSupabase()
      .from('laws')
      .select('id, short_name, name')
      .ilike('short_name', lawShortName)
      .eq('is_active', true)
      .single()

    if (!lawCI) {
      logger.debug(`🔎 findArticleInLaw: law not found: ${lawShortName}`, { domain: 'search' })
      return null
    }
  }

  const effectiveLaw = law || (await getSupabase()
    .from('laws')
    .select('id, short_name, name')
    .ilike('short_name', lawShortName)
    .eq('is_active', true)
    .single()).data

  if (!effectiveLaw) return null

  // Buscar el artículo en esa ley
  const { data: article } = await getSupabase()
    .from('articles')
    .select('id, article_number, title, content')
    .eq('law_id', effectiveLaw.id)
    .eq('article_number', articleNumber)
    .single()

  if (!article) {
    // Intentar con variantes (ej: "9" vs "9.1")
    const { data: articleFuzzy } = await getSupabase()
      .from('articles')
      .select('id, article_number, title, content')
      .eq('law_id', effectiveLaw.id)
      .ilike('article_number', `${articleNumber}%`)
      .limit(1)
      .single()

    if (!articleFuzzy) {
      logger.debug(`🔎 findArticleInLaw: article ${articleNumber} not found in ${lawShortName}`, { domain: 'search' })
      return null
    }

    return {
      id: articleFuzzy.id,
      lawId: effectiveLaw.id,
      articleNumber: articleFuzzy.article_number,
      title: articleFuzzy.title,
      content: articleFuzzy.content,
      lawShortName: effectiveLaw.short_name,
      lawName: effectiveLaw.name,
    }
  }

  logger.info(`🔎 findArticleInLaw: found ${effectiveLaw.short_name} art. ${article.article_number}`, { domain: 'search' })

  return {
    id: article.id,
    lawId: effectiveLaw.id,
    articleNumber: article.article_number,
    title: article.title,
    content: article.content,
    lawShortName: effectiveLaw.short_name,
    lawName: effectiveLaw.name,
  }
}

// ============================================
// HOT ARTICLES (ARTÍCULOS DE EXÁMENES OFICIALES)
// ============================================

export interface HotArticleResult {
  articleId: string
  articleNumber: string
  lawName: string
  title: string | null
  content: string | null
  totalOfficialAppearances: number
  uniqueExamsCount: number
  priorityLevel: string
  hotnessScore: number
}

/**
 * Resultado de búsqueda de hot articles con metadata
 */
export interface HotArticlesSearchResult {
  articles: HotArticleResult[]
  sourceOposicion: string | null  // La oposición de donde vienen los datos
  isFromUserOposicion: boolean    // true si son datos de la oposición del usuario
}

// Normaliza el slug de oposición del usuario al formato de hot_articles
// Usa mapeo centralizado de lib/config/exam-positions.ts
import { getValidHotArticleTargets } from '@/lib/config/exam-positions'

function normalizeOposicionForHotArticles(oposicion: string): string {
  const targets = getValidHotArticleTargets(oposicion)
  return targets.length > 0 ? targets[0] : oposicion.replace(/_/g, '-')
}

/**
 * Obtiene los artículos más preguntados en exámenes oficiales
 * Filtra por oposición del usuario y opcionalmente por ley
 * Si no hay datos para la oposición del usuario, busca en oposiciones generales
 */
export async function getHotArticlesByOposicion(
  userOposicion: string,
  options: {
    lawShortName?: string
    limit?: number
  } = {}
): Promise<HotArticlesSearchResult> {
  const { lawShortName, limit = 10 } = options

  // Check cache
  const cache = getChatCache()
  const cacheKey = CACHE_KEYS.hotArticles(userOposicion, lawShortName)
  const cached = cache.get<HotArticlesSearchResult>(cacheKey)
  if (cached) {
    logger.debug(`Cache hit: hot articles for ${userOposicion}`, { domain: 'search' })
    return cached
  }

  // Normalizar la oposición del usuario al formato de la BD (con guiones)
  const normalizedOposicion = normalizeOposicionForHotArticles(userOposicion)

  logger.info(`🔥 getHotArticlesByOposicion: oposicion=${userOposicion} -> ${normalizedOposicion}, law=${lawShortName || 'all'}`, { domain: 'search' })

  // Helper para ejecutar query
  const executeQuery = async (targetOposicion: string | null) => {
    let query = getSupabase()
      .from('hot_articles')
      .select(`
        article_id,
        article_number,
        law_name,
        target_oposicion,
        total_official_appearances,
        unique_exams_count,
        priority_level,
        hotness_score
      `)
      .order('hotness_score', { ascending: false })
      .limit(limit)

    if (targetOposicion) {
      query = query.eq('target_oposicion', targetOposicion)
    }

    if (lawShortName) {
      query = query.eq('law_name', lawShortName)
    }

    return query
  }

  // 1. Primero intentar con la oposición del usuario (normalizada)
  const { data: hotArticles, error } = await executeQuery(normalizedOposicion)

  if (error) {
    logger.error('Error fetching hot_articles', error, { domain: 'search' })
    return { articles: [], sourceOposicion: null, isFromUserOposicion: false }
  }

  // Si encontramos datos para la oposición del usuario, usarlos
  if (hotArticles && hotArticles.length > 0) {
    logger.info(`🔥 Found ${hotArticles.length} hot articles for ${normalizedOposicion}`, { domain: 'search' })
    const articles = await enrichHotArticles(hotArticles)
    const result = { articles, sourceOposicion: normalizedOposicion, isFromUserOposicion: true }
    cache.set(cacheKey, result, CACHE_TTL.HOT_ARTICLES)
    return result
  }

  logger.info(`🔥 No hot articles found for ${normalizedOposicion}${lawShortName ? ` in ${lawShortName}` : ''}, trying fallback`, { domain: 'search' })

  // 2. Fallback: buscar en oposiciones similares (valores normalizados con guiones)
  const fallbackOposiciones = ['auxiliar-administrativo-estado', 'administrativo-estado']

  for (const fallbackOposicion of fallbackOposiciones) {
    // No usar fallback si ya es la oposición del usuario normalizada
    if (fallbackOposicion === normalizedOposicion) continue

    const { data: fallbackArticles, error: fallbackError } = await executeQuery(fallbackOposicion)

    if (!fallbackError && fallbackArticles && fallbackArticles.length > 0) {
      logger.info(`🔥 Using fallback data from ${fallbackOposicion}: ${fallbackArticles.length} articles`, { domain: 'search' })
      const articles = await enrichHotArticles(fallbackArticles)
      const result = { articles, sourceOposicion: fallbackOposicion, isFromUserOposicion: false }
      cache.set(cacheKey, result, CACHE_TTL.HOT_ARTICLES)
      return result
    }
  }

  return { articles: [], sourceOposicion: null, isFromUserOposicion: false }
}

/**
 * Enriquece los hot articles con contenido de la tabla articles
 */
async function enrichHotArticles(hotArticles: Array<{
  article_id: string
  article_number: string
  law_name: string
  total_official_appearances: number
  unique_exams_count: number
  priority_level: string
  hotness_score: number
}>): Promise<HotArticleResult[]> {
  const articleIds = hotArticles.map(h => h.article_id)
  const { data: articlesData } = await getSupabase()
    .from('articles')
    .select('id, title, content')
    .in('id', articleIds)

  const articleContentMap: Record<string, { title: string | null; content: string | null }> = {}
  articlesData?.forEach(a => {
    articleContentMap[a.id] = { title: a.title, content: a.content }
  })

  return hotArticles.map(h => ({
    articleId: h.article_id,
    articleNumber: h.article_number,
    lawName: h.law_name,
    title: articleContentMap[h.article_id]?.title || null,
    content: articleContentMap[h.article_id]?.content || null,
    totalOfficialAppearances: h.total_official_appearances,
    uniqueExamsCount: h.unique_exams_count,
    priorityLevel: h.priority_level,
    hotnessScore: h.hotness_score,
  }))
}

/**
 * Formatea los hot articles para mostrar al usuario
 */
export function formatHotArticlesResponse(
  searchResult: HotArticlesSearchResult,
  userOposicion: string,
  options: {
    lawName?: string
    userName?: string
  } = {}
): string {
  const { articles: hotArticles, sourceOposicion, isFromUserOposicion } = searchResult
  const { lawName, userName } = options

  // Nombre legible de las oposiciones (usa config central)
  const getOposicionName = (id: string) => getOposicion(id)?.name || id.replace(/_/g, ' ')

  const userOposicionName = getOposicionName(userOposicion)
  const greeting = userName ? `${userName}, ` : ''

  if (hotArticles.length === 0) {
    return `${greeting}he visto que estás estudiando **${userOposicionName}**, pero en Vence todavía no tenemos datos de exámenes oficiales${lawName ? ` de ${lawName}` : ''} para esta oposición.\n\n💡 *Los artículos de la Constitución que suelen preguntarse están relacionados con derechos fundamentales (arts. 14-29), organización del Estado y procedimientos.*`
  }

  const sourceOposicionName = sourceOposicion ? (getOposicionName(sourceOposicion)) : ''

  let response = ''

  // Indicar si los datos son de otra oposición con mensaje personalizado
  if (!isFromUserOposicion && sourceOposicion) {
    response += `${greeting}he visto que estás estudiando **${userOposicionName}**, pero en Vence todavía no tenemos datos específicos de exámenes oficiales para esta oposición.\n\n`
    response += `Te muestro los datos de **${sourceOposicionName}** que pueden ser útiles como referencia:\n\n`
  } else {
    response += `${greeting}aquí tienes los artículos más preguntados en exámenes oficiales de **${sourceOposicionName}**:\n\n`
  }

  if (lawName) {
    response += `**Ley:** ${lawName}\n\n`
  }

  // Agrupar por ley
  const byLaw: Record<string, HotArticleResult[]> = {}
  hotArticles.forEach(h => {
    if (!byLaw[h.lawName]) byLaw[h.lawName] = []
    byLaw[h.lawName].push(h)
  })

  for (const [law, articles] of Object.entries(byLaw)) {
    response += `### ${law}\n`
    articles.forEach((a, i) => {
      const priorityEmoji = a.priorityLevel === 'critical' ? '🔴' : a.priorityLevel === 'high' ? '🟠' : '🟡'
      const examText = `${a.totalOfficialAppearances} pregunta${a.totalOfficialAppearances > 1 ? 's' : ''}`
      response += `${i + 1}. **Art. ${a.articleNumber}** ${priorityEmoji} (${examText})\n`

      // Mostrar título si existe
      if (a.title) {
        response += `   📌 *${a.title}*\n`
      }

      // Mostrar resumen del contenido (primeras 150 caracteres)
      if (a.content) {
        const summary = a.content.substring(0, 150).replace(/\n/g, ' ').trim()
        const ellipsis = a.content.length > 150 ? '...' : ''
        response += `   → ${summary}${ellipsis}\n`
      }
      response += `\n`
    })
  }

  response += `💡 *Datos de exámenes oficiales anteriores.*`

  return response
}

// ============================================
// VERIFICACIÓN DE PREGUNTAS POR ARTÍCULO
// ============================================

/**
 * Verifica si existe al menos una pregunta para un artículo específico
 */
export async function hasQuestionsForArticle(articleId: string): Promise<boolean> {
  try {
    const { count, error } = await getSupabase()
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('primary_article_id', articleId)
      .eq('is_active', true)
      .limit(1)

    if (error) {
      logger.error('Error checking questions for article', error, { domain: 'search' })
      return false
    }

    return (count ?? 0) > 0
  } catch (e) {
    logger.error('Exception checking questions for article', e, { domain: 'search' })
    return false
  }
}

/**
 * Obtiene el artículo vinculado a una pregunta (primary_article_id).
 * Usado para incluir el artículo de contexto en follow-ups de chat.
 */
export async function getArticleByQuestionId(
  questionId: string
): Promise<{ id: string; articleNumber: string; title: string; content: string; lawId: string; lawShortName: string; lawName: string } | null> {
  try {
    const { data, error } = await getSupabase()
      .from('questions')
      .select('primary_article_id, articles(id, article_number, title, content, law_id, laws(short_name, name))')
      .eq('id', questionId)
      .not('primary_article_id', 'is', null)
      .limit(1)
      .single()

    if (error || !data?.articles) return null

    const art = data.articles as any
    return {
      id: art.id,
      articleNumber: art.article_number,
      title: art.title ?? '',
      content: art.content ?? '',
      lawId: art.law_id,
      lawShortName: art.laws?.short_name ?? '',
      lawName: art.laws?.name ?? '',
    }
  } catch {
    return null
  }
}
