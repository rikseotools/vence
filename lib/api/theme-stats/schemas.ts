// lib/api/theme-stats/schemas.ts - Schemas de validación para estadísticas por tema
import { z } from 'zod'

// ============================================
// REQUEST SCHEMAS
// ============================================

export const getThemeStatsRequestSchema = z.object({
  userId: z.string().uuid('ID de usuario inválido'),
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
