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
// RESPONSE: GET PROFILE
// ============================================

export const profileDataSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  preferredLanguage: z.enum(languageOptions).nullable().optional(),
  studyGoal: z.number().int().min(1).max(200).nullable().optional(),
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
  stripeCustomerId: z.string().nullable().optional()
})

export type ProfileData = z.infer<typeof profileDataSchema>

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
    studyGoal: z.number().int().min(1).max(200).optional(),
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
