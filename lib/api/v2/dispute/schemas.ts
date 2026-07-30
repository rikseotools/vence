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
  /**
   * Pregunta a la que pertenece. Va en el contrato para que el consumidor pueda COMPROBAR que lo
   * que pinta es de la pregunta que el usuario tiene delante, en vez de confiar en su propio
   * estado. Nullable porque la columna lo es (impugnaciones sin contexto, p. ej. desde /soporte).
   */
  questionId: z.string().uuid().nullable(),
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
  // Escape de la puerta de barajado (ver `shuffleReadiness.ts`). Exige MOTIVO, no un booleano:
  // un `skip: true` se teclea sin pensar; escribir por qué obliga a pensarlo y deja rastro.
  skipShuffleReason: z.string().min(10, 'Explica por qué se salta la comprobacion (min. 10 caracteres)').max(500).optional(),
  // «Un fallo o hallazgo, una recompensa» (Manuel, 30/07/2026). Cuando varias impugnaciones
  // son EL MISMO hallazgo, la primera cobra su euro y las hermanas se cierran igual de
  // válidas —tenían razón, y rechazarlas enseñaría a no volver a avisar— pero sin abono.
  //
  // Exige MOTIVO por lo mismo que el de arriba: un booleano se teclea sin pensar y no deja
  // rastro de POR QUÉ no se pagó, que es justo lo que habrá que releer dentro de tres meses.
  // Se espera algo como «mismo hallazgo que ce143c99: la misma pregunta duplicada».
  skipRewardReason: z.string().min(10, 'Explica por qué esta no lleva recompensa (min. 10 caracteres)').max(500).optional(),
})

export type ResolveDisputeRequest = z.infer<typeof resolveDisputeRequestSchema>

export const resolveDisputeResponseSchema = z.object({
  success: z.literal(true),
  disputeId: z.string().uuid(),
  status: disputeResolutionStatusSchema,
  bellSent: z.boolean(),
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
