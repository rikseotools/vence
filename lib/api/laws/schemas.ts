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
// SCHEMAS DE RESOLUCIÓN DE LEYES
// ============================================

/** Ley resuelta desde BD - resultado de resolveLawBySlug */
export const LawResolvedSchema = z.object({
  id: z.string().uuid(),
  shortName: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  year: z.number().nullable(),
  type: z.string(),
})

/** Info básica de una ley (compatible con LawInfo de lawMappingUtils) */
export const LawInfoSchema = z.object({
  name: z.string(),
  description: z.string(),
})

// ============================================
// SCHEMAS DE RESPUESTA API
// ============================================

export const GetLawsWithCountsResponseSchema = z.object({
  success: z.boolean(),
  laws: z.array(LawWithCountsSchema).optional(),
  error: z.string().optional(),
})

/** Entrada individual del mapping slug ↔ shortName para el endpoint /api/v2/law-slugs */
export const SlugMappingEntrySchema = z.object({
  slug: z.string(),
  shortName: z.string(),
  name: z.string(),
  description: z.string().nullable(),
})

/** Respuesta del endpoint /api/v2/law-slugs */
export const SlugMappingResponseSchema = z.object({
  success: z.literal(true),
  mappings: z.array(SlugMappingEntrySchema),
  count: z.number(),
})

// ============================================
// TIPOS TYPESCRIPT
// ============================================

export type LawWithCounts = z.infer<typeof LawWithCountsSchema>
export type GetLawsWithCountsResponse = z.infer<typeof GetLawsWithCountsResponseSchema>
export type LawSlug = z.infer<typeof lawSlugSchema>
export type LawShortName = z.infer<typeof lawShortNameSchema>
export type LawSlugMapping = z.infer<typeof LawSlugMappingSchema>
export type LawResolved = z.infer<typeof LawResolvedSchema>
export type LawInfo = z.infer<typeof LawInfoSchema>
export type SlugMappingEntry = z.infer<typeof SlugMappingEntrySchema>
export type SlugMappingResponse = z.infer<typeof SlugMappingResponseSchema>

// Cache structure
export interface SlugMappingCache {
  slugToShortName: Map<string, string>
  shortNameToSlug: Map<string, string>
  /** Full law data indexed by slug for rich resolution */
  lawsBySlug: Map<string, LawResolved>
  loadedAt: Date
}
