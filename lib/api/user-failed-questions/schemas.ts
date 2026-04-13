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
  // Filtro temporal: solo fallos desde esta fecha (ISO string)
  since: z.string().datetime().optional(),
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
// SCHEMA DE FALLADAS POR TEMA
// ============================================

export const failedByTopicItemSchema = z.object({
  topicNumber: z.number().int(),
  topicTitle: z.string().nullable(),
  failedQuestions: z.number().int(),
  totalFailures: z.number().int(),
})

export type FailedByTopicItem = z.infer<typeof failedByTopicItemSchema>

/**
 * Request de /api/questions/failed-by-topic.
 * `positionType` es OBLIGATORIO para evitar que el SQL mezcle temas de distintas
 * oposiciones (el mismo topic_number existe en 30+ oposiciones).
 */
export const getFailedByTopicRequestSchema = z.object({
  positionType: z.string().regex(/^[a-z_]+$/, 'positionType inválido'),
})

export type GetFailedByTopicRequest = z.infer<typeof getFailedByTopicRequestSchema>

// ============================================
// VALIDADORES
// ============================================

export function safeParseGetUserFailedQuestions(data: unknown) {
  return getUserFailedQuestionsRequestSchema.safeParse(data)
}
