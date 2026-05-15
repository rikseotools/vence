// lib/chat/domains/search/ArticleSearchService.ts
// Servicio principal de búsqueda de artículos

import { generateEmbedding } from './EmbeddingService'
import {
  searchArticlesBySimilarity,
  searchArticlesByLawDirect,
  searchArticlesByKeywords,
  searchArticlesForPattern,
  getOposicionLawIds,
  findLawByName,
  extractArticleNumbers,
  findArticleInLaw,
  getArticleByQuestionId,
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

  // 0. PRIORIDAD ABSOLUTA: Si hay pregunta con artículo vinculado, incluirlo siempre
  // En follow-ups ("Y en qué casos..."), el artículo de la pregunta es el contexto más relevante
  let contextArticle: ArticleMatch | null = null
  if (context.questionContext?.questionId) {
    const linked = await getArticleByQuestionId(context.questionContext.questionId)
    if (linked) {
      contextArticle = {
        id: linked.id,
        lawId: linked.lawId,
        articleNumber: linked.articleNumber,
        title: linked.title,
        content: linked.content,
        lawShortName: linked.lawShortName,
        lawName: linked.lawName,
      }
      logger.info(`🔎 Context article from question: Art. ${linked.articleNumber} of ${linked.lawShortName}`, { domain: 'search' })
    }
  }

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

    // Prepend context article if it exists and isn't already in results
    const articles = contextArticle && !result.articles.some(a => a.id === contextArticle!.id)
      ? [contextArticle, ...result.articles]
      : result.articles

    if (articles.length > 0) {
      return {
        ...result,
        articles,
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
        contextLaw: contextLaw ?? undefined,
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
        contextLaw: contextLaw ?? undefined,
      }
    }
  }

  // 6. Búsqueda semántica general
  const semanticResult = await searchSemantic(message, {
    userOposicion: options.userOposicion,
    contextLawName: contextLaw ?? undefined,
    mentionedLawNames: mentionedLaws,
    limit,
  })

  if (semanticResult.articles.length > 0) {
    return {
      ...semanticResult,
      mentionedLaws,
      contextLaw: contextLaw ?? undefined,
    }
  }

  // 7. Fallback: if we have the context article from the question, use it
  if (contextArticle) {
    logger.info(`🔎 Using context article as fallback: Art. ${contextArticle.articleNumber} of ${contextArticle.lawShortName}`, { domain: 'search' })
    return {
      articles: [contextArticle],
      searchMethod: 'direct',
      mentionedLaws: contextArticle.lawShortName ? [contextArticle.lawShortName] : [],
      contextLaw: contextArticle.lawShortName || contextLaw || undefined,
    }
  }

  // 8. Fallback: búsqueda por keywords
  const keywordResult = await searchByKeywords(message, limit)
  return {
    ...keywordResult,
    mentionedLaws,
    contextLaw: contextLaw ?? undefined,
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

  // Primero: intentar buscar artículos específicos mencionados (ej: "art 131")
  const articleNumbers = extractArticleNumbers(message)
  if (articleNumbers.length > 0) {
    logger.info(`🔎 searchByContextLaw - detected article numbers: ${articleNumbers.join(', ')}`, { domain: 'search' })

    const specificArticles: ArticleMatch[] = []
    for (const artNum of articleNumbers) {
      const found = await findArticleInLaw(law.shortName, artNum)
      if (found) {
        specificArticles.push({
          id: found.id,
          lawId: found.lawId,
          articleNumber: found.articleNumber,
          title: found.title,
          content: found.content ?? '',
          lawShortName: found.lawShortName,
          lawName: found.lawName,
        })
      }
    }

    if (specificArticles.length > 0) {
      logger.info(`🔎 searchByContextLaw - found ${specificArticles.length} specific articles by number`, { domain: 'search' })
      return {
        articles: specificArticles,
        searchMethod: 'direct',
        mentionedLaws: [law.shortName],
      }
    }
  }

  // Si no hay artículos específicos o no se encontraron, buscar con FTS
  // (ranking por relevancia ts_rank, no por número de artículo).
  const articles = await searchArticlesByLawDirect(law.shortName, {
    limit,
    query: message,
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

  // PASO 1: si el usuario cita números de artículo específicos (ej: "art 46 de la Ley 7/1985"),
  // buscarlos directamente en cada ley mencionada. Así un "Artículo 46 de la ley 7/1985"
  // no devuelve arts 1, 10, 100 por keyword sino el 46 exacto.
  const articleNumbers = extractArticleNumbers(message)
  if (articleNumbers.length > 0) {
    const specificArticles: ArticleMatch[] = []
    for (const lawName of mentionedLaws) {
      const law = await findLawByName(lawName)
      if (!law) continue
      for (const artNum of articleNumbers) {
        const found = await findArticleInLaw(law.shortName, artNum)
        if (found) {
          specificArticles.push({
            id: found.id,
            lawId: found.lawId,
            articleNumber: found.articleNumber,
            title: found.title,
            content: found.content ?? '',
            lawShortName: found.lawShortName,
            lawName: found.lawName,
          })
        }
      }
    }
    if (specificArticles.length > 0) {
      logger.info(`searchByMentionedLaws: found ${specificArticles.length} specific article(s) by number`, { domain: 'search' })
      return {
        articles: specificArticles.slice(0, limit),
        searchMethod: 'direct',
        mentionedLaws,
      }
    }
  }

  const allArticles: ArticleMatch[] = []

  // Buscar en cada ley mencionada
  for (const lawName of mentionedLaws) {
    const law = await findLawByName(lawName)
    if (!law) continue

    const articles = await searchArticlesByLawDirect(law.shortName, {
      limit: Math.ceil(limit / mentionedLaws.length),
      query: message,
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
 * Cuando el usuario pide un artículo específico por número, asumimos que quiere el texto completo
 */
export function wantsLiteralContent(message: string): boolean {
  const patterns = [
    // Peticiones explícitas de contenido literal
    /art[ií]culo\s*(literal|completo|[ií]ntegro|exacto|textual)/i,
    /texto\s*(literal|completo|[ií]ntegro|exacto)/i,
    /qu[eé]\s*(dice|pone)\s*(exactamente|literalmente)/i,
    /lo\s*que\s*pone\s*(el\s*)?art[ií]culo/i,
    /redacci[oó]n\s*(literal|exacta|completa)/i,
    /contenido\s*(completo|[ií]ntegro|literal)/i,
    /transcri(be|pci[oó]n)/i,
    // Peticiones directas de artículo específico (dame el art X, dime el artículo Y)
    /(dame|dime|mu[eé]strame|pon(me)?)\s*(el\s*)?(art[ií]culo|art\.?)\s*\d+/i,
    // "art(ículo) + número + ley/código" - ej: "art 131 ley 39", "artículo 21 de la ley 39/2015"
    /\b(art[ií]culo|art\.?)\s*\d+[^\d]*(ley|ce\b|constituci[oó]n|estatuto|reglamento|lpac|lrjsp|ebep|trebep|lo\s*\d)/i,
    // "número + ley" sin "art" - ej: "131 ley 39", "168 CE", "21 de la ley 39/2015"
    /\b\d{1,3}\s+(?:de\s+)?(?:la\s+)?(?:ley|ce\b|constituci[oó]n)/i,
  ]
  // If the user explicitly asks for a summary/scheme, they don't want literal text
  if (/\b(resum|esquema|sintetiza|simplifica)/i.test(message)) return false

  return patterns.some(p => p.test(message))
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
