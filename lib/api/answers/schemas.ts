// lib/api/answers/schemas.ts - Schemas de validación para respuestas
// Usar zod/v3 para compatibilidad con Zod 4
import { z } from 'zod/v3'

// ============================================
// REQUEST: VALIDAR RESPUESTA
// ============================================

export const validateAnswerRequestSchema = z.object({
  questionId: z.string().uuid('ID de pregunta inválido'),
  userAnswer: z.number().int().min(0).max(3), // 0=A, 1=B, 2=C, 3=D
  userId: z.string().uuid().optional().nullable(),
  responseTimeMs: z.number().int().min(0).optional(),
  testId: z.string().uuid().optional().nullable()
})

export type ValidateAnswerRequest = z.infer<typeof validateAnswerRequestSchema>

// ============================================
// RESPONSE: VALIDAR RESPUESTA
// ============================================

export const validateAnswerResponseSchema = z.object({
  success: z.boolean(),
  isCorrect: z.boolean(),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string().nullable(),
  articleNumber: z.string().nullable().optional(),
  lawShortName: z.string().nullable().optional(),
  lawName: z.string().nullable().optional()
})

export type ValidateAnswerResponse = z.infer<typeof validateAnswerResponseSchema>

// ============================================
// RESPONSE: ERROR
// ============================================

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  isCorrect: z.literal(false).optional(),
  correctAnswer: z.number().optional()
})

export type ErrorResponse = z.infer<typeof errorResponseSchema>

// ============================================
// VALIDADORES
// ============================================

export function safeParseAnswerRequest(data: unknown) {
  return validateAnswerRequestSchema.safeParse(data)
}

export function validateAnswerRequest(data: unknown): ValidateAnswerRequest {
  return validateAnswerRequestSchema.parse(data)
}
