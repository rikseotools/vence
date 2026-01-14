// lib/chat/domains/verification/schemas.ts
// Schemas Zod para el dominio de verificación

import { z } from 'zod'

// ============================================
// SCHEMAS DE VERIFICACIÓN
// ============================================

export const verificationInputSchema = z.object({
  questionId: z.string().uuid(),
  questionText: z.string().min(1),
  options: z.array(z.string()).length(4),
  markedCorrect: z.number().int().min(0).max(3),
  lawName: z.string().optional(),
  articleNumber: z.string().optional(),
  userId: z.string().uuid().optional(),
})

export type VerificationInputSchema = z.infer<typeof verificationInputSchema>

export const errorTypeSchema = z.enum([
  'contradiction',
  'incorrect_answer',
  'ambiguous',
])

export type ErrorTypeSchema = z.infer<typeof errorTypeSchema>

export const errorDetectionResultSchema = z.object({
  hasError: z.boolean(),
  errorType: errorTypeSchema.optional(),
  confidence: z.number().min(0).max(1),
  details: z.string().optional(),
})

export type ErrorDetectionResultSchema = z.infer<typeof errorDetectionResultSchema>

export const verificationResultSchema = z.object({
  response: z.string(),
  errorDetected: z.boolean(),
  errorDetails: errorDetectionResultSchema.optional(),
  disputeCreated: z.boolean(),
  sources: z.array(z.object({
    lawName: z.string(),
    articleNumber: z.string(),
    title: z.string().optional(),
    relevance: z.number().optional(),
  })),
  processingTime: z.number().int().nonnegative(),
})

export type VerificationResultSchema = z.infer<typeof verificationResultSchema>

// ============================================
// SCHEMAS DE DISPUTAS
// ============================================

export const disputeTypeSchema = z.enum([
  'ai_detected_error',
  'no_literal',
  'respuesta_incorrecta',
  'otro',
])

export type DisputeTypeSchema = z.infer<typeof disputeTypeSchema>

export const disputeStatusSchema = z.enum([
  'pending',
  'reviewing',
  'resolved',
  'rejected',
])

export type DisputeStatusSchema = z.infer<typeof disputeStatusSchema>

export const disputeSchema = z.object({
  id: z.string().uuid(),
  questionId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  disputeType: disputeTypeSchema,
  description: z.string(),
  status: disputeStatusSchema,
  adminResponse: z.string().nullable(),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
})

export type DisputeSchema = z.infer<typeof disputeSchema>

export const createDisputeInputSchema = z.object({
  questionId: z.string().uuid(),
  userId: z.string().uuid().optional().nullable(),
  disputeType: disputeTypeSchema,
  description: z.string().min(10).max(2000),
})

export type CreateDisputeInputSchema = z.infer<typeof createDisputeInputSchema>

export const disputeResultSchema = z.object({
  success: z.boolean(),
  disputeId: z.string().uuid().optional(),
  alreadyExists: z.boolean().optional(),
  error: z.string().optional(),
})

export type DisputeResultSchema = z.infer<typeof disputeResultSchema>

// ============================================
// VALIDADORES
// ============================================

export function validateVerificationInput(data: unknown): VerificationInputSchema {
  return verificationInputSchema.parse(data)
}

export function validateCreateDispute(data: unknown): CreateDisputeInputSchema {
  return createDisputeInputSchema.parse(data)
}

export function safeValidateVerificationInput(data: unknown) {
  return verificationInputSchema.safeParse(data)
}

export function safeValidateCreateDispute(data: unknown) {
  return createDisputeInputSchema.safeParse(data)
}
