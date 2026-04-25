// lib/api/spelling-answer/schemas.ts - Schemas Zod para ortografía
import { z } from 'zod/v3'

// ============================================
// VALIDAR RESPUESTA
// ============================================

export const validateSpellingAnswerRequestSchema = z.object({
  questionId: z.string().uuid('ID de pregunta inválido'),
  selectedIndices: z.array(z.number().int().min(0).max(3)).max(4),
  userId: z.string().uuid().optional().nullable(),
  responseTimeMs: z.number().int().min(0).optional(),
  testId: z.string().uuid().optional().nullable(),
})

export type ValidateSpellingAnswerRequest = z.infer<typeof validateSpellingAnswerRequestSchema>

export const validateSpellingAnswerResponseSchema = z.object({
  success: z.boolean(),
  score: z.number().min(0).max(1),
  isFullyCorrect: z.boolean(),
  incorrectIndices: z.array(z.number()),
  explanation: z.string().nullable(),
})

export type ValidateSpellingAnswerResponse = z.infer<typeof validateSpellingAnswerResponseSchema>

// ============================================
// CREAR SESIÓN
// ============================================

export const createSpellingSessionRequestSchema = z.object({
  userId: z.string().uuid(),
  category: z.string().optional().nullable(),
  totalQuestions: z.number().int().min(1),
})

export type CreateSpellingSessionRequest = z.infer<typeof createSpellingSessionRequestSchema>

export interface CreateSpellingSessionResponse {
  success: boolean
  sessionId: string
}

// ============================================
// GUARDAR RESPUESTA INDIVIDUAL
// ============================================

export const saveSpellingAnswerRequestSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  questionId: z.string().uuid(),
  questionOrder: z.number().int().min(1),
  selectedIndices: z.array(z.number().int().min(0).max(3)),
  incorrectIndices: z.array(z.number().int().min(0).max(3)),
  isCorrect: z.boolean(),
  timeSpentSeconds: z.number().int().min(0).optional().nullable(),
})

export type SaveSpellingAnswerRequest = z.infer<typeof saveSpellingAnswerRequestSchema>

// ============================================
// COMPLETAR SESIÓN
// ============================================

export const completeSpellingSessionRequestSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  correctAnswers: z.number().int().min(0),
  totalAnswered: z.number().int().min(0),
})

export type CompleteSpellingSessionRequest = z.infer<typeof completeSpellingSessionRequestSchema>

// ============================================
// VALIDADORES
// ============================================

export function safeParseSpellingAnswerRequest(data: unknown) {
  return validateSpellingAnswerRequestSchema.safeParse(data)
}
