// lib/api/email-preferences/schemas.ts - Schemas de validación para preferencias de email
// Usar zod/v3 para compatibilidad con Zod 4
import { z } from 'zod/v3'

// ============================================
// REQUEST: GET EMAIL PREFERENCES
// ============================================

export const getEmailPreferencesRequestSchema = z.object({
  userId: z.string().uuid()
})

export type GetEmailPreferencesRequest = z.infer<typeof getEmailPreferencesRequestSchema>

// ============================================
// RESPONSE: EMAIL PREFERENCES DATA
// ============================================

export const emailPreferencesDataSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  emailReactivacion: z.boolean(),
  emailUrgente: z.boolean(),
  emailBienvenidaMotivacional: z.boolean(),
  emailBienvenidaInmediato: z.boolean(),
  emailResumenSemanal: z.boolean(),
  unsubscribedAll: z.boolean(),
  unsubscribedAt: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional()
})

export type EmailPreferencesData = z.infer<typeof emailPreferencesDataSchema>

export const getEmailPreferencesResponseSchema = z.object({
  success: z.boolean(),
  data: emailPreferencesDataSchema.optional(),
  error: z.string().optional()
})

export type GetEmailPreferencesResponse = z.infer<typeof getEmailPreferencesResponseSchema>

// ============================================
// REQUEST: UPSERT EMAIL PREFERENCES
// ============================================

export const upsertEmailPreferencesRequestSchema = z.object({
  userId: z.string().uuid(),
  data: z.object({
    emailReactivacion: z.boolean().optional(),
    emailUrgente: z.boolean().optional(),
    emailBienvenidaMotivacional: z.boolean().optional(),
    emailBienvenidaInmediato: z.boolean().optional(),
    emailResumenSemanal: z.boolean().optional(),
    unsubscribedAll: z.boolean().optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: 'Al menos una preferencia debe ser proporcionada'
  })
})

export type UpsertEmailPreferencesRequest = z.infer<typeof upsertEmailPreferencesRequestSchema>

// ============================================
// RESPONSE: UPSERT EMAIL PREFERENCES
// ============================================

export const upsertEmailPreferencesResponseSchema = z.object({
  success: z.boolean(),
  data: emailPreferencesDataSchema.optional(),
  error: z.string().optional()
})

export type UpsertEmailPreferencesResponse = z.infer<typeof upsertEmailPreferencesResponseSchema>

// ============================================
// RESPONSE: ERROR
// ============================================

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string()
})

export type ErrorResponse = z.infer<typeof errorResponseSchema>

// ============================================
// VALIDADORES
// ============================================

export function safeParseGetEmailPreferencesRequest(data: unknown) {
  return getEmailPreferencesRequestSchema.safeParse(data)
}

export function safeParseUpsertEmailPreferencesRequest(data: unknown) {
  return upsertEmailPreferencesRequestSchema.safeParse(data)
}

export function validateGetEmailPreferencesRequest(data: unknown): GetEmailPreferencesRequest {
  return getEmailPreferencesRequestSchema.parse(data)
}

export function validateUpsertEmailPreferencesRequest(data: unknown): UpsertEmailPreferencesRequest {
  return upsertEmailPreferencesRequestSchema.parse(data)
}
