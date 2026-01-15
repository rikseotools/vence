// lib/api/topic-progress/schemas.ts
// Schemas de validación para progreso por tema y artículos débiles
import { z } from 'zod/v3'

// ============================================
// ARTÍCULO DÉBIL
// ============================================

export const weakArticleSchema = z.object({
  lawName: z.string(),
  articleNumber: z.string(),
  failedCount: z.number().int().min(1),
  avgSuccessRate: z.number().int().min(0).max(100),
})

export type WeakArticle = z.infer<typeof weakArticleSchema>

// ============================================
// PROGRESO POR TEMA
// ============================================

export const topicProgressSchema = z.object({
  topicNumber: z.number().int().min(1),
  accuracy: z.number().int().min(0).max(100),
  questionsAnswered: z.number().int().min(0),
  masteryLevel: z.enum(['beginner', 'good', 'expert']).nullable(),
  lastStudy: z.string().datetime().nullable(),
})

export type TopicProgress = z.infer<typeof topicProgressSchema>

// ============================================
// REQUEST: OBTENER PROGRESO DE TEMAS
// ============================================

export const getTopicProgressRequestSchema = z.object({
  userId: z.string().uuid('ID de usuario inválido'),
  positionType: z.string().optional(), // Para filtrar por oposición
})

export type GetTopicProgressRequest = z.infer<typeof getTopicProgressRequestSchema>

// ============================================
// RESPONSE: PROGRESO DE TEMAS
// ============================================

export const getTopicProgressResponseSchema = z.object({
  success: z.boolean(),
  progress: z.record(z.string(), topicProgressSchema).optional(),
  error: z.string().optional(),
})

export type GetTopicProgressResponse = z.infer<typeof getTopicProgressResponseSchema>

// ============================================
// REQUEST: OBTENER ARTÍCULOS DÉBILES
// ============================================

export const getWeakArticlesRequestSchema = z.object({
  userId: z.string().uuid('ID de usuario inválido'),
  minAttempts: z.number().int().min(1).default(2),
  maxSuccessRate: z.number().int().min(0).max(100).default(60),
  maxPerTopic: z.number().int().min(1).max(10).default(5),
  positionType: z.string().optional(), // Para filtrar topic_scope por oposición
})

export type GetWeakArticlesRequest = z.infer<typeof getWeakArticlesRequestSchema>

// ============================================
// RESPONSE: ARTÍCULOS DÉBILES POR TEMA
// ============================================

export const getWeakArticlesResponseSchema = z.object({
  success: z.boolean(),
  weakArticlesByTopic: z.record(z.string(), z.array(weakArticleSchema)).optional(),
  error: z.string().optional(),
})

export type GetWeakArticlesResponse = z.infer<typeof getWeakArticlesResponseSchema>

// ============================================
// VALIDADORES
// ============================================

export function safeParseGetTopicProgress(data: unknown) {
  return getTopicProgressRequestSchema.safeParse(data)
}

export function safeParseGetWeakArticles(data: unknown) {
  return getWeakArticlesRequestSchema.safeParse(data)
}
