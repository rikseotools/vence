// lib/api/psychometric-answer/schemas.ts
// Schemas Zod para la API unificada de respuestas psicotécnicas
// Valida + guarda respuesta + actualiza sesión en una sola llamada

import { z } from 'zod/v3'

// ============================================
// REQUEST
// ============================================

export const psychometricAnswerRequestSchema = z.object({
  questionId: z.string().uuid('ID de pregunta inválido'),
  userAnswer: z.number().int().min(0).max(3), // 0=A, 1=B, 2=C, 3=D

  // Campos opcionales para guardar respuesta (usuarios logueados)
  sessionId: z.string().uuid('ID de sesión inválido').nullish(),
  userId: z.string().uuid('ID de usuario inválido').nullish(),
  questionOrder: z.number().int().min(1).nullish(),
  timeSpentSeconds: z.number().int().min(0).nullish(),
  questionSubtype: z.string().nullish(),
  totalQuestions: z.number().int().min(1).nullish(),
})

export type PsychometricAnswerRequest = z.infer<typeof psychometricAnswerRequestSchema>

// ============================================
// RESPONSE
// ============================================

export const psychometricAnswerResponseSchema = z.object({
  success: z.literal(true),
  isCorrect: z.boolean(),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string().nullable(),
  solutionSteps: z.string().nullable(),
  // Info de guardado (solo si se proporcionó sessionId)
  saved: z.boolean(),
  sessionProgress: z.object({
    questionsAnswered: z.number(),
    correctAnswers: z.number(),
    accuracyPercentage: z.number(),
  }).nullish(),
})

export type PsychometricAnswerResponse = z.infer<typeof psychometricAnswerResponseSchema>

// ============================================
// ERROR
// ============================================

export const psychometricAnswerErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  isCorrect: z.boolean().optional(),
  correctAnswer: z.number().optional(),
})

export type PsychometricAnswerError = z.infer<typeof psychometricAnswerErrorSchema>
