// lib/api/auth/schemas.ts - Schemas de validacion para auth callback v2
import { z } from 'zod/v3'

// ============================================
// PROCESS CALLBACK REQUEST
// ============================================

export const processCallbackRequestSchema = z.object({
  userId: z.string().uuid(),
  userEmail: z.string().email(),
  fullName: z.string().nullish(),
  avatarUrl: z.string().nullish(),
  returnUrl: z.string().default('/auxiliar-administrativo-estado'),
  oposicion: z.string().nullish(),
  funnel: z.string().nullish(),
  isGoogleAds: z.boolean().default(false),
  isGoogleAdsFromUrl: z.boolean().default(false),
  isMetaAds: z.boolean().default(false),
  googleParams: z.object({
    gclid: z.string().nullish(),
    utm_source: z.string().nullish(),
  }).nullish(),
  metaParams: z.object({
    fbclid: z.string().nullish(),
    utm_source: z.string().nullish(),
  }).nullish(),
})

export type ProcessCallbackRequest = z.infer<typeof processCallbackRequestSchema>

// ============================================
// PROCESS CALLBACK RESPONSE
// ============================================

export const processCallbackResponseSchema = z.object({
  success: z.boolean(),
  isNewUser: z.boolean(),
  redirectUrl: z.string(),
  error: z.string().optional(),
})

export type ProcessCallbackResponse = z.infer<typeof processCallbackResponseSchema>

// ============================================
// VALIDATORS
// ============================================

export function safeParseProcessCallbackRequest(data: unknown) {
  return processCallbackRequestSchema.safeParse(data)
}

export function validateProcessCallbackRequest(data: unknown): ProcessCallbackRequest {
  return processCallbackRequestSchema.parse(data)
}
