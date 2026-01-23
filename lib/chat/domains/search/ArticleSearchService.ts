// lib/chat/domains/search/ArticleSearchService.ts
// Servicio principal de búsqueda de artículos

import { generateEmbedding } from './EmbeddingService'
import {
  searchArticlesBySimilarity,
  searchArticlesByLawDirect,
  searchArticlesByKeywords,
  searchArticlesForPattern,
  getOposicionLawIds,
  extractSearchTerms,
  findLawByName,
} from './queries'
import {
  detectQueryPattern,
  detectMentionedLaws,
  isGenericLawQuery,
  extractPatternData,
  extractSpecificLawMentions,
} from './PatternMatcher'
import { logger } from '../../shared/logger'
import type { ArticleMatch, ChatContext, DetectedPattern } from '../../core/types'

// ============================================
// TIPOS
// ============================================

export interface SearchResult {
  articles: ArticleMatch[]
  searchMethod: 'semantic' | 'pattern' | 'direct' | 'keywords' | 'fallback'
  pattern?: DetectedPattern
  mentionedLaws: string[]
  contextLaw?: string
}

export interface SearchOptions {
  userOposicion?: string
  contextLawName?: string
  limit?: number
  // Query de búsqueda personalizada (en vez de usar context.currentMessage)
  searchQuery?: string
}

// ============================================
// SERVICIO PRINCIPAL
// ============================================

/**
 * Busca artículos relevantes para el contexto del chat
 * Combina múltiples estrategias de búsqueda
 */
export async function searchArticles(
  context: ChatContext,
  options: SearchOptions = {}
): Promise<SearchResult> {
  const { limit = 10 } = options
  // Usar searchQuery si está disponible, sino el mensaje del usuario
  const message = options.searchQuery || context.currentMessage

  // 1. Obtener ley del contexto - PRIORIDAD: options.contextLawName (detectada dinámicamente) > questionContext.lawName (vinculación estática)
  // Cuando detectamos una ley específica en la pregunta/explicación, esa tiene prioridad sobre el artículo vinculado
  const contextLaw = options.contextLawName || context.questionContext?.lawName

  // 2. PRIMERO: Detectar si el texto menciona una ley específica (Real Decreto, Ley Orgánica, etc.)
  // Esto tiene PRIORIDAD porque el texto de la pregunta dice exactamente qué ley se necesita
  const specificLaws = extractSpecificLawMentions(message)
  if (specificLaws.length > 0) {
    logger.info(`🔎 Detected specific law in text: ${specificLaws.join(', ')}`, { domain: 'search' })

    // Intentar buscar en la ley mencionada
    for (const lawRef of specificLaws) {
      const result = await searchByContextLaw(message, lawRef, limit)
      if (result.articles.length > 0) {
        logger.info(`🔎 Found ${result.articles.length} articles in ${lawRef}`, { domain: 'search' })
        return {
          ...result,
          contextLaw: lawRef,
          mentionedLaws: [lawRef],
        }
      }
    }

    // Si no encontramos artículos de la ley específica mencionada,
    // devolver vacío para usar GPT (mejor que artículos irrelevantes)
    logger.info(`🔎 Law "${specificLaws[0]}" mentioned but not found in DB, using GPT fallback`, { domain: 'search' })
    return {
      articles: [],
      searchMethod: 'fallback',
      mentionedLaws: specificLaws,
      contextLaw: specificLaws[0],
    }
  }

  // 3. Si hay ley del contexto pero NO hay ley específica en el texto, usar contextLaw
  if (contextLaw) {
    logger.info(`🔎 Using context law: ${contextLaw}`, { domain: 'search' })
    const result = await searchByContextLaw(message, contextLaw, limit)
    // Si encontramos artículos, devolverlos
    if (result.articles.length > 0) {
      return {
        ...result,
        contextLaw,
        mentionedLaws: [contextLaw],
      }
    }
    // Si NO encontramos artículos de la ley del contexto,
    // devolver vacío para que use el fallback de GPT
    // (mejor que devolver artículos de otras leyes irrelevantes)
    logger.info(`🔎 No articles found for context law ${contextLaw}, using fallback`, { domain: 'search' })
    return {
      articles: [],
      searchMethod: 'fallback',
      mentionedLaws: [],
      contextLaw,
    }
  }

  // 3. Detectar leyes mencionadas en el mensaje (solo si NO hay contextLaw)
  const mentionedLaws = detectMentionedLaws(message)
  logger.debug(`Mentioned laws: ${mentionedLaws.join(', ') || 'none'}`, { domain: 'search' })

  // 4. Si hay leyes mencionadas, buscar en ellas
  if (mentionedLaws.length > 0) {
    const result = await searchByMentionedLaws(message, mentionedLaws, limit)
    if (result.articles.length > 0) {
      return {
        ...result,
        mentionedLaws,
        contextLaw,
      }
    }
  }

  // 5. Detectar patrón de consulta
  const pattern = detectQueryPattern(message)
  if (pattern) {
    const result = await searchByPattern(pattern, mentionedLaws[0], limit)
    if (result.articles.length > 0) {
      return {
        ...result,
        pattern,
        mentionedLaws,
        contextLaw,
      }
    }
  }

  // 6. Búsqueda semántica general
  const semanticResult = await searchSemantic(message, {
    userOposicion: options.userOposicion,
    contextLawName: contextLaw,
    mentionedLawNames: mentionedLaws,
    limit,
  })

  if (semanticResult.articles.length > 0) {
    return {
      ...semanticResult,
      mentionedLaws,
      contextLaw,
    }
  }

  // 7. Fallback: búsqueda por keywords
  const keywordResult = await searchByKeywords(message, limit)
  return {
    ...keywordResult,
    mentionedLaws,
    contextLaw,
  }
}

