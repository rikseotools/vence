// lib/api/v2/complete-onboarding/schemas.ts
import { z } from 'zod/v3'

// ============================================
// REQUEST
// ============================================

export const completeOnboardingRequestSchema = z.object({
  targetOposicion: z.string().min(1),
  targetOposicionData: z.record(z.unknown()).optional().nullable(),
  age: z.number().int().min(16).max(100),
  gender: z.string().min(1),
  ciudad: z.string().min(1),
  dailyStudyHours: z.number().int().min(1).max(24).optional().nullable(),
})

export type CompleteOnboardingRequest = z.infer<typeof completeOnboardingRequestSchema>

// ============================================
// RESPONSE
// ============================================

export const completeOnboardingResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
})

export type CompleteOnboardingResponse = z.infer<typeof completeOnboardingResponseSchema>

// ============================================
// HELPERS
// ============================================

export function safeParseCompleteOnboardingRequest(data: unknown) {
  return completeOnboardingRequestSchema.safeParse(data)
}
