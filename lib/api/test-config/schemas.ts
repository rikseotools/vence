// lib/api/test-config/schemas.ts - Schemas de validación para configurador de tests
import { z } from 'zod'
import { POSITION_TYPES_ENUM } from '@/lib/config/oposiciones'
import { sectionFilterSchema } from '@/lib/api/filtered-questions/schemas'

// ============================================
// ARTÍCULOS POR LEY
// ============================================

export const getArticlesRequestSchema = z.object({
  lawShortName: z.string().min(1),
  topicNumber: z.number().int().min(1).nullish(), // null = configurador standalone
  positionType: z.enum(POSITION_TYPES_ENUM),
  includeOfficialCount: z.boolean().default(false),
})

export type GetArticlesRequest = z.infer<typeof getArticlesRequestSchema>

export const articleItemSchema = z.object({
  article_number: z.union([z.number(), z.string()]),
  title: z.string().nullable(),
  question_count: z.number().int(),
  official_question_count: z.number().int().optional(),
})

export type ArticleItem = z.infer<typeof articleItemSchema>

export const getArticlesResponseSchema = z.object({
  success: z.boolean(),
  articles: z.array(articleItemSchema).optional(),
  error: z.string().optional(),
})

export type GetArticlesResponse = z.infer<typeof getArticlesResponseSchema>

// ============================================
// ESTIMACIÓN DE PREGUNTAS DISPONIBLES
// ============================================

export const estimateQuestionsRequestSchema = z.object({
  topicNumber: z.number().int().min(1).nullish(),
  positionType: z.enum(POSITION_TYPES_ENUM),
  selectedLaws: z.array(z.string()).default([]),
  selectedArticlesByLaw: z.record(z.string(), z.array(z.union([z.number().int(), z.string()]))).default({}),
  selectedSectionFilters: z.array(sectionFilterSchema).default([]),
  onlyOfficialQuestions: z.boolean().default(false),
  difficultyMode: z.enum(['random', 'easy', 'medium', 'hard', 'extreme', 'adaptive']).default('random'),
  focusEssentialArticles: z.boolean().default(false),
})

export type EstimateQuestionsRequest = z.infer<typeof estimateQuestionsRequestSchema>

export const estimateQuestionsResponseSchema = z.object({
  success: z.boolean(),
  count: z.number().int().optional(),
  byLaw: z.record(z.string(), z.number().int()).optional(),
  error: z.string().optional(),
})

export type EstimateQuestionsResponse = z.infer<typeof estimateQuestionsResponseSchema>

// ============================================
// ARTÍCULOS IMPRESCINDIBLES
// ============================================

export const getEssentialArticlesRequestSchema = z.object({
  topicNumber: z.number().int().min(1),
  positionType: z.enum(POSITION_TYPES_ENUM),
})

export type GetEssentialArticlesRequest = z.infer<typeof getEssentialArticlesRequestSchema>

export const essentialArticleItemSchema = z.object({
  number: z.union([z.number(), z.string()]),
  law: z.string(),
  questionsCount: z.number().int(),
})

export type EssentialArticleItem = z.infer<typeof essentialArticleItemSchema>

export const getEssentialArticlesResponseSchema = z.object({
  success: z.boolean(),
  essentialCount: z.number().int().optional(),
  essentialArticles: z.array(essentialArticleItemSchema).optional(),
  totalQuestions: z.number().int().optional(),
  byDifficulty: z.record(z.string(), z.number().int()).optional(),
  error: z.string().optional(),
})

export type GetEssentialArticlesResponse = z.infer<typeof getEssentialArticlesResponseSchema>

// ============================================
// VALIDADORES HELPER
// ============================================

export function safeParseGetArticles(data: unknown) {
  return getArticlesRequestSchema.safeParse(data)
}

export function validateGetArticles(data: unknown): GetArticlesRequest {
  return getArticlesRequestSchema.parse(data)
}

export function safeParseEstimateQuestions(data: unknown) {
  return estimateQuestionsRequestSchema.safeParse(data)
}

export function validateEstimateQuestions(data: unknown): EstimateQuestionsRequest {
  return estimateQuestionsRequestSchema.parse(data)
}

export function safeParseGetEssentialArticles(data: unknown) {
  return getEssentialArticlesRequestSchema.safeParse(data)
}

export function validateGetEssentialArticles(data: unknown): GetEssentialArticlesRequest {
  return getEssentialArticlesRequestSchema.parse(data)
}
