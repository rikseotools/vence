// lib/api/user-failed-questions/schemas.ts - Schemas para preguntas falladas del usuario
import { z } from 'zod'

// ============================================
// SCHEMA DE REQUEST
// ============================================

export const getUserFailedQuestionsRequestSchema = z.object({
  userId: z.string().uuid(),
  // Filtro por tema (opcional)
  topicNumber: z.number().int().min(1).optional(),
  // Filtro por leyes (opcional, para configurador de leyes)
  selectedLaws: z.array(z.string()).default([]),
})

export type GetUserFailedQuestionsRequest = z.infer<typeof getUserFailedQuestionsRequestSchema>

// ============================================
// SCHEMA DE PREGUNTA FALLADA
// ============================================

export const failedQuestionItemSchema = z.object({
  questionId: z.string().uuid(),
  questionText: z.string(),
  difficulty: z.string().nullable(),
  articleNumber: z.string().nullable(),
  lawShortName: z.string().nullable(),
  failedCount: z.number().int(),
  lastFailed: z.string(),
  firstFailed: z.string(),
  totalTime: z.number().int(),
})

export type FailedQuestionItem = z.infer<typeof failedQuestionItemSchema>

// ============================================
// SCHEMA DE RESPONSE
// ============================================

export const getUserFailedQuestionsResponseSchema = z.object({
  success: z.boolean(),
  totalQuestions: z.number().int().optional(),
  totalFailures: z.number().int().optional(),
  questions: z.array(failedQuestionItemSchema).optional(),
  error: z.string().optional(),
})

export type GetUserFailedQuestionsResponse = z.infer<typeof getUserFailedQuestionsResponseSchema>

// ============================================
// VALIDADORES
// ============================================

export function safeParseGetUserFailedQuestions(data: unknown) {
  return getUserFailedQuestionsRequestSchema.safeParse(data)
}
