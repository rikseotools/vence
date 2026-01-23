// lib/api/avatar-settings/schemas.ts - Schemas de validación para configuración de avatares
// Usar zod/v3 para compatibilidad con Zod 4
import { z } from 'zod/v3'

// ============================================
// VALORES PERMITIDOS
// ============================================

export const avatarModeOptions = ['manual', 'automatic'] as const
export type AvatarMode = typeof avatarModeOptions[number]

export const avatarProfileIds = [
  'unicorn',        // Unicornio Legendario - accuracy >90% Y >150 preguntas/semana
  'night_owl',      // Búho Nocturno - estudia de noche
  'early_bird',     // Gallo Madrugador - estudia temprano
  'champion',       // León Campeón - accuracy >85% Y >150 preguntas/semana
  'consistent',     // Tortuga Constante - streak >14 días
  'speed_eagle',    // Águila Veloz - >100 preguntas/semana
  'worker_ant',     // Hormiga Trabajadora - estudia todos los días
  'smart_dolphin',  // Delfín Inteligente - mejora >10%
  'relaxed_koala',  // Koala Relajado - <20 preguntas/semana
  'clever_squirrel', // Ardilla Astuta - >70% en temas difíciles
  'busy_bee'        // Abeja Productiva - estudia mañana+tarde+noche
] as const

export type AvatarProfileId = typeof avatarProfileIds[number]

// ============================================
// SCHEMA: AVATAR PROFILE (datos estáticos)
// ============================================

export const avatarProfileSchema = z.object({
  id: z.string(),
  emoji: z.string(),
  nameEs: z.string(),
  nameEsF: z.string().nullable().optional(), // Nombre femenino (null si es neutro)
  descriptionEs: z.string(),
  color: z.string(),
  priority: z.number()
})

export type AvatarProfile = z.infer<typeof avatarProfileSchema>

// ============================================
// SCHEMA: USER AVATAR SETTINGS
// ============================================

export const userAvatarSettingsDataSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  mode: z.enum(avatarModeOptions),
  currentProfile: z.string().nullable().optional(),
  currentEmoji: z.string().nullable().optional(),
  currentName: z.string().nullable().optional(),
  lastRotationAt: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional()
})

export type UserAvatarSettingsData = z.infer<typeof userAvatarSettingsDataSchema>

// ============================================
// REQUEST: GET AVATAR SETTINGS
// ============================================

export const getAvatarSettingsRequestSchema = z.object({
  userId: z.string().uuid()
})

export type GetAvatarSettingsRequest = z.infer<typeof getAvatarSettingsRequestSchema>

// ============================================
// RESPONSE: GET AVATAR SETTINGS
// ============================================

export const getAvatarSettingsResponseSchema = z.object({
  success: z.boolean(),
  data: userAvatarSettingsDataSchema.optional(),
  profile: avatarProfileSchema.optional(),
  allProfiles: z.array(avatarProfileSchema).optional(),
  error: z.string().optional()
})

export type GetAvatarSettingsResponse = z.infer<typeof getAvatarSettingsResponseSchema>

// ============================================
// REQUEST: UPDATE AVATAR SETTINGS
// ============================================

export const updateAvatarSettingsRequestSchema = z.object({
  userId: z.string().uuid(),
  data: z.object({
    mode: z.enum(avatarModeOptions).optional(),
    currentProfile: z.string().optional().nullable(),
    currentEmoji: z.string().optional().nullable(),
    currentName: z.string().optional().nullable()
  }).refine(data => Object.keys(data).length > 0, {
    message: 'Al menos una configuración debe ser proporcionada'
  })
})

export type UpdateAvatarSettingsRequest = z.infer<typeof updateAvatarSettingsRequestSchema>

// ============================================
// RESPONSE: UPDATE AVATAR SETTINGS
// ============================================

export const updateAvatarSettingsResponseSchema = z.object({
  success: z.boolean(),
  data: userAvatarSettingsDataSchema.optional(),
  profile: avatarProfileSchema.optional(),
  error: z.string().optional()
})

export type UpdateAvatarSettingsResponse = z.infer<typeof updateAvatarSettingsResponseSchema>

// ============================================
// SCHEMA: MÉTRICAS DE ESTUDIO (para cálculo de perfil)
// ============================================

export const studyMetricsSchema = z.object({
  // Horas de estudio
  nightHoursPercentage: z.number().min(0).max(100),    // % sesiones después de 21:00
  morningHoursPercentage: z.number().min(0).max(100),  // % sesiones antes de 9:00

  // Rendimiento
  weeklyAccuracy: z.number().min(0).max(100),          // % aciertos esta semana
  accuracyImprovement: z.number(),                      // Mejora respecto a semana anterior
  hardTopicsAccuracy: z.number().min(0).max(100),      // % aciertos en temas difíciles

  // Actividad
  weeklyQuestionsCount: z.number().min(0),             // Preguntas respondidas esta semana
  daysStudiedThisWeek: z.number().min(0).max(7),       // Días activos esta semana
  currentStreak: z.number().min(0),                    // Racha actual en días

  // Patrones de horario
  studiedMorning: z.boolean(),                         // Estudió por la mañana (6-12)
  studiedAfternoon: z.boolean(),                       // Estudió por la tarde (12-18)
  studiedNight: z.boolean()                            // Estudió por la noche (18-24)
})

export type StudyMetrics = z.infer<typeof studyMetricsSchema>

// ============================================
// REQUEST: CALCULATE PROFILE
// ============================================

export const calculateProfileRequestSchema = z.object({
  userId: z.string().uuid()
})

export type CalculateProfileRequest = z.infer<typeof calculateProfileRequestSchema>

// ============================================
// RESPONSE: CALCULATE PROFILE
// ============================================

export const calculateProfileResponseSchema = z.object({
  success: z.boolean(),
  profile: avatarProfileSchema.optional(),
  metrics: studyMetricsSchema.optional(),
  matchedConditions: z.array(z.string()).optional(),
  error: z.string().optional()
})

export type CalculateProfileResponse = z.infer<typeof calculateProfileResponseSchema>

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

export function safeParseGetAvatarSettingsRequest(data: unknown) {
  return getAvatarSettingsRequestSchema.safeParse(data)
}

export function safeParseUpdateAvatarSettingsRequest(data: unknown) {
  return updateAvatarSettingsRequestSchema.safeParse(data)
}

export function safeParseCalculateProfileRequest(data: unknown) {
  return calculateProfileRequestSchema.safeParse(data)
}

export function validateGetAvatarSettingsRequest(data: unknown): GetAvatarSettingsRequest {
  return getAvatarSettingsRequestSchema.parse(data)
}

export function validateUpdateAvatarSettingsRequest(data: unknown): UpdateAvatarSettingsRequest {
  return updateAvatarSettingsRequestSchema.parse(data)
}

export function validateCalculateProfileRequest(data: unknown): CalculateProfileRequest {
  return calculateProfileRequestSchema.parse(data)
}
