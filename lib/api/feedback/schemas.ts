// lib/api/feedback/schemas.ts - Schemas de validación para feedback de usuario
// Usar zod/v3 para compatibilidad con Zod 4
import { z } from 'zod/v3'

// ============================================
// VALORES PERMITIDOS
// ============================================

export const feedbackTypeOptions = ['suggestion', 'bug', 'question_dispute', 'other'] as const
export const feedbackStatusOptions = ['pending', 'in_progress', 'resolved', 'closed'] as const
export const feedbackPriorityOptions = ['low', 'medium', 'high', 'urgent'] as const

export type FeedbackType = typeof feedbackTypeOptions[number]
export type FeedbackStatus = typeof feedbackStatusOptions[number]
export type FeedbackPriority = typeof feedbackPriorityOptions[number]

// ============================================
// REQUEST: CREATE FEEDBACK
// ============================================

export const createFeedbackRequestSchema = z.object({
  userId: z.string().uuid().nullable().optional(),
  email: z.string().email().nullable().optional(),
  type: z.enum(feedbackTypeOptions),
  message: z.string().min(1, 'El mensaje es requerido'),
  url: z.string().min(1, 'La URL es requerida'),
  userAgent: z.string().optional(),
  viewport: z.string().optional(),
  referrer: z.string().nullable().optional(),
  wantsResponse: z.boolean().default(false),
  status: z.enum(feedbackStatusOptions).default('pending'),
  priority: z.enum(feedbackPriorityOptions).default('medium'),
  questionId: z.string().uuid().nullable().optional(), // ID de pregunta para debugging
})

export type CreateFeedbackRequest = z.infer<typeof createFeedbackRequestSchema>

// ============================================
// RESPONSE: FEEDBACK DATA
// ============================================

export const feedbackDataSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable().optional(),
  email: z.string().nullable().optional(),
  type: z.enum(feedbackTypeOptions),
  message: z.string(),
  url: z.string(),
  userAgent: z.string().nullable().optional(),
  viewport: z.string().nullable().optional(),
  referrer: z.string().nullable().optional(),
  screenshotUrl: z.string().nullable().optional(),
  status: z.enum(feedbackStatusOptions).nullable().optional(),
  priority: z.enum(feedbackPriorityOptions).nullable().optional(),
  adminResponse: z.string().nullable().optional(),
  adminUserId: z.string().uuid().nullable().optional(),
  wantsResponse: z.boolean().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
  resolvedAt: z.string().nullable().optional(),
  questionId: z.string().uuid().nullable().optional(),
})

export type FeedbackData = z.infer<typeof feedbackDataSchema>

// ============================================
// RESPONSE: CREATE FEEDBACK
// ============================================

export const createFeedbackResponseSchema = z.object({
  success: z.boolean(),
  data: feedbackDataSchema.optional(),
  error: z.string().optional()
})

export type CreateFeedbackResponse = z.infer<typeof createFeedbackResponseSchema>

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

export function safeParseCreateFeedbackRequest(data: unknown) {
  return createFeedbackRequestSchema.safeParse(data)
}

export function validateCreateFeedbackRequest(data: unknown): CreateFeedbackRequest {
  return createFeedbackRequestSchema.parse(data)
}
