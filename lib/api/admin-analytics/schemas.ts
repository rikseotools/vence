// lib/api/admin-analytics/schemas.ts - Schemas para analytics de preguntas problemáticas
import { z } from 'zod/v3'

// ============================================
// REVIEW HISTORY
// ============================================

export const reviewHistoryItemSchema = z.object({
  id: z.string().uuid(),
  question_id: z.string().uuid().nullable(),
  detection_type: z.string(),
  status: z.string().nullable(),
  resolved_at: z.string().nullable(),
  admin_notes: z.string().nullable(),
  resolution_action: z.string().nullable(),
  failure_rate: z.number().nullable(),
  abandonment_rate: z.number().nullable(),
  users_affected: z.number().int().nullable(),
  detected_at: z.string().nullable(),
  admin_full_name: z.string().nullable(),
})

// ============================================
// FULL QUESTION DATA (for review modal)
// ============================================

export const fullQuestionDataSchema = z.object({
  question_text: z.string(),
  option_a: z.string().nullable(),
  option_b: z.string().nullable(),
  option_c: z.string().nullable(),
  option_d: z.string().nullable(),
  correct_option: z.number().int().min(0).max(3),
  explanation: z.string().nullable(),
  articles: z.object({
    article_number: z.string().nullable(),
    title: z.string().nullable(),
    laws: z.object({
      name: z.string().nullable(),
      short_name: z.string().nullable(),
    }).nullable(),
  }).nullable(),
})

// ============================================
// PROBLEMATIC QUESTIONS (high abandonment)
// ============================================

export const problematicQuestionSchema = z.object({
  questionId: z.string().uuid(),
  questionText: z.string(),
  law: z.string(),
  article: z.string(),
  totalAppearances: z.number().int().min(0),
  abandonedAt: z.number().int().min(0),
  abandonmentRate: z.number().int().min(0).max(100),
  avgQuestionOrder: z.number().int().min(0),
  uniqueTestsCount: z.number().int().min(0),
  uniqueUsersAbandonedCount: z.number().int().min(0),
  fullData: fullQuestionDataSchema.nullable(),
  reviewHistory: z.array(reviewHistoryItemSchema),
})

// ============================================
// FREQUENTLY FAILED QUESTIONS
// ============================================

export const frequentlyFailedQuestionSchema = z.object({
  questionId: z.string().uuid(),
  questionText: z.string(),
  law: z.string(),
  article: z.string(),
  totalAttempts: z.number().int().min(0),
  incorrectAttempts: z.number().int().min(0),
  correctAttempts: z.number().int().min(0),
  failureRate: z.number().int().min(0).max(100),
  avgTimeSpent: z.number().int().min(0),
  uniqueUsersWrongCount: z.number().int().min(0),
  uniqueUsersCorrectCount: z.number().int().min(0),
  uniqueTestsCount: z.number().int().min(0),
  lowConfidenceRate: z.number().int().min(0).max(100),
  fullData: fullQuestionDataSchema.nullable(),
  reviewHistory: z.array(reviewHistoryItemSchema),
})

// ============================================
// ANALYTICS RESPONSE
// ============================================

export const analyticsResponseSchema = z.object({
  problematicQuestions: z.array(problematicQuestionSchema),
  frequentlyFailedQuestions: z.array(frequentlyFailedQuestionSchema),
})

// ============================================
// TYPES
// ============================================

export type ReviewHistoryItem = z.infer<typeof reviewHistoryItemSchema>
export type FullQuestionData = z.infer<typeof fullQuestionDataSchema>
export type ProblematicQuestion = z.infer<typeof problematicQuestionSchema>
export type FrequentlyFailedQuestion = z.infer<typeof frequentlyFailedQuestionSchema>
export type AnalyticsResponse = z.infer<typeof analyticsResponseSchema>
