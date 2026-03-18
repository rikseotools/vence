// lib/api/psychometric-session/schemas.ts
// Schemas Zod para APIs de sesiones psicotécnicas (pending/resume/discard)

import { z } from 'zod/v3'

// ============================================
// PENDING SESSIONS
// ============================================

export const getPendingPsychometricSessionsRequestSchema = z.object({
  userId: z.string().uuid('ID de usuario inválido'),
  limit: z.number().int().min(1).max(50).default(10),
})

export type GetPendingPsychometricSessionsRequest = z.infer<typeof getPendingPsychometricSessionsRequestSchema>

export const pendingPsychometricSessionSchema = z.object({
  id: z.string().uuid(),
  categoryName: z.string().nullable(),
  totalQuestions: z.number().int(),
  questionsAnswered: z.number().int(),
  correctAnswers: z.number().int(),
  accuracyPercentage: z.number(),
  startedAt: z.string().nullable(),
})

export type PendingPsychometricSession = z.infer<typeof pendingPsychometricSessionSchema>

export const getPendingPsychometricSessionsResponseSchema = z.object({
  success: z.literal(true),
  sessions: z.array(pendingPsychometricSessionSchema),
})

export type GetPendingPsychometricSessionsResponse = z.infer<typeof getPendingPsychometricSessionsResponseSchema>

// ============================================
// RESUME SESSION
// ============================================

export const resumePsychometricSessionRequestSchema = z.object({
  sessionId: z.string().uuid('ID de sesión inválido'),
  userId: z.string().uuid('ID de usuario inválido').optional(),
})

export type ResumePsychometricSessionRequest = z.infer<typeof resumePsychometricSessionRequestSchema>

export const resumePsychometricSessionResponseSchema = z.object({
  success: z.literal(true),
  sessionId: z.string().uuid(),
  totalQuestions: z.number().int(),
  questionsAnswered: z.number().int(),
  correctAnswers: z.number().int(),
  questions: z.array(z.record(z.unknown())), // Questions without correctOption
  answeredQuestionIds: z.array(z.string()),
})

export type ResumePsychometricSessionResponse = z.infer<typeof resumePsychometricSessionResponseSchema>

// ============================================
// DISCARD SESSION
// ============================================

export const discardPsychometricSessionRequestSchema = z.object({
  sessionId: z.string().uuid('ID de sesión inválido'),
  userId: z.string().uuid('ID de usuario inválido'),
})

export type DiscardPsychometricSessionRequest = z.infer<typeof discardPsychometricSessionRequestSchema>

export const discardPsychometricSessionResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
})

export type DiscardPsychometricSessionResponse = z.infer<typeof discardPsychometricSessionResponseSchema>

// ============================================
// CREATE SESSION
// ============================================

export const createPsychometricSessionRequestSchema = z.object({
  userId: z.string().uuid('ID de usuario inválido'),
  categoryId: z.string().uuid().nullable().optional(),
  totalQuestions: z.number().int().min(1),
  questionIds: z.array(z.string()),
})

export type CreatePsychometricSessionRequest = z.infer<typeof createPsychometricSessionRequestSchema>

// ============================================
// COMPLETE SESSION
// ============================================

export const completePsychometricSessionRequestSchema = z.object({
  sessionId: z.string().uuid('ID de sesión inválido'),
  userId: z.string().uuid('ID de usuario inválido'),
  correctAnswers: z.number().int().min(0),
  totalQuestions: z.number().int().min(1),
})

export type CompletePsychometricSessionRequest = z.infer<typeof completePsychometricSessionRequestSchema>

// ============================================
// ERROR
// ============================================

export const psychometricSessionErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
})

export type PsychometricSessionError = z.infer<typeof psychometricSessionErrorSchema>
