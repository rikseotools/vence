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
  const message = context.currentMessage

  // 1. Detectar leyes mencionadas en el mensaje
  const mentionedLaws = detectMentionedLaws(message)
  logger.debug(`Mentioned laws: ${mentionedLaws.join(', ') || 'none'}`, { domain: 'search' })

  // 2. Obtener ley del contexto de pregunta si existe
  const contextLaw = context.questionContext?.lawName || options.contextLawName

  // 3. Si hay ley del contexto y NO hay leyes mencionadas, priorizar contexto
  if (contextLaw && mentionedLaws.length === 0) {
    logger.info(`Using context law: ${contextLaw}`, { domain: 'search' })
    const result = await searchByContextLaw(message, contextLaw, limit)
    if (result.articles.length > 0) {
      return {
        ...result,
        contextLaw,
        mentionedLaws,
      }
    }
  }

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
  logger.info(`Searching by context law: ${lawName}`, { domain: 'search' })

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

  if (articles.length > 0) {
    return {
      articles,
      searchMethod: 'direct',
      mentionedLaws: [law.shortName],
    }
  }

  // Si no hay resultados directos, intentar semántica
  try {
    const { embedding } = await generateEmbedding(message)
    const semanticArticles = await searchArticlesBySimilarity(embedding, {
      limit,
      mentionedLawNames: [law.shortName],
    })

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
 * Formatea artículos para incluir en el contexto de OpenAI
 */
export function formatArticlesForContext(articles: ArticleMatch[]): string {
  if (articles.length === 0) {
    return 'No se encontraron artículos relevantes.'
  }

  return articles
    .map((art, i) => {
      const header = `[${i + 1}] ${art.lawShortName} - Art. ${art.articleNumber}`
      const title = art.title ? `\n${art.title}` : ''
      const content = art.content
        ? `\n${art.content.substring(0, 500)}${art.content.length > 500 ? '...' : ''}`
        : ''
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
