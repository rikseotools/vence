// lib/api/laws/schemas.ts - Schemas Zod para Leyes
import { z } from 'zod/v3'

// ============================================
// CONSTANTES
// ============================================

/** Tiempo de vida del cache en ms (5 minutos) */
export const SLUG_CACHE_TTL_MS = 5 * 60 * 1000

/** Tiempo máximo para considerar cache stale (1 hora) */
export const SLUG_CACHE_MAX_AGE_MS = 60 * 60 * 1000

// ============================================
// SCHEMAS BASE
// ============================================

export const lawSlugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/, 'Slug debe ser lowercase con guiones')

export const lawShortNameSchema = z.string().min(1)

export const LawSlugMappingSchema = z.object({
  id: z.string().uuid(),
  shortName: z.string(),
  slug: z.string().nullable(),
})

export const LawWithCountsSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  short_name: z.string(),
  description: z.string().nullable(),
  year: z.number().nullable(),
  type: z.string(),
  questionCount: z.number(),
  officialQuestions: z.number(),
})

// ============================================
// SCHEMAS DE RESPUESTA
// ============================================

export const GetLawsWithCountsResponseSchema = z.object({
  success: z.boolean(),
  laws: z.array(LawWithCountsSchema).optional(),
  error: z.string().optional(),
})

// ============================================
// TIPOS TYPESCRIPT
// ============================================

export type LawWithCounts = z.infer<typeof LawWithCountsSchema>
export type GetLawsWithCountsResponse = z.infer<typeof GetLawsWithCountsResponseSchema>
export type LawSlug = z.infer<typeof lawSlugSchema>
export type LawShortName = z.infer<typeof lawShortNameSchema>
export type LawSlugMapping = z.infer<typeof LawSlugMappingSchema>

// Cache structure
export interface SlugMappingCache {
  slugToShortName: Map<string, string>
  shortNameToSlug: Map<string, string>
  loadedAt: Date
}
