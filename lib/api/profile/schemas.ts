// lib/api/profile/schemas.ts - Schemas de validación para perfil de usuario
// Usar zod/v3 para compatibilidad con Zod 4
import { z } from 'zod/v3'

// ============================================
// VALORES PERMITIDOS
// ============================================

export const genderOptions = ['male', 'female', 'other', 'prefer_not_say'] as const
export const languageOptions = ['es', 'en'] as const

export type Gender = typeof genderOptions[number]
export type Language = typeof languageOptions[number]

// ============================================
// REQUEST: GET PROFILE
// ============================================

export const getProfileRequestSchema = z.object({
  userId: z.string().uuid()
})

export type GetProfileRequest = z.infer<typeof getProfileRequestSchema>

// ============================================
// RESPONSE: GET PROFILE - TIER SCHEMAS
// ============================================
// Tiers de visibilidad para columnas de user_profiles:
// - self:  el dueño del perfil (excluye PII sensible que no necesita el cliente)
// - admin: admin viendo perfil ajeno (todas las columnas)

// Campos visibles para el propio usuario (NO incluye stripeCustomerId,
// registrationIp, registrationUrl, adminNotes — esos son admin-only)
export const selfProfileDataSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  preferredLanguage: z.enum(languageOptions).nullable().optional(),
  studyGoal: z.number().int().min(1).max(9999).nullable().optional(),
  showDailyGoalBanner: z.boolean().nullable().optional(),
  showTopicTrend: z.boolean().nullable().optional(),
  targetOposicion: z.string().nullable().optional(),
  targetOposicionData: z.record(z.unknown()).nullable().optional(),
  nickname: z.string().nullable().optional(),
  age: z.number().int().min(16).max(120).nullable().optional(),
  gender: z.enum(genderOptions).nullable().optional(),
  ciudad: z.string().nullable().optional(),
  dailyStudyHours: z.number().int().min(0).max(12).nullable().optional(),
  planType: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
  isActiveStudent: z.boolean().nullable().optional(),
  registrationSource: z.string().nullable().optional(),
  requiresPayment: z.boolean().nullable().optional(),
  registrationDate: z.string().nullable().optional(),
  trialEndDate: z.string().nullable().optional(),
  firstOposicionDetectedAt: z.string().nullable().optional(),
  firstTestCompletedAt: z.string().nullable().optional(),
  onboardingCompletedAt: z.string().nullable().optional(),
  onboardingSkipCount: z.number().nullable().optional(),
  onboardingLastSkipAt: z.string().nullable().optional(),
  registrationFunnel: z.string().nullable().optional()
})

export type SelfProfileData = z.infer<typeof selfProfileDataSchema>

// Admin = self + columnas sensibles (PII / interna)
export const adminProfileDataSchema = selfProfileDataSchema.extend({
  stripeCustomerId: z.string().nullable().optional(),
  registrationIp: z.string().nullable().optional(),
  registrationUrl: z.string().nullable().optional(),
  adminNotes: z.string().nullable().optional()
})

export type AdminProfileData = z.infer<typeof adminProfileDataSchema>

// Alias de back-compat: profileDataSchema mantiene su forma previa
// (= adminProfileDataSchema). No cambies este nombre sin migrar callers.
export const profileDataSchema = adminProfileDataSchema
export type ProfileData = AdminProfileData

export const getSelfProfileResponseSchema = z.object({
  success: z.boolean(),
  data: selfProfileDataSchema.optional(),
  error: z.string().optional()
})

export type GetSelfProfileResponse = z.infer<typeof getSelfProfileResponseSchema>

export const getAdminProfileResponseSchema = z.object({
  success: z.boolean(),
  data: adminProfileDataSchema.optional(),
  error: z.string().optional()
})

export type GetAdminProfileResponse = z.infer<typeof getAdminProfileResponseSchema>

export const getProfileResponseSchema = z.object({
  success: z.boolean(),
  data: profileDataSchema.optional(),
  error: z.string().optional()
})

export type GetProfileResponse = z.infer<typeof getProfileResponseSchema>

// ============================================
// REQUEST: UPDATE PROFILE
// ============================================

export const updateProfileRequestSchema = z.object({
  userId: z.string().uuid(),
  data: z.object({
    fullName: z.string().max(255).optional(),
    nickname: z.string().max(100).optional(),
    avatarUrl: z.string().url().max(2048).optional().nullable(),
    preferredLanguage: z.enum(languageOptions).optional(),
    studyGoal: z.number().int().min(1).max(9999).optional(),
    showDailyGoalBanner: z.boolean().optional(),
    showTopicTrend: z.boolean().optional(),
    targetOposicion: z.string().max(100).optional().nullable(),
    targetOposicionData: z.record(z.unknown()).optional().nullable(),
    age: z.number().int().min(16).max(120).optional().nullable(),
    gender: z.enum(genderOptions).optional().nullable(),
    ciudad: z.string().max(100).optional().nullable(),
    dailyStudyHours: z.number().int().min(0).max(12).optional().nullable()
  }).refine(data => Object.keys(data).length > 0, {
    message: 'Al menos un campo debe ser proporcionado para actualizar'
  })
})

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>

// ============================================
// RESPONSE: UPDATE PROFILE
// ============================================

export const updateProfileResponseSchema = z.object({
  success: z.boolean(),
  data: profileDataSchema.optional(),
  error: z.string().optional()
})

export type UpdateProfileResponse = z.infer<typeof updateProfileResponseSchema>

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

export function safeParseGetProfileRequest(data: unknown) {
  return getProfileRequestSchema.safeParse(data)
}

export function safeParseUpdateProfileRequest(data: unknown) {
  return updateProfileRequestSchema.safeParse(data)
}

export function validateGetProfileRequest(data: unknown): GetProfileRequest {
  return getProfileRequestSchema.parse(data)
}

export function validateUpdateProfileRequest(data: unknown): UpdateProfileRequest {
  return updateProfileRequestSchema.parse(data)
}
