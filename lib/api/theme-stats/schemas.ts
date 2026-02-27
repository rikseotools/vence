// lib/api/theme-stats/schemas.ts - Schemas de validación para estadísticas por tema
// V2: Stats derivadas dinámicamente desde article_id + topic_scope por oposición
import { z } from 'zod'

// ============================================
// CONSTANTES DE OPOSICIÓN
// ============================================

// Oposiciones válidas (slug de URL)
export const VALID_OPOSICIONES = [
  'auxiliar-administrativo-estado',
  'administrativo-estado',
  'tramitacion-procesal',
  'auxilio-judicial',
  'auxiliar-administrativo-carm',
] as const

export type OposicionSlug = typeof VALID_OPOSICIONES[number]

// Mapeo de oposición (slug URL) a position_type (DB)
export const OPOSICION_TO_POSITION_TYPE: Record<OposicionSlug, string> = {
  'auxiliar-administrativo-estado': 'auxiliar_administrativo',
  'administrativo-estado': 'administrativo',
  'tramitacion-procesal': 'tramitacion_procesal',
  'auxilio-judicial': 'auxilio_judicial',
  'auxiliar-administrativo-carm': 'auxiliar_administrativo_carm',
}

// ============================================
// REQUEST SCHEMAS
// ============================================

export const oposicionSlugSchema = z.enum(VALID_OPOSICIONES)

export const getThemeStatsRequestSchema = z.object({
  userId: z.string().uuid('ID de usuario inválido'),
  oposicionId: oposicionSlugSchema.optional(), // Opcional para compatibilidad hacia atrás
})

export type GetThemeStatsRequest = z.infer<typeof getThemeStatsRequestSchema>

// ============================================
// RESPONSE SCHEMAS
// ============================================

// Estadísticas de un tema individual
export const themeStatSchema = z.object({
  temaNumber: z.number(),
  total: z.number(),
  correct: z.number(),
  accuracy: z.number().min(0).max(100),
  lastStudy: z.string().nullable(),
  lastStudyFormatted: z.string(),
})

export type ThemeStat = z.infer<typeof themeStatSchema>

// Response completo
export const getThemeStatsResponseSchema = z.object({
  success: z.boolean(),
  stats: z.record(z.string(), themeStatSchema).optional(),
  error: z.string().optional(),
  cached: z.boolean().optional(),
  generatedAt: z.string().optional(),
})

export type GetThemeStatsResponse = z.infer<typeof getThemeStatsResponseSchema>

// ============================================
// VALIDATORS
// ============================================

export function validateGetThemeStatsRequest(data: unknown): GetThemeStatsRequest {
  return getThemeStatsRequestSchema.parse(data)
}

export function safeParseGetThemeStatsRequest(data: unknown) {
  return getThemeStatsRequestSchema.safeParse(data)
}