// ============================================
// ESTRATEGIAS DE BÚSQUEDA
// ============================================

/**
 * Búsqueda por ley del contexto de pregunta
 */
async function searchByContextLaw(
  message: string,
  lawName: string,
  limit: number
): Promise<SearchResult> {
  logger.info(`🔎 searchByContextLaw START - law: ${lawName}, message: "${message.substring(0, 50)}..."`, { domain: 'search' })

  // Encontrar la ley
  const law = await findLawByName(lawName)
  if (!law) {
    return { articles: [], searchMethod: 'fallback', mentionedLaws: [] }
  }

  // Extraer términos de búsqueda del mensaje
  const searchTerms = extractSearchTerms(message)

  // Buscar directamente en la ley
  const articles = await searchArticlesByLawDirect(law.shortName, {
    limit,
    searchTerms,
  })

  logger.info(`🔎 searchByContextLaw - direct search found ${articles.length} articles`, { domain: 'search' })

  if (articles.length > 0) {
    return {
      articles,
      searchMethod: 'direct',
      mentionedLaws: [law.shortName],
    }
  }

  // Si no hay resultados directos, intentar semántica
  try {
    logger.info(`🔎 searchByContextLaw - trying semantic search for ${law.shortName}`, { domain: 'search' })
    const { embedding } = await generateEmbedding(message)
    const semanticArticles = await searchArticlesBySimilarity(embedding, {
      limit,
      mentionedLawNames: [law.shortName],
    })
    logger.info(`🔎 searchByContextLaw - semantic search found ${semanticArticles.length} articles`, { domain: 'search' })

    return {
      articles: semanticArticles,
      searchMethod: 'semantic',
      mentionedLaws: [law.shortName],
    }
  } catch (error) {
    logger.error('Error in semantic search for context law', error, { domain: 'search' })
    return { articles: [], searchMethod: 'fallback', mentionedLaws: [] }
  }
}

/**
 * Búsqueda por leyes mencionadas en el mensaje
 */
async function searchByMentionedLaws(
  message: string,
  mentionedLaws: string[],
  limit: number
): Promise<SearchResult> {
  logger.info(`Searching by mentioned laws: ${mentionedLaws.join(', ')}`, { domain: 'search' })

  const allArticles: ArticleMatch[] = []

  // Buscar en cada ley mencionada
  for (const lawName of mentionedLaws) {
    const law = await findLawByName(lawName)
    if (!law) continue

    const searchTerms = extractSearchTerms(message)
    const articles = await searchArticlesByLawDirect(law.shortName, {
      limit: Math.ceil(limit / mentionedLaws.length),
      searchTerms,
    })

    allArticles.push(...articles)
  }

  if (allArticles.length > 0) {
    return {
      articles: allArticles.slice(0, limit),
      searchMethod: 'direct',
      mentionedLaws,
    }
  }

  // Fallback a búsqueda semántica con filtro de leyes
  try {
    const { embedding } = await generateEmbedding(message)
    const articles = await searchArticlesBySimilarity(embedding, {
      limit,
      mentionedLawNames: mentionedLaws,
    })

    return {
      articles,
      searchMethod: 'semantic',
      mentionedLaws,
    }
  } catch (error) {
    logger.error('Error in semantic search for mentioned laws', error, { domain: 'search' })
    return { articles: [], searchMethod: 'fallback', mentionedLaws }
  }
}

/**
 * Búsqueda por patrón detectado
 */
async function searchByPattern(
  pattern: DetectedPattern,
  lawShortName: string | undefined,
  limit: number
): Promise<SearchResult> {
  logger.info(`Searching by pattern: ${pattern.type}`, { domain: 'search' })

  const articles = await searchArticlesForPattern(pattern.keywords, {
    lawShortName: lawShortName || null,
    limit,
  })

  return {
    articles,
    searchMethod: 'pattern',
    pattern,
    mentionedLaws: lawShortName ? [lawShortName] : [],
  }
}

