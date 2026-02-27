// lib/api/dispute/schemas.ts - Schemas de validación para impugnaciones
import { z } from 'zod/v3'

// ============================================
// VALORES PERMITIDOS
// ============================================

export const disputeTypeOptions = ['no_literal', 'respuesta_incorrecta', 'otro'] as const
export const disputeStatusOptions = ['pending', 'reviewing', 'resolved', 'rejected'] as const

export type DisputeType = typeof disputeTypeOptions[number]
export type DisputeStatus = typeof disputeStatusOptions[number]

// ============================================
// REQUEST: CREATE DISPUTE
// ============================================

export const createDisputeRequestSchema = z.object({
  questionId: z.string().uuid('questionId debe ser un UUID válido'),
  disputeType: z.enum(disputeTypeOptions, {
    errorMap: () => ({ message: 'Tipo de impugnación no válido' }),
  }),
  description: z.string().min(1, 'La descripción es requerida'),
})

export type CreateDisputeRequest = z.infer<typeof createDisputeRequestSchema>

// ============================================
// RESPONSE: DISPUTE DATA
// ============================================

export const disputeDataSchema = z.object({
  id: z.string().uuid(),
  questionId: z.string().uuid().nullable(),
  userId: z.string().uuid().nullable(),
  disputeType: z.string(),
  description: z.string(),
  status: z.string().nullable(),
  createdAt: z.string().nullable(),
})

export type DisputeData = z.infer<typeof disputeDataSchema>

// ============================================
// RESPONSE: CREATE DISPUTE
// ============================================

export const createDisputeResponseSchema = z.object({
  success: z.boolean(),
  data: disputeDataSchema.optional(),
  error: z.string().optional(),
})

export type CreateDisputeResponse = z.infer<typeof createDisputeResponseSchema>

// ============================================
// VALIDADORES
// ============================================

export function safeParseCreateDisputeRequest(data: unknown) {
  return createDisputeRequestSchema.safeParse(data)
}

export function validateCreateDisputeRequest(data: unknown): CreateDisputeRequest {
  return createDisputeRequestSchema.parse(data)
}
