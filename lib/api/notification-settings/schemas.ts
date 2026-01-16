// lib/api/notification-settings/schemas.ts - Schemas de validación para configuración de notificaciones
// Usar zod/v3 para compatibilidad con Zod 4
import { z } from 'zod/v3'

// ============================================
// VALORES PERMITIDOS
// ============================================

export const frequencyOptions = ['daily', 'smart', 'minimal', 'off'] as const
export const motivationLevelOptions = ['low', 'medium', 'high', 'extreme'] as const

export type Frequency = typeof frequencyOptions[number]
export type MotivationLevel = typeof motivationLevelOptions[number]

// ============================================
// REQUEST: GET NOTIFICATION SETTINGS
// ============================================

export const getNotificationSettingsRequestSchema = z.object({
  userId: z.string().uuid()
})

export type GetNotificationSettingsRequest = z.infer<typeof getNotificationSettingsRequestSchema>

// ============================================
// RESPONSE: NOTIFICATION SETTINGS DATA
// ============================================

export const notificationSettingsDataSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  pushEnabled: z.boolean(),
  pushSubscription: z.record(z.unknown()).nullable().optional(),
  preferredTimes: z.array(z.string()).nullable().optional(),
  timezone: z.string().nullable().optional(),
  frequency: z.enum(frequencyOptions).nullable().optional(),
  oposicionType: z.string().nullable().optional(),
  examDate: z.string().nullable().optional(),
  motivationLevel: z.enum(motivationLevelOptions).nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional()
})

export type NotificationSettingsData = z.infer<typeof notificationSettingsDataSchema>

export const getNotificationSettingsResponseSchema = z.object({
  success: z.boolean(),
  data: notificationSettingsDataSchema.optional(),
  error: z.string().optional()
})

export type GetNotificationSettingsResponse = z.infer<typeof getNotificationSettingsResponseSchema>

// ============================================
// REQUEST: UPSERT NOTIFICATION SETTINGS
// ============================================

export const upsertNotificationSettingsRequestSchema = z.object({
  userId: z.string().uuid(),
  data: z.object({
    pushEnabled: z.boolean().optional(),
    pushSubscription: z.record(z.unknown()).optional().nullable(),
    preferredTimes: z.array(z.string()).optional(),
    timezone: z.string().optional(),
    frequency: z.enum(frequencyOptions).optional(),
    oposicionType: z.string().optional(),
    examDate: z.string().optional().nullable(),
    motivationLevel: z.enum(motivationLevelOptions).optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: 'Al menos una configuración debe ser proporcionada'
  })
})

export type UpsertNotificationSettingsRequest = z.infer<typeof upsertNotificationSettingsRequestSchema>

// ============================================
// RESPONSE: UPSERT NOTIFICATION SETTINGS
// ============================================

export const upsertNotificationSettingsResponseSchema = z.object({
  success: z.boolean(),
  data: notificationSettingsDataSchema.optional(),
  error: z.string().optional()
})

export type UpsertNotificationSettingsResponse = z.infer<typeof upsertNotificationSettingsResponseSchema>

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

export function safeParseGetNotificationSettingsRequest(data: unknown) {
  return getNotificationSettingsRequestSchema.safeParse(data)
}

export function safeParseUpsertNotificationSettingsRequest(data: unknown) {
  return upsertNotificationSettingsRequestSchema.safeParse(data)
}

export function validateGetNotificationSettingsRequest(data: unknown): GetNotificationSettingsRequest {
  return getNotificationSettingsRequestSchema.parse(data)
}

export function validateUpsertNotificationSettingsRequest(data: unknown): UpsertNotificationSettingsRequest {
  return upsertNotificationSettingsRequestSchema.parse(data)
}
