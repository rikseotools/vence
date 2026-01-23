// lib/chat/domains/search/index.ts
// Exports públicos del dominio Search

// Dominio principal
export { SearchDomain, getSearchDomain } from './SearchDomain'

// Servicios
export {
  searchArticles,
  formatArticlesForContext,
  wantsLiteralContent,
  generateSearchSuggestions,
  detectMentionedLaws,
  isGenericLawQuery,
  type SearchResult,
  type SearchOptions,
} from './ArticleSearchService'

export {
  generateEmbedding,
  generateEmbeddingsBatch,
  clearEmbeddingCache,
  getEmbeddingCacheStats,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
} from './EmbeddingService'

export {
  detectQueryPattern,
  getPatternKeywords,
  getAllPatterns,
  extractPatternData,
} from './PatternMatcher'

// Queries
export {
  searchArticlesBySimilarity,
  searchArticlesByLawDirect,
  searchArticlesByKeywords,
  searchArticlesForPattern,
  getOposicionLawIds,
  extractSearchTerms,
  findLawByName,
  detectLawsFromText,
  extractArticleNumbers,
  findArticleInLaw,
} from './queries'

// Schemas
export * from './schemas'
