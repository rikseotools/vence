// lib/api/verify-articles/schemas.ts - Zod schemas para verificación de artículos
import { z } from 'zod/v3'

// ============================================
// PARAMS: Verificación de artículos
// ============================================

export const verifyArticlesParamsSchema = z.object({
  lawId: z.string().uuid().optional(),
  law: z.string().min(1).optional(),
  includeDisposiciones: z.boolean().default(false),
}).refine(data => data.lawId || data.law, {
  message: 'Se requiere lawId o law (short_name)',
})

export type VerifyArticlesParams = z.infer<typeof verifyArticlesParamsSchema>

// ============================================
// PARAMS: Add missing articles
// ============================================

export const addMissingParamsSchema = z.object({
  lawId: z.string().uuid('lawId debe ser un UUID válido'),
  articleNumbers: z.array(z.string().min(1)).min(1, 'Se requiere al menos un articleNumber'),
  includeDisposiciones: z.boolean().default(false),
})

export type AddMissingParams = z.infer<typeof addMissingParamsSchema>

// ============================================
// PARAMS: AI Verify Article (batch)
// ============================================

export const aiVerifyArticleParamsSchema = z.object({
  lawId: z.string().uuid('lawId debe ser un UUID válido'),
  articleNumber: z.string().min(1, 'Se requiere articleNumber'),
  provider: z.enum(['openai', 'claude', 'anthropic', 'google']).default('openai'),
  model: z.string().optional(),
  questionIds: z.array(z.string().uuid()).nullable().optional(),
})

export type AiVerifyArticleParams = z.infer<typeof aiVerifyArticleParamsSchema>

// ============================================
// PARAMS: AI Verify (single question)
// ============================================

export const aiVerifySingleParamsSchema = z.object({
  lawId: z.string().uuid('lawId debe ser un UUID válido'),
  articleNumber: z.string().min(1, 'Se requiere articleNumber'),
  questionId: z.string().uuid('questionId debe ser un UUID válido'),
  provider: z.enum(['openai', 'claude']).default('openai'),
})

export type AiVerifySingleParams = z.infer<typeof aiVerifySingleParamsSchema>

// ============================================
// PARAMS: Apply fix
// ============================================

export const applyFixParamsSchema = z.object({
  questionId: z.string().uuid('questionId debe ser un UUID válido'),
  newCorrectOption: z.enum(['A', 'B', 'C', 'D']).optional(),
  newExplanation: z.string().optional(),
  verificationId: z.string().uuid().optional(),
  appliedBy: z.string().default('admin'),
})

export type ApplyFixParams = z.infer<typeof applyFixParamsSchema>

// ============================================
// PARAMS: Discard verification
// ============================================

export const discardParamsSchema = z.object({
  questionId: z.string().uuid('questionId debe ser un UUID válido'),
  discarded: z.boolean(),
})

export type DiscardParams = z.infer<typeof discardParamsSchema>

// ============================================
// PARAMS: Batch info
// ============================================

export const batchInfoParamsSchema = z.object({
  lawId: z.string().uuid('lawId debe ser un UUID válido'),
  articleNumbers: z.array(z.string().min(1)).min(1),
  model: z.string().optional(),
})

export type BatchInfoParams = z.infer<typeof batchInfoParamsSchema>

// ============================================
// PARAMS: Update titles
// ============================================

export const updateTitlesArticleSchema = z.object({
  article_number: z.string().min(1),
  boe_title: z.string().optional(),
  db_title: z.string().optional(),
  db_id: z.string().uuid().optional(),
})

export const updateTitlesParamsSchema = z.object({
  lawId: z.string().uuid('lawId debe ser un UUID válido'),
  articles: z.array(updateTitlesArticleSchema).min(1),
})

export type UpdateTitlesParams = z.infer<typeof updateTitlesParamsSchema>

// ============================================
// PARAMS: Compare
// ============================================

export const compareParamsSchema = z.object({
  lawId: z.string().uuid('lawId debe ser un UUID válido'),
  articleNumber: z.string().min(1, 'Se requiere articleNumber'),
})

export type CompareParams = z.infer<typeof compareParamsSchema>

// ============================================
// PARAMS: Verification queue
// ============================================

export const verificationQueuePostSchema = z.object({
  topic_id: z.string().uuid('topic_id debe ser un UUID válido'),
  provider: z.string().default('openai'),
  model: z.string().default('gpt-4o-mini'),
  question_ids: z.array(z.string().uuid()).optional(),
})

export type VerificationQueuePostParams = z.infer<typeof verificationQueuePostSchema>

// ============================================
// RESPONSE SCHEMAS
// ============================================

export const baseResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
})

export type BaseResponse = z.infer<typeof baseResponseSchema>
