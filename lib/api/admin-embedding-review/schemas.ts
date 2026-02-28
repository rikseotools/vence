// lib/api/admin-embedding-review/schemas.ts - Schemas para revisión de embeddings
import { z } from 'zod/v3'

// ============================================
// REQUEST: POST ACTION
// ============================================

export const embeddingReviewActionSchema = z.object({
  questionId: z.string().uuid(),
  action: z.enum(['mark_correct', 'needs_llm_review']),
})

export type EmbeddingReviewAction = z.infer<typeof embeddingReviewActionSchema>

// ============================================
// RESPONSE: GET FLAGGED QUESTIONS
// ============================================

const topicInfoSchema = z.object({
  topic_id: z.string().uuid(),
  topic_title: z.string(),
  topic_number: z.number().nullable(),
  position: z.number().nullable(),
})

export const embeddingReviewItemSchema = z.object({
  id: z.string().uuid(),
  question_text: z.string(),
  assigned_article: z.string(),
  similarity: z.number(),
  suggested_article: z.string().nullable(),
  suggested_similarity: z.number().nullable(),
  topics: z.array(topicInfoSchema),
  verified_at: z.string().nullable(),
  topic_review_status: z.string().nullable(),
})

export const embeddingReviewResponseSchema = z.object({
  success: z.boolean(),
  questions: z.array(embeddingReviewItemSchema).optional(),
  stats: z.object({
    total: z.number().int().min(0),
    withTopic: z.number().int().min(0),
    withoutTopic: z.number().int().min(0),
  }).optional(),
  error: z.string().optional(),
})

export type EmbeddingReviewResponse = z.infer<typeof embeddingReviewResponseSchema>

// ============================================
// RESPONSE: POST ACTION
// ============================================

export const embeddingReviewActionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
})

export type EmbeddingReviewActionResponse = z.infer<typeof embeddingReviewActionResponseSchema>
