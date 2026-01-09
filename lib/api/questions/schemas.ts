// lib/api/questions/schemas.ts - Schemas de validación para historial de preguntas
import { z } from 'zod'

// ============================================
// HISTORIAL DE PREGUNTAS DEL USUARIO
// ============================================

export const getQuestionHistoryRequestSchema = z.object({
  userId: z.string().uuid('ID de usuario inválido'),
  // Opcional: filtrar solo preguntas activas (por defecto true)
  onlyActiveQuestions: z.boolean().default(true),
})

export type GetQuestionHistoryRequest = z.infer<typeof getQuestionHistoryRequestSchema>

export const questionHistoryItemSchema = z.object({
  questionId: z.string().uuid(),
  lastAnsweredAt: z.string(), // ISO date string
})

export type QuestionHistoryItem = z.infer<typeof questionHistoryItemSchema>

export const getQuestionHistoryResponseSchema = z.object({
  success: z.boolean(),
  history: z.array(questionHistoryItemSchema).optional(),
  totalAnswered: z.number().optional(),
  error: z.string().optional(),
})

export type GetQuestionHistoryResponse = z.infer<typeof getQuestionHistoryResponseSchema>

// ============================================
// PREGUNTAS RECIENTES (para exclusión)
// ============================================

export const getRecentQuestionsRequestSchema = z.object({
  userId: z.string().uuid('ID de usuario inválido'),
  days: z.number().int().min(1).max(365).default(7),
})

export type GetRecentQuestionsRequest = z.infer<typeof getRecentQuestionsRequestSchema>

export const getRecentQuestionsResponseSchema = z.object({
  success: z.boolean(),
  questionIds: z.array(z.string().uuid()).optional(),
  error: z.string().optional(),
})

export type GetRecentQuestionsResponse = z.infer<typeof getRecentQuestionsResponseSchema>

// ============================================
// VALIDADORES HELPER
// ============================================

export function validateGetQuestionHistory(data: unknown): GetQuestionHistoryRequest {
  return getQuestionHistoryRequestSchema.parse(data)
}

export function validateGetRecentQuestions(data: unknown): GetRecentQuestionsRequest {
  return getRecentQuestionsRequestSchema.parse(data)
}

// Safe parse versions
export function safeParseGetQuestionHistory(data: unknown) {
  return getQuestionHistoryRequestSchema.safeParse(data)
}

export function safeParseGetRecentQuestions(data: unknown) {
  return getRecentQuestionsRequestSchema.safeParse(data)
}

// ============================================
// RESPUESTAS PARA ANALYTICS (motivationalAnalyzer)
// ============================================

export const getUserAnalyticsRequestSchema = z.object({
  userId: z.string().uuid('ID de usuario inválido'),
  days: z.number().int().min(1).max(60).default(14),
})

export type GetUserAnalyticsRequest = z.infer<typeof getUserAnalyticsRequestSchema>

export const analyticsResponseItemSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
  isCorrect: z.boolean(),
  lawName: z.string().nullable(),
  articleNumber: z.string().nullable(),
  temaNumber: z.number().nullable(),
})

export type AnalyticsResponseItem = z.infer<typeof analyticsResponseItemSchema>

export const getUserAnalyticsResponseSchema = z.object({
  success: z.boolean(),
  responses: z.array(analyticsResponseItemSchema).optional(),
  error: z.string().optional(),
})

export type GetUserAnalyticsResponse = z.infer<typeof getUserAnalyticsResponseSchema>

export function safeParseGetUserAnalytics(data: unknown) {
  return getUserAnalyticsRequestSchema.safeParse(data)
}
