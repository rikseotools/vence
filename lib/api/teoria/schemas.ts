// lib/api/teoria/schemas.ts - Schemas Zod para Sistema de Teoría
import { z } from 'zod'

// ============================================
// SCHEMAS BASE
// ============================================

export const LawBasicSchema = z.object({
  id: z.string().uuid(),
  shortName: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  slug: z.string(),
})

export const ArticleSchema = z.object({
  id: z.string().uuid(),
  articleNumber: z.string(),
  title: z.string().nullable(),
  content: z.string().nullable(),
  contentLength: z.number(),
  contentPreview: z.string(),
  hasRichContent: z.boolean(),
  law: LawBasicSchema,
})

export const ArticleDetailSchema = ArticleSchema.extend({
  cleanContent: z.string(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
})

export const RelatedArticleSchema = z.object({
  articleNumber: z.string(),
  title: z.string().nullable(),
  contentPreview: z.string(),
  lawSlug: z.string(),
})

// ============================================
// SCHEMAS DE NAVEGACIÓN (OPTIMIZADO)
// ============================================

// Solo números de artículos para navegación prev/next (muy ligero)
export const ArticleNavigationSchema = z.object({
  articleNumbers: z.array(z.number()),
  totalCount: z.number(),
})

// ============================================
// SCHEMAS DE RESPUESTA
// ============================================

export const ArticleContentResponseSchema = z.object({
  success: z.boolean(),
  article: ArticleDetailSchema.optional(),
  error: z.string().optional(),
})

export const ArticleListResponseSchema = z.object({
  success: z.boolean(),
  articles: z.array(ArticleSchema).optional(),
  law: LawBasicSchema.optional(),
  notFound: z.boolean().optional(),
  error: z.string().optional(),
})

export const LawListResponseSchema = z.object({
  success: z.boolean(),
  laws: z.array(LawBasicSchema.extend({
    articleCount: z.number(),
  })).optional(),
  error: z.string().optional(),
})

// ============================================
// TIPOS TYPESCRIPT
// ============================================

export type LawBasic = z.infer<typeof LawBasicSchema>
export type Article = z.infer<typeof ArticleSchema>
export type ArticleDetail = z.infer<typeof ArticleDetailSchema>
export type RelatedArticle = z.infer<typeof RelatedArticleSchema>
export type ArticleNavigation = z.infer<typeof ArticleNavigationSchema>
export type ArticleContentResponse = z.infer<typeof ArticleContentResponseSchema>
export type ArticleListResponse = z.infer<typeof ArticleListResponseSchema>
export type LawListResponse = z.infer<typeof LawListResponseSchema>