/**
 * Búsqueda semántica general
 */
async function searchSemantic(
  message: string,
  options: {
    userOposicion?: string
    contextLawName?: string
    mentionedLawNames?: string[]
    limit: number
  }
): Promise<SearchResult> {
  logger.info('Performing semantic search', { domain: 'search' })

  try {
    const { embedding } = await generateEmbedding(message)

    // Obtener leyes prioritarias de la oposición
    const priorityLawIds = options.userOposicion
      ? await getOposicionLawIds(options.userOposicion)
      : []

    const articles = await searchArticlesBySimilarity(embedding, {
      limit: options.limit,
      priorityLawIds,
      mentionedLawNames: options.mentionedLawNames || [],
      contextLawName: options.contextLawName || null,
    })

    return {
      articles,
      searchMethod: 'semantic',
      mentionedLaws: options.mentionedLawNames || [],
    }
  } catch (error) {
    logger.error('Error in semantic search', error, { domain: 'search' })
    return { articles: [], searchMethod: 'fallback', mentionedLaws: [] }
  }
}

/**
 * Búsqueda por keywords (fallback)
 */
async function searchByKeywords(
  message: string,
  limit: number
): Promise<SearchResult> {
  logger.info('Falling back to keyword search', { domain: 'search' })

  const articles = await searchArticlesByKeywords(message, { limit })

  return {
    articles,
    searchMethod: 'keywords',
    mentionedLaws: [],
  }
}

// ============================================
// HELPERS PÚBLICOS
// ============================================

/**
 * Detecta si el usuario pide el texto literal/completo de un artículo
 */
export function wantsLiteralContent(message: string): boolean {
  const msgLower = message.toLowerCase()
  const patterns = [
    /art[ií]culo\s*(literal|completo|[ií]ntegro|exacto|textual)/i,
    /texto\s*(literal|completo|[ií]ntegro|exacto)/i,
    /(dame|dime|mu[eé]strame|pon)\s*(el\s*)?(art[ií]culo|texto)\s*(literal|completo|entero)?/i,
    /qu[eé]\s*(dice|pone)\s*(exactamente|literalmente)/i,
    /lo\s*que\s*pone\s*(el\s*)?art[ií]culo/i,
    /redacci[oó]n\s*(literal|exacta|completa)/i,
    /contenido\s*(completo|[ií]ntegro|literal)/i,
    /transcri(be|pci[oó]n)/i,
  ]
  return patterns.some(p => p.test(msgLower))
}

interface FormatOptions {
  fullContent?: boolean
  maxContentLength?: number
}

/**
 * Formatea artículos para incluir en el contexto de OpenAI
 * @param articles - Lista de artículos encontrados
 * @param options - Opciones de formateo
 *   - fullContent: true para incluir contenido completo sin truncar
 *   - maxContentLength: longitud máxima del contenido (default: 500)
 */
export function formatArticlesForContext(
  articles: ArticleMatch[],
  options?: FormatOptions
): string {
  if (articles.length === 0) {
    return 'No se encontraron artículos relevantes.'
  }

  const fullContent = options?.fullContent ?? false
  const maxLength = options?.maxContentLength ?? 500

  return articles
    .map((art, i) => {
      const header = `[${i + 1}] ${art.lawShortName} - Art. ${art.articleNumber}`
      const title = art.title ? `\n${art.title}` : ''
      let content = ''
      if (art.content) {
        if (fullContent) {
          // Contenido completo sin truncar
          content = `\n${art.content}`
        } else {
          // Truncar a maxLength caracteres
          content = `\n${art.content.substring(0, maxLength)}${art.content.length > maxLength ? '...' : ''}`
        }
      }
      return `${header}${title}${content}`
    })
    .join('\n\n---\n\n')
}

/**
 * Genera sugerencias basadas en los resultados
 */
export function generateSearchSuggestions(result: SearchResult): string[] {
  const suggestions: string[] = []

  if (result.pattern) {
    suggestions.push(`Ver más sobre ${result.pattern.type}`)
    if (result.pattern.suggestedLaws) {
      result.pattern.suggestedLaws.forEach(law => {
        suggestions.push(`${result.pattern?.type} en ${law}`)
      })
    }
  }

  if (result.articles.length > 0) {
    const laws = [...new Set(result.articles.map(a => a.lawShortName))]
    laws.slice(0, 2).forEach(law => {
      suggestions.push(`Más artículos de ${law}`)
    })
  }

  return suggestions.slice(0, 4)
}

// Re-exportar funciones útiles
export { detectQueryPattern, detectMentionedLaws, isGenericLawQuery }
