// lib/chat/domains/knowledge-base/index.ts
// Exports públicos del dominio Knowledge Base

// Dominio principal
export { KnowledgeBaseDomain, getKnowledgeBaseDomain } from './KnowledgeBaseDomain'

// Servicios
export {
  searchKB,
  formatKBContext,
  getShortAnswer,
  generateKBSuggestions,
  getPredefinedResponse,
  isPlatformQuery,
  detectCategory,
  type KBSearchResult,
  type KBCategory,
} from './KnowledgeBaseService'

// Queries
export {
  searchKnowledgeBase,
  searchKnowledgeBaseByKeywords,
  getByCategory,
  getById,
  extractPlatformKeywords,
  type KnowledgeBaseEntry,
} from './queries'

// Schemas
export * from './schemas'
