// lib/chat/domains/search/schemas.ts
// Schemas Zod para el dominio de búsqueda

import { z } from 'zod'

// ============================================
// SCHEMAS DE ARTÍCULOS
// ============================================

export const articleMatchSchema = z.object({
  id: z.string().uuid(),
  lawId: z.string().uuid(),
  lawName: z.string(),
  lawShortName: z.string(),
  articleNumber: z.string(),
  title: z.string().nullable(),
  content: z.string().nullable(),
  similarity: z.number().min(0).max(1).optional(),
})

export type ArticleMatchSchema = z.infer<typeof articleMatchSchema>

// ============================================
// SCHEMAS DE BÚSQUEDA
// ============================================

export const searchOptionsSchema = z.object({
  limit: z.number().int().positive().max(50).default(10),
  minSimilarity: z.number().min(0).max(1).default(0.2),
  lawId: z.string().uuid().optional(),
  onlyActive: z.boolean().default(true),
})

export type SearchOptionsSchema = z.infer<typeof searchOptionsSchema>

export const semanticSearchOptionsSchema = searchOptionsSchema.extend({
  priorityLawIds: z.array(z.string().uuid()).default([]),
  mentionedLawNames: z.array(z.string()).default([]),
  contextLawName: z.string().nullable().default(null),
})

export type SemanticSearchOptionsSchema = z.infer<typeof semanticSearchOptionsSchema>

// ============================================
// SCHEMAS DE PATRONES
// ============================================

export const patternTypeSchema = z.enum([
  'plazo',
  'recurso',
  'organo',
  'procedimiento',
  'sancion',
  'requisito',
  'competencia',
  'general',
])

export type PatternTypeSchema = z.infer<typeof patternTypeSchema>

export const detectedPatternSchema = z.object({
  type: patternTypeSchema,
  confidence: z.number().min(0).max(1),
  keywords: z.array(z.string()),
  suggestedLaws: z.array(z.string()).optional(),
})

export type DetectedPatternSchema = z.infer<typeof detectedPatternSchema>

// ============================================
// SCHEMAS DE RESULTADOS
// ============================================

export const searchMethodSchema = z.enum([
  'semantic',
  'pattern',
  'direct',
  'keywords',
  'fallback',
])

export type SearchMethodSchema = z.infer<typeof searchMethodSchema>

export const searchResultSchema = z.object({
  articles: z.array(articleMatchSchema),
  searchMethod: searchMethodSchema,
  pattern: detectedPatternSchema.optional(),
  mentionedLaws: z.array(z.string()),
  contextLaw: z.string().optional(),
})

export type SearchResultSchema = z.infer<typeof searchResultSchema>

// ============================================
// SCHEMAS DE EMBEDDINGS
// ============================================

export const embeddingResultSchema = z.object({
  embedding: z.array(z.number()).length(1536),
  model: z.string(),
  tokens: z.number().int().nonnegative(),
})

export type EmbeddingResultSchema = z.infer<typeof embeddingResultSchema>

// ============================================
// SCHEMAS DE LEYES
// ============================================

export const lawInfoSchema = z.object({
  id: z.string().uuid(),
  shortName: z.string(),
  name: z.string(),
  isDerogated: z.boolean().default(false),
})

export type LawInfoSchema = z.infer<typeof lawInfoSchema>

// ============================================
// VALIDADORES
// ============================================

export function validateSearchOptions(data: unknown): SearchOptionsSchema {
  return searchOptionsSchema.parse(data)
}

export function validateArticleMatch(data: unknown): ArticleMatchSchema {
  return articleMatchSchema.parse(data)
}

export function validateSearchResult(data: unknown): SearchResultSchema {
  return searchResultSchema.parse(data)
}
