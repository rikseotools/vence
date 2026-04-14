// lib/api/v2/dispute/schemas.ts
// Schemas Zod unificados para impugnaciones (legislativas y psicotécnicas)

import { z } from 'zod/v3'
import {
  ALL_DISPUTE_TYPES,
  LEGISLATIVE_ONLY_TYPES,
  PSYCHOMETRIC_ONLY_TYPES,
} from './types'

// Tipos de pregunta
export const questionTypeSchema = z.enum(['legislative', 'psychometric'])
export type QuestionType = z.infer<typeof questionTypeSchema>

// Tipos de impugnación — derivados de la fuente de verdad (types.ts)
export const disputeTypeSchema = z.enum(ALL_DISPUTE_TYPES)
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
  // Tipos exclusivos legislativas no válidos para psicotécnicas
  if ((LEGISLATIVE_ONLY_TYPES as readonly string[]).includes(data.disputeType) && data.questionType === 'psychometric') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `El tipo "${data.disputeType}" solo aplica a preguntas legislativas`,
      path: ['disputeType'],
    })
  }
  // Tipos exclusivos psicotécnicas no válidos para legislativas
  if ((PSYCHOMETRIC_ONLY_TYPES as readonly string[]).includes(data.disputeType) && data.questionType === 'legislative') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `El tipo "${data.disputeType}" solo aplica a preguntas psicotecnicas`,
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
// RESOLVE DISPUTE
// ============================================

export const disputeResolutionStatusSchema = z.enum(['resolved', 'rejected'])
export type DisputeResolutionStatus = z.infer<typeof disputeResolutionStatusSchema>

export const resolveDisputeRequestSchema = z.object({
  disputeId: z.string().uuid('ID de impugnacion invalido'),
  questionType: questionTypeSchema,
  status: disputeResolutionStatusSchema,
  adminResponse: z.string().max(5000, 'La respuesta no puede superar 5000 caracteres'),
})

export type ResolveDisputeRequest = z.infer<typeof resolveDisputeRequestSchema>

export const resolveDisputeResponseSchema = z.object({
  success: z.literal(true),
  disputeId: z.string().uuid(),
  status: disputeResolutionStatusSchema,
  // Email puede no enviarse por dos motivos:
  //   - adminResponse vacio (cierre generico)         → emailSent=false, emailSkipReason='empty_response'
  //   - usuario sin email                              → emailSent=false, emailSkipReason='no_user_email'
  //   - sendEmailV2 fallo                              → emailSent=false, emailError set
  //   - sendEmailV2 cancelo (preferencias usuario)     → emailSent=false, emailSkipReason='user_preferences'
  emailSent: z.boolean(),
  emailId: z.string().nullable(),
  emailError: z.string().nullable(),
  emailSkipReason: z.enum(['empty_response', 'no_user_email', 'user_preferences']).nullable(),
})

export type ResolveDisputeResponse = z.infer<typeof resolveDisputeResponseSchema>

// ============================================
// ERROR
// ============================================

export const disputeErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
})

export type DisputeError = z.infer<typeof disputeErrorSchema>
