// lib/api/v2/dispute/schemas.ts
// Schemas Zod unificados para impugnaciones (legislativas y psicotécnicas)

import { z } from 'zod/v3'

// Tipos de pregunta
export const questionTypeSchema = z.enum(['legislative', 'psychometric'])
export type QuestionType = z.infer<typeof questionTypeSchema>

// Tipos de impugnación (unificados)
// legislative: no_literal, respuesta_incorrecta, otro
// psychometric: ai_detected_error, respuesta_incorrecta, otro
export const disputeTypeSchema = z.enum([
  'no_literal',
  'ai_detected_error',
  'respuesta_incorrecta',
  'otro',
])
export type DisputeType = z.infer<typeof disputeTypeSchema>

// ============================================
// CREATE DISPUTE
// ============================================

export const createDisputeRequestSchema = z.object({
  questionId: z.string().uuid('ID de pregunta invalido'),
  questionType: questionTypeSchema,
  disputeType: disputeTypeSchema,
  description: z.string().min(10, 'La descripcion debe tener al menos 10 caracteres').max(500),
}).superRefine((data, ctx) => {
  // no_literal solo para legislativas
  if (data.disputeType === 'no_literal' && data.questionType === 'psychometric') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'El tipo "no_literal" solo aplica a preguntas legislativas',
      path: ['disputeType'],
    })
  }
  // ai_detected_error solo para psicotécnicas
  if (data.disputeType === 'ai_detected_error' && data.questionType === 'legislative') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'El tipo "ai_detected_error" solo aplica a preguntas psicotecnicas',
      path: ['disputeType'],
    })
  }
})

export type CreateDisputeRequest = z.infer<typeof createDisputeRequestSchema>

export const createDisputeResponseSchema = z.object({
  success: z.literal(true),
  disputeId: z.string().uuid(),
})

export type CreateDisputeResponse = z.infer<typeof createDisputeResponseSchema>

// ============================================
// GET EXISTING DISPUTE
// ============================================

export const getDisputeRequestSchema = z.object({
  questionId: z.string().uuid('ID de pregunta invalido'),
  questionType: questionTypeSchema,
})

export type GetDisputeRequest = z.infer<typeof getDisputeRequestSchema>

export const existingDisputeSchema = z.object({
  id: z.string().uuid(),
  status: z.string().nullable(),
  disputeType: z.string(),
  description: z.string(),
  adminResponse: z.string().nullable(),
  createdAt: z.string().nullable(),
  resolvedAt: z.string().nullable(),
})

export type ExistingDispute = z.infer<typeof existingDisputeSchema>

export const getDisputeResponseSchema = z.object({
  success: z.literal(true),
  dispute: existingDisputeSchema.nullable(),
})

export type GetDisputeResponse = z.infer<typeof getDisputeResponseSchema>

// ============================================
// ERROR
// ============================================

export const disputeErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
})

export type DisputeError = z.infer<typeof disputeErrorSchema>
