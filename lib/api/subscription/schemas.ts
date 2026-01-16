// lib/api/subscription/schemas.ts - Schemas de validación para suscripciones
// Usar zod/v3 para compatibilidad con Zod 4
import { z } from 'zod/v3'

// ============================================
// REQUEST: GET SUBSCRIPTION
// ============================================

export const getSubscriptionRequestSchema = z.object({
  userId: z.string().uuid()
})

export type GetSubscriptionRequest = z.infer<typeof getSubscriptionRequestSchema>

// ============================================
// RESPONSE: SUBSCRIPTION DATA
// ============================================

export const subscriptionInfoSchema = z.object({
  id: z.string(),
  status: z.string(),
  currentPeriodStart: z.string(),
  currentPeriodEnd: z.string(),
  cancelAtPeriodEnd: z.boolean(),
  canceledAt: z.string().nullable(),
  created: z.string(),
  planName: z.string().nullable().optional(),
  planAmount: z.number().nullable().optional(),
  planCurrency: z.string().nullable().optional(),
  planInterval: z.string().nullable().optional(),
  planIntervalCount: z.number().nullable().optional()
})

export type SubscriptionInfo = z.infer<typeof subscriptionInfoSchema>

export const getSubscriptionResponseSchema = z.object({
  hasSubscription: z.boolean(),
  planType: z.string().nullable().optional(),
  stripeCustomerId: z.string().nullable().optional(),
  subscription: subscriptionInfoSchema.optional(),
  error: z.string().optional()
})

export type GetSubscriptionResponse = z.infer<typeof getSubscriptionResponseSchema>

// ============================================
// REQUEST: CREATE PORTAL SESSION
// ============================================

export const createPortalSessionRequestSchema = z.object({
  userId: z.string().uuid()
})

export type CreatePortalSessionRequest = z.infer<typeof createPortalSessionRequestSchema>

// ============================================
// RESPONSE: PORTAL SESSION
// ============================================

export const createPortalSessionResponseSchema = z.object({
  url: z.string().url().optional(),
  error: z.string().optional()
})

export type CreatePortalSessionResponse = z.infer<typeof createPortalSessionResponseSchema>

// ============================================
// REQUEST: CANCEL SUBSCRIPTION
// ============================================

export const cancellationReasons = [
  'approved',
  'not_presenting',
  'too_expensive',
  'prefer_other',
  'missing_features',
  'no_progress',
  'hard_to_use',
  'other'
] as const

export const alternativeOptions = [
  'academy_presential',
  'academy_online',
  'books',
  'other_app',
  'self_study',
  'stop_preparing',
  'other'
] as const

export type CancellationReason = typeof cancellationReasons[number]
export type AlternativeOption = typeof alternativeOptions[number]

export const cancellationFeedbackSchema = z.object({
  reason: z.enum(cancellationReasons),
  reasonDetails: z.string().max(1000).optional().nullable(),
  alternative: z.enum(alternativeOptions).optional().nullable(),
  contactedSupport: z.boolean().optional()
})

export type CancellationFeedback = z.infer<typeof cancellationFeedbackSchema>

export const cancelSubscriptionRequestSchema = z.object({
  userId: z.string().uuid(),
  feedback: cancellationFeedbackSchema
})

export type CancelSubscriptionRequest = z.infer<typeof cancelSubscriptionRequestSchema>

// ============================================
// RESPONSE: CANCEL SUBSCRIPTION
// ============================================

export const cancelSubscriptionResponseSchema = z.object({
  success: z.boolean(),
  periodEnd: z.string().optional(),
  message: z.string().optional(),
  error: z.string().optional()
})

export type CancelSubscriptionResponse = z.infer<typeof cancelSubscriptionResponseSchema>

// ============================================
// RESPONSE: ERROR
// ============================================

export const errorResponseSchema = z.object({
  error: z.string()
})

export type ErrorResponse = z.infer<typeof errorResponseSchema>

// ============================================
// VALIDADORES
// ============================================

export function safeParseGetSubscriptionRequest(data: unknown) {
  return getSubscriptionRequestSchema.safeParse(data)
}

export function safeParseCreatePortalSessionRequest(data: unknown) {
  return createPortalSessionRequestSchema.safeParse(data)
}

export function safeParseCancelSubscriptionRequest(data: unknown) {
  return cancelSubscriptionRequestSchema.safeParse(data)
}

export function validateGetSubscriptionRequest(data: unknown): GetSubscriptionRequest {
  return getSubscriptionRequestSchema.parse(data)
}

export function validateCreatePortalSessionRequest(data: unknown): CreatePortalSessionRequest {
  return createPortalSessionRequestSchema.parse(data)
}

export function validateCancelSubscriptionRequest(data: unknown): CancelSubscriptionRequest {
  return cancelSubscriptionRequestSchema.parse(data)
}
