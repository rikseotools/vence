// lib/api/theme-stats/schemas.ts - Schemas de validación para estadísticas por tema
// V2: Stats derivadas dinámicamente desde article_id + topic_scope por oposición
import { z } from 'zod'
import {
  ALL_OPOSICION_SLUGS,
  OPOSICION_SLUGS_ENUM,
  SLUG_TO_POSITION_TYPE,
} from '@/lib/config/oposiciones'

// ============================================
// CONSTANTES DE OPOSICIÓN (re-export desde config central)
// ============================================

export { ALL_OPOSICION_SLUGS as VALID_OPOSICIONES } from '@/lib/config/oposiciones'
export { SLUG_TO_POSITION_TYPE as OPOSICION_TO_POSITION_TYPE } from '@/lib/config/oposiciones'

export type OposicionSlug = typeof ALL_OPOSICION_SLUGS[number]

// ============================================
// REQUEST SCHEMAS
// ============================================

export const oposicionSlugSchema = z.enum(OPOSICION_SLUGS_ENUM)

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
